import { pesticideDatabase } from "@/app/data/pesticideDatabase"
import { getTelanganaOfflineRecommendation, TELANGANA_OFFLINE_NOTICE } from "@/app/data/telanganaPesticideCatalog"

export type MLPredictionOptions = {
  modelId?: string
  crop?: string
  language?: string
}

const ML_SERVICE_URL = process.env.NEXT_PUBLIC_ML_SERVICE_URL ?? "http://127.0.0.1:5000"

export function normalizeDiseaseLabel(disease: string) {
  const rawValue = Array.isArray(disease) ? disease.join(" ") : disease || ""

  return rawValue
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/__+/g, "_")
    .trim()
}

export async function runMLPrediction(file: File, options: MLPredictionOptions = {}) {
  const formData = new FormData()
  formData.append("file", file)

  if (options.modelId) {
    formData.append("modelId", options.modelId)
  }

  if (options.crop) {
    formData.append("crop", options.crop)
  }

  if (options.language) {
    formData.append("language", options.language)
  }

  const response = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: "POST",
    body: formData,
  })

  const data = await response.json()
  return data
}

export function calculateSeverity(
  confidence: number,
  disease?: string,
): { level: "low" | "moderate" | "high"; score: number } {
  const normalizedDisease = normalizeDiseaseLabel(disease || "")
  if (normalizedDisease.includes("healthy")) {
    return { level: "low", score: 0 }
  }

  if (confidence > 0.75) return { level: "high", score: 3 }
  if (confidence > 0.45) return { level: "moderate", score: 2 }
  return { level: "low", score: 1 }
}

export function getTreatmentOptions(disease: string, crop?: string) {
  const normalizedDisease = normalizeDiseaseLabel(disease)

  if (normalizedDisease.includes("healthy")) {
    return {
      chemicals: [],
      organic: ["Continue crop scouting, balanced irrigation and field sanitation."],
      offlineRecommendation: null,
      notice: "Healthy prediction: no pesticide treatment is recommended. Continue routine scouting and crop care.",
    }
  }

  const telanganaRecommendation = getTelanganaOfflineRecommendation(disease, crop)

  if (telanganaRecommendation) {
    return {
      chemicals: [{
        chemicalName: `${telanganaRecommendation.activeIngredient} ${telanganaRecommendation.formulation}`.trim(),
        type: telanganaRecommendation.category,
        dosage: telanganaRecommendation.dosage,
        sprayInterval: telanganaRecommendation.sprayInterval,
        safetyNote: telanganaRecommendation.safetyNote,
        preHarvestInterval: telanganaRecommendation.preHarvestInterval,
        resistanceGroup: telanganaRecommendation.resistanceGroup,
      }],
      organic: [telanganaRecommendation.organicAlternative],
      offlineRecommendation: telanganaRecommendation,
      notice: telanganaRecommendation.verificationNotice,
    }
  }

  const chemicals = pesticideDatabase.filter(p =>
    p.type !== "Organic" && p.approvedFor.some(approvedFor => normalizeDiseaseLabel(approvedFor).includes(normalizedDisease))
  )

  const organicEntries = pesticideDatabase.filter(p =>
    p.type === "Organic" && 
    (p.approvedFor.some(approvedFor => normalizeDiseaseLabel(approvedFor).includes(normalizedDisease)) || p.approvedFor.some(approvedFor => normalizeDiseaseLabel(approvedFor).includes("any_healthy")))
  )

  const organic = organicEntries.length > 0 
    ? organicEntries.map(p => `${p.chemicalName} (${p.dosage})`)
    : [
        "Neem Oil (3-5 ml/L)",
        "Trichoderma bio-fungicide",
        "Liquid seaweed extract"
      ]

  return {
    chemicals,
    organic,
    offlineRecommendation: null,
    notice: `Using best-match offline IPM recommendation from our broader disease database. ${TELANGANA_OFFLINE_NOTICE}`,
  }
}
