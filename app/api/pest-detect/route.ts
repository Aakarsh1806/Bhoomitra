import { NextResponse } from "next/server"
import { zones } from "@/app/api/zones/data"
import { cropIsSupported, getPestKnowledge } from "@/app/data/pestKnowledge"
import { confidenceBand, PestPrediction, savePestRecord } from "@/app/lib/pestRecords"

export const dynamic = "force-dynamic"

const PEST_ML_SERVICE_URL = process.env.PEST_ML_SERVICE_URL ?? "http://127.0.0.1:5001"
const MODEL_TIMEOUT_MS = 30_000
const IDENTITY_CONFIDENCE_GATE = 0.6
const MIN_CONFIDENCE_TO_STORE = 0.65

type ServicePrediction = {
  classId?: number
  label?: string
  confidence?: number
}

function clamp(value: unknown, min = 0, max = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return min
  return Math.max(min, Math.min(max, parsed))
}

async function getModelHealth() {
  try {
    const response = await fetch(PEST_ML_SERVICE_URL + "/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    })
    const body = await response.json().catch(() => ({}))
    return {
      reachable: response.ok,
      ready: Boolean(response.ok && body?.ready),
      modelId: body?.modelId ?? "bhoomitra_pest_classifier_v1",
      modelVersion: body?.modelVersion ?? "1.0.0",
      classCount: Number(body?.classCount || 0),
      task: body?.task ?? "image-classification",
      message: body?.message ?? (response.ok ? "Pest classifier reachable." : "Pest classifier is not ready."),
    }
  } catch {
    return {
      reachable: false,
      ready: false,
      modelId: "bhoomitra_pest_classifier_v1",
      modelVersion: "1.0.0",
      classCount: 0,
      task: "image-classification",
      message: "The local pest-classifier service is not running.",
    }
  }
}

export async function GET() {
  const model = await getModelHealth()
  return NextResponse.json({
    integrationReady: model.ready,
    model,
    contract: {
      endpoint: "/predict",
      input: "one pest image",
      output: "top pest classes and confidence scores",
      limitation: "Image classification does not count or locate individual pests.",
    },
  })
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const zoneId = String(form.get("zoneId") || "").trim()
    const crop = String(form.get("crop") || "").trim()
    const language = String(form.get("language") || "en").trim()
    const fileValue = form.get("file")
    const file = fileValue instanceof File ? fileValue : null

    if (!zoneId || !crop) {
      return NextResponse.json({ error: "Select the crop and field zone before checking the image." }, { status: 400 })
    }
    if (!zones.some((zone) => zone.id === zoneId)) {
      return NextResponse.json({ error: "The selected field zone was not found." }, { status: 404 })
    }
    if (!file) {
      return NextResponse.json({ error: "Take or choose a clear pest image first." }, { status: 400 })
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Choose an image file such as JPG, PNG or WEBP." }, { status: 400 })
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Image is too large. Choose an image below 12 MB." }, { status: 413 })
    }

    const modelForm = new FormData()
    modelForm.append("file", file)

    let response: Response
    try {
      response = await fetch(PEST_ML_SERVICE_URL + "/predict", {
        method: "POST",
        body: modelForm,
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      })
    } catch {
      return NextResponse.json({
        error: "The local pest-classifier service is not running.",
        modelReady: false,
        nextStep: "Start pest_ml_service/main.py on port 5001 and try again.",
      }, { status: 503 })
    }

    const modelBody = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({
        error: modelBody?.error || "The pest classifier could not analyse this image.",
        modelReady: Boolean(modelBody?.ready),
        nextStep: "Verify the TorchScript model, class_names.json and Python service.",
      }, { status: response.status === 400 || response.status === 413 ? response.status : 503 })
    }

    const rawPredictions: ServicePrediction[] = Array.isArray(modelBody?.predictions)
      ? modelBody.predictions.slice(0, 3)
      : []
    if (!rawPredictions.length) {
      return NextResponse.json({ error: "The pest classifier returned no prediction." }, { status: 502 })
    }

    const predictions: PestPrediction[] = rawPredictions.map((item) => {
      const label = String(item?.label || "").trim()
      const knowledge = getPestKnowledge(label)
      if (knowledge.id === "unknown") {
        throw new Error("No Bhoomitra advisory is mapped to model class “" + label + "”.")
      }
      return {
        label,
        pestId: knowledge.id,
        confidence: clamp(item?.confidence),
      }
    })

    const primary = predictions[0]
    const primaryKnowledge = getPestKnowledge(primary.label)
    const confidence = primary.confidence
    const band = confidenceBand(confidence)
    const supportedCrop = cropIsSupported(primaryKnowledge, crop)
    const cropMatch = supportedCrop ? "matched" as const : "review" as const
    const identityNeedsReview = confidence < IDENTITY_CONFIDENCE_GATE
    const chemicalBlockedReason = identityNeedsReview
      ? "The image result is uncertain. Retake the photo or obtain expert confirmation."
      : cropMatch === "review"
        ? "The " + primaryKnowledge.commonName + " guide is not verified for " + crop + ". Confirm with local extension."
        : "A classifier cannot measure field infestation. Scout the field and confirm the local action threshold before spraying."
    const timestamp = new Date().toISOString()
    const shouldStore = confidence > MIN_CONFIDENCE_TO_STORE

    const result = {
      success: true,
      persisted: shouldStore,
      model: {
        modelId: modelBody?.modelId || "bhoomitra_pest_classifier_v1",
        modelVersion: modelBody?.modelVersion || "1.0.0",
        ready: true,
        task: "image-classification",
      },
      scan: {
        zoneId,
        crop,
        language,
        timestamp,
        imageName: file.name,
      },
      summary: {
        primaryPestId: primaryKnowledge.id,
        primaryPestName: primaryKnowledge.commonName,
        scientificName: primaryKnowledge.scientificName,
        confidence,
        confidenceBand: band,
        cropMatch,
        identityNeedsReview,
      },
      predictions,
      classificationLimit: "This result identifies the dominant pest category in the photo. It does not count insects, draw bounding boxes or estimate infestation across the field.",
      pest: {
        damageSigns: primaryKnowledge.damageSigns,
        whyItMatters: primaryKnowledge.whyItMatters,
      },
      advice: {
        inspectToday: primaryKnowledge.inspectToday,
        next48Hours: primaryKnowledge.next48Hours,
        prevention: primaryKnowledge.prevention,
        biologicalControl: primaryKnowledge.biologicalControl,
        pesticide: {
          ...primaryKnowledge.chemical,
          eligible: false,
          blockedReason: chemicalBlockedReason,
        },
      },
      safety: {
        identityConfirmationRequired: identityNeedsReview,
        fieldThresholdRequired: true,
        automaticChemicalAction: false,
        message: "Confirm the pest on nearby plants and use only a crop-registered product at its label rate.",
      },
    }

    const record = shouldStore
      ? savePestRecord({
          zoneId,
          crop,
          pestId: primaryKnowledge.id,
          pestName: primaryKnowledge.commonName,
          scientificName: primaryKnowledge.scientificName,
          confidence,
          confidenceBand: band,
          cropMatch,
          predictions,
          imageName: file.name,
          modelId: result.model.modelId,
          modelVersion: result.model.modelVersion,
          farmerConfirmed: false,
        })
      : null

    return NextResponse.json({ ...result, recordId: record?.id ?? null })
  } catch (error) {
    console.error("Pest classification route failed", error)
    const message = error instanceof Error ? error.message : "The pest check could not be completed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
