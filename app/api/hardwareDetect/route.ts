import { NextResponse } from "next/server"
import { zones, pendingCommands, updateHardwareState, recordActivity } from "../zones/data"
import { DetectionEvent } from "../zones/types"
import { calculateSeverity, getTreatmentOptions, normalizeDiseaseLabel } from "@/app/lib/mlProcessor"
import { readDB, writeDB } from "@/app/lib/database"

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

    const flaskRes = await fetch("http://127.0.0.1:5000/predict", {
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

    // 🔥 Severity calculation (healthy must stay low)
    const { level, score } = calculateSeverity(confidence, canonicalDisease)

    // 🔥 Treatment lookup
    const treatments = getTreatmentOptions(canonicalDisease)
    const primaryChemical = treatments.chemicals?.[0]

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
        treatments.organic?.[0] ?? "Neem Oil Extract",
      dosage:
        primaryChemical?.dosage ?? (treatments.organic?.[0]?.includes("(") ? treatments.organic[0].split("(")[1]?.replace(")", "") : "5ml/L"),
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

    // Save detection persistently
    db.detections.push(newDetection)
    recordActivity({ type: "alert", zoneId, timestamp: newDetection.timestamp })

    // 🚿 AUTO SPRAY — Only if severity not low
    if (!isHealthyPrediction && level !== "low") {
      const sprayId = crypto.randomUUID()
      const sprayTimestamp = new Date().toISOString()

      db.sprays.push({
        id: sprayId,
        zoneId,
        detectionId: newDetection.id,
        manualWithoutDetection: false,
        disease,
        chemical:
          primaryChemical?.chemicalName ?? (treatments.organic?.[0]?.split(" (")[0] || "Neem Oil Extract"),
        dosage:
          primaryChemical?.dosage ?? (treatments.organic?.[0]?.includes("(") ? treatments.organic[0].split("(")[1]?.replace(")", "") : "5ml/L"),
        timestamp: sprayTimestamp,
        triggeredBy: "AI Auto Spray",
      })

      // Keep detection-spray lifecycle linked for auto operations as well.
      newDetection.status = "treated"
      newDetection.treatedAt = sprayTimestamp
      newDetection.linkedSprayId = sprayId

      if (!pendingCommands[zoneId]) {
        pendingCommands[zoneId] = []
      }
      pendingCommands[zoneId].push("spray")

      updateHardwareState({
        currentAction: "spray",
        activeZoneId: zoneId,
        currentPath: [zoneId],
        nozzleStatus: "pending",
        lastCommand: `spray:${zoneId}`,
        lastCommandAt: sprayTimestamp,
        awaitingFeedback: true,
      })

      zone.lastSprayed = sprayTimestamp
    }

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