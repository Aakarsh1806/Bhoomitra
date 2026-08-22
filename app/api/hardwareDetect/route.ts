import { NextResponse } from "next/server"
import { zones, recordActivity } from "../zones/data"
import { DetectionEvent } from "../zones/types"
import { calculateSeverity, getTreatmentOptions, normalizeDiseaseLabel } from "@/app/lib/mlProcessor"
import { readDB, writeDB } from "@/app/lib/database"

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5000"

function cropFromDiseaseLabel(disease?: string) {
  const crop = String(disease || "").split("___")[0]?.replace(/_/g, " ").trim()
  return crop || null
}

function normalizeCrop(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim()
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const zoneId = formData.get("zoneId") as string
    const file = formData.get("file") as File
    const modelId = (formData.get("modelId") as string) || undefined
    const rawCrop = (formData.get("crop") as string) || (formData.get("cropType") as string) || undefined
    const crop = rawCrop?.trim() || undefined
    const language = (formData.get("language") as string) || undefined

    if (!zoneId || !file) {
      return NextResponse.json(
        { error: "Missing zone or image file" },
        { status: 400 }
      )
    }

    const zone = zones.find(z => z.id === zoneId)
    if (!zone) {
      return NextResponse.json(
        { error: "Zone not found" },
        { status: 404 }
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

    const isHealthyPrediction = normalizeDiseaseLabel(canonicalDisease).includes("healthy")
    const isLowConfidencePrediction = !isHealthyPrediction && confidence < 0.65
    // The model returns the crop family from its "Crop___Disease" label. Trust
    // that when present; only fall back to parsing the disease string (which
    // fails to yield a crop) when the model did not supply one.
    const modelCrop = mlResult?.crop
      ? String(mlResult.crop).replace(/_/g, " ").trim()
      : cropFromDiseaseLabel(canonicalDisease)
    const cropMatch = crop && modelCrop
      ? normalizeCrop(crop) === normalizeCrop(modelCrop)
        ? "matched"
        : "review"
      : "not_applicable"
    const needsCropConfirmation = cropMatch === "review"

    // 🔥 Severity calculation (healthy must stay low)
    const { level, score } = calculateSeverity(confidence, canonicalDisease)

    // 🔥 Treatment lookup
    const treatments = getTreatmentOptions(canonicalDisease, crop)
    const primaryChemical = isLowConfidencePrediction || needsCropConfirmation ? undefined : treatments.chemicals?.[0]
    const primaryRecommendation = !isLowConfidencePrediction && !needsCropConfirmation && treatments.offlineRecommendation
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
        needsCropConfirmation
          ? "Crop confirmation required"
          : primaryChemical?.chemicalName ?? "No chemical required",
      organicAlternative:
        treatments.organic?.[0] ?? "Consult local agricultural extension",
      dosage:
        needsCropConfirmation
          ? "Do not prepare a spray until the scan crop is confirmed"
          : primaryChemical?.dosage ?? "No spray dose—recheck the diagnosis and consult local extension",
      timestamp: new Date().toISOString(),

      status: isHealthyPrediction ? "resolved" : "active",
      treatedAt: null,
      postSeverityScore: null,
      linkedSprayId: null,
      scanCrop: crop,
      modelCrop: modelCrop ?? undefined,
      cropMatch,
      modelId: selectedModelId,
      modelVersion: selectedModelVersion,

    }

    // 🔥 READ DB
    const db = readDB()

    // A fresh, conclusive scan reflects the zone's current state — supersede
    // any prior active detections so risk analytics reflect what the plot
    // looks like now, not the full history of every past scan. A crop-mismatch
    // scan proves nothing about the zone's disease state, so it must never
    // retire a still-valid prior diagnosis — it is saved for review alongside it.
    if (!needsCropConfirmation) {
      db.detections.forEach((d: any) => {
        if (d.zoneId === zoneId && d.status !== "resolved" && d.status !== "treated") {
          d.status = "resolved"
        }
      })
    }

    // Save detection persistently
    db.detections.push(newDetection)
    recordActivity({ type: "alert", zoneId, timestamp: newDetection.timestamp })

    // The offline catalog is decision support. Physical spraying must be a
    // separately confirmed farmer action (via /api/spray), never an automatic
    // ML side effect.

    // 🔥 WRITE DB
    writeDB(db)

    // 🔥 Update live zone state (UI reflection only). A crop-mismatch scan is
    // inconclusive — it must not overwrite a still-valid diagnosis with an
    // unreliable guess. It is tracked as a pending review (via db.detections
    // + cropReview) without touching the zone's current disease display.
    zone.lastAnalyzed = new Date().toISOString()
    zone.mlModelId = selectedModelId ?? undefined
    zone.mlModelVersion = selectedModelVersion ?? undefined
    if (!needsCropConfirmation) {
      zone.disease = disease
      zone.mlConfidence = confidence
      zone.severityLevel = level as "low" | "moderate" | "high"
      zone.severityScore = score
      zone.canonicalDisease = canonicalDisease
      zone.status = isHealthyPrediction
        ? "healthy"
        : level === "high"
          ? "critical"
          : level === "moderate"
            ? "warning"
            : zone.status
    }

    if (!zone.treatmentHistory) zone.treatmentHistory = []
    zone.treatmentHistory.push(newDetection)

    return NextResponse.json({
      success: true,
      detection: newDetection,
      recommendation: primaryRecommendation,
      recommendationNotice: needsCropConfirmation
        ? `Crop check required: the photographed leaf was marked as ${crop}, while the classifier label belongs to ${modelCrop}. The scan is saved for review, but no spray recommendation is enabled.`
        : isLowConfidencePrediction
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
