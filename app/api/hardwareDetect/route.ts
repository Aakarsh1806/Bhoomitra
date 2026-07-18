import { NextResponse } from "next/server"
import { zones, recordActivity } from "../zones/data"
import { DetectionEvent } from "../zones/types"
import { calculateSeverity, getTreatmentOptions, normalizeDiseaseLabel } from "@/app/lib/mlProcessor"
import { readDB, writeDB } from "@/app/lib/database"

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5000"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const zoneId = formData.get("zoneId") as string
    const file = formData.get("file") as File
    const modelId = (formData.get("modelId") as string) || undefined
    const crop = (formData.get("crop") as string) || (formData.get("cropType") as string) || undefined
    const language = (formData.get("language") as string) || undefined

    if (!zoneId || !file) {
      return NextResponse.json(
        { error: "Missing zone or image file" },
        { status: 400 }
      )
    }

    // Send image to Flask ML server
    const flaskForm = new FormData()
    flaskForm.append("file", file)

    if (modelId) {
      flaskForm.append("modelId", modelId)
    }

    if (crop) {
      flaskForm.append("crop", crop)
    }

    if (language) {
      flaskForm.append("language", language)
    }

    const flaskRes = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      body: flaskForm,
    })

    if (!flaskRes.ok) {
      return NextResponse.json(
        { error: "ML prediction failed" },
        { status: 500 }
      )
    }

    const mlResult = await flaskRes.json()

    const disease = mlResult?.disease ?? "Unknown"
    const canonicalDisease = mlResult?.canonicalDisease ?? mlResult?.englishDisease ?? disease
    const confidence = mlResult?.confidence ?? 0
    const selectedModelId = mlResult?.modelId ?? modelId ?? null
    const selectedModelVersion = mlResult?.modelVersion ?? null

    const zone = zones.find(z => z.id === zoneId)
    if (!zone) {
      return NextResponse.json(
        { error: "Zone not found" },
        { status: 404 }
      )
    }

    const isHealthyPrediction = normalizeDiseaseLabel(canonicalDisease).includes("healthy")
    const isLowConfidencePrediction = !isHealthyPrediction && confidence < 0.65

    // 🔥 Severity calculation (healthy must stay low)
    const { level, score } = calculateSeverity(confidence, canonicalDisease)

    // 🔥 Treatment lookup
    const treatments = getTreatmentOptions(canonicalDisease)
    const primaryChemical = isLowConfidencePrediction ? undefined : treatments.chemicals?.[0]
    const primaryRecommendation = !isLowConfidencePrediction && treatments.offlineRecommendation
      ? {
          activeIngredient: treatments.offlineRecommendation.activeIngredient,
          formulation: treatments.offlineRecommendation.formulation,
          category: treatments.offlineRecommendation.category,
          dosage: treatments.offlineRecommendation.dosage,
          sprayInterval: treatments.offlineRecommendation.sprayInterval,
          preHarvestInterval: treatments.offlineRecommendation.preHarvestInterval,
          resistanceGroup: treatments.offlineRecommendation.resistanceGroup,
          safetyNote: treatments.offlineRecommendation.safetyNote,
          organicAlternative: treatments.offlineRecommendation.organicAlternative,
          verificationNotice: treatments.offlineRecommendation.verificationNotice,
          source: "telangana-offline",
        }
      : primaryChemical
        ? {
            activeIngredient: primaryChemical.chemicalName,
            formulation: "",
            category: primaryChemical.type,
            dosage: primaryChemical.dosage,
            sprayInterval: primaryChemical.sprayInterval,
            preHarvestInterval: primaryChemical.preHarvestInterval,
            resistanceGroup: primaryChemical.resistanceGroup ?? "Not specified",
            safetyNote: primaryChemical.safetyNote,
            organicAlternative: treatments.organic?.[0] ?? "Neem Oil Extract",
            verificationNotice: treatments.notice,
            source: "database-fallback",
          }
        : null

    // 🔥 Create detection object
    const newDetection: DetectionEvent = {
      id: crypto.randomUUID(),
      zoneId,
      disease,
      canonicalDisease,
      confidence,
      severityLevel: level,
      severityScore: score,
      recommendedChemical:
        primaryChemical?.chemicalName ?? "No chemical required",
      organicAlternative:
        treatments.organic?.[0] ?? "Consult local agricultural extension",
      dosage:
        primaryChemical?.dosage ?? "No spray dose—recheck the diagnosis and consult local extension",
      timestamp: new Date().toISOString(),

      status: isHealthyPrediction ? "resolved" : "active",
      treatedAt: null,
      postSeverityScore: null,
      linkedSprayId: null,
      modelId: selectedModelId,
      modelVersion: selectedModelVersion,

    }

    // 🔥 READ DB
    const db = readDB()

    // A fresh scan of a zone reflects its current state — supersede any
    // prior active detections for this zone so risk analytics reflect what
    // the plot looks like now, not the full history of every past scan.
    db.detections.forEach((d: any) => {
      if (d.zoneId === zoneId && d.status !== "resolved" && d.status !== "treated") {
        d.status = "resolved"
      }
    })

    // Save detection persistently
    db.detections.push(newDetection)
    recordActivity({ type: "alert", zoneId, timestamp: newDetection.timestamp })

    // The offline catalog is decision support. Physical spraying must be a
    // separately confirmed farmer action (via /api/spray), never an automatic
    // ML side effect.

    // 🔥 WRITE DB
    writeDB(db)

    // 🔥 Update live zone state (UI reflection only)
    zone.disease = disease
    zone.mlConfidence = confidence
    zone.severityLevel = level as "low" | "moderate" | "high"
    zone.severityScore = score
    zone.lastAnalyzed = new Date().toISOString()
    zone.status = isHealthyPrediction ? "healthy" : level === "high" ? "critical" : level === "moderate" ? "warning" : zone.status
    zone.canonicalDisease = canonicalDisease
    zone.mlModelId = selectedModelId ?? undefined
    zone.mlModelVersion = selectedModelVersion ?? undefined

    if (!zone.treatmentHistory) zone.treatmentHistory = []
    zone.treatmentHistory.push(newDetection)

    return NextResponse.json({
      success: true,
      detection: newDetection,
      recommendation: primaryRecommendation,
      recommendationNotice: isLowConfidencePrediction
        ? "Low-confidence prediction: no pesticide recommendation is shown. Retake a clear leaf photo and confirm the diagnosis with local agricultural extension."
        : treatments.notice,
      modelId: selectedModelId,
      modelVersion: selectedModelVersion,
    })

  } catch (err) {
    console.error("Hardware detect error:", err)
    return NextResponse.json(
      { error: "Hardware detect failed" },
      { status: 500 }
    )
  }
}
