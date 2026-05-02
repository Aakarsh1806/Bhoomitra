import { Severity, DiseaseType } from "../lib/automation-context"

/**
 * Maps a disease name to its pathogen type.
 */
export function inferDiseaseType(disease: string): DiseaseType {
  const lower = disease.toLowerCase()
  if (lower.includes("healthy")) return "Healthy"
  if (lower.includes("virus")) return "Viral"
  if (lower.includes("bacterial")) return "Bacterial"
  // Fungal is the most common fallback for typical plant diseases like rot, spots, rust, etc.
  if (
    lower.includes("blight") ||
    lower.includes("spot") ||
    lower.includes("rot") ||
    lower.includes("rust") ||
    lower.includes("mildew") ||
    lower.includes("scab") ||
    lower.includes("mold")
  ) {
    return "Fungal"
  }
  return "Healthy"
}

/**
 * Suggests a pesticide and dosage based on disease type and severity.
 */
export function mapDiseaseToSpray(disease: string, severity: Severity) {
  const type = inferDiseaseType(disease)
  
  let chemical = "N/A"
  let dosage = 0

  if (type === "Fungal") chemical = "Broad-spectrum Fungicide"
  else if (type === "Bacterial") chemical = "Bactericide (Streptomycin)"
  else if (type === "Viral") chemical = "Neem Oil / Organic Treatment"

  switch (severity) {
    case "low": dosage = 30; break
    case "moderate":
    case "medium":
      dosage = 60
      break
    case "high": dosage = 85; break
  }

  return { chemical, dosage, type }
}

/**
 * Service to execute auto-spray logic.
 */
export const sprayAutomation = {
  getRecommendation: (disease: string, severity: Severity) => {
    return mapDiseaseToSpray(disease, severity)
  },
}
