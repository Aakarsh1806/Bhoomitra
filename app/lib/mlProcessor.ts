import { pesticideDatabase } from "@/app/data/pesticideDatabase"

export async function runMLPrediction(file: File) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("http://127.0.0.1:5000/predict", {
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
  const normalizedDisease = (disease || "").toLowerCase()
  if (normalizedDisease.includes("healthy")) {
    return { level: "low", score: 0 }
  }

  if (confidence > 0.75) return { level: "high", score: 3 }
  if (confidence > 0.45) return { level: "moderate", score: 2 }
  return { level: "low", score: 1 }
}

export function getTreatmentOptions(disease: string) {
  const chemicals = pesticideDatabase.filter(p =>
    p.type !== "Organic" && p.approvedFor.includes(disease)
  )

  const organicEntries = pesticideDatabase.filter(p =>
    p.type === "Organic" && 
    (p.approvedFor.includes(disease) || p.approvedFor.includes("Any___Healthy"))
  )

  const organic = organicEntries.length > 0 
    ? organicEntries.map(p => `${p.chemicalName} (${p.dosage})`)
    : [
        "Neem Oil (3-5 ml/L)",
        "Trichoderma bio-fungicide",
        "Liquid seaweed extract"
      ]

  return { chemicals, organic }
}