export type RiskSeverity = "low" | "moderate" | "high" | "medium"

export interface AIRecommendation {
  riskType: string
  severity: RiskSeverity
  reason: string
  action: string
  estimatedWaterLitres: number
  estimatedNutrientMl: number
  savingsNote: string
}

export function generateRecommendation(zone: any): AIRecommendation {
  const { soilMoisture, humidity, healthScore, status } = zone

  const idealMoisture = 70
  const moistureGap = idealMoisture - soilMoisture

  let riskType = "Healthy Zone"
  let severity: RiskSeverity = "low"
  let reason = "Environmental conditions are within optimal range."
  let action = "No immediate action required."
  let estimatedWaterLitres = 0
  let estimatedNutrientMl = 0

  // 🌊 Water Optimization Logic
  if (soilMoisture < 60) {
    const zoneArea = 100 // sq meters
estimatedWaterLitres = Math.max(
  2,
  Math.round((moistureGap * 0.5 * zoneArea) / 100)
)

  }

  // 🌿 Nutrient Logic
  if (healthScore < 70) {
    estimatedNutrientMl = Math.max(5, Math.round((70 - healthScore) * 0.6))
  }

  // 🚨 Risk Classification
  if (status === "critical" || soilMoisture < 25 || humidity > 90) {
    riskType = "Severe Water Stress"
    severity = "high"
    reason = "Soil moisture critically low or humidity extremely high."
    action = "Immediate irrigation and nutrient spray required."
  } else if (status === "warning" || soilMoisture < 40 || humidity > 80) {
    riskType = "Moderate Stress"
    severity = "moderate"
    reason = "Moisture imbalance or early stress detected."
    action = "Controlled irrigation recommended."
  }

  const savingsNote =
    estimatedWaterLitres > 0
      ? "Targeted irrigation reduces up to 50% water wastage."
      : "No unnecessary spraying performed."

  return {
    riskType,
    severity,
    reason,
    action,
    estimatedWaterLitres,
    estimatedNutrientMl,
    savingsNote,
  }
}
