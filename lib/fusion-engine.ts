// lib/fusion-engine.ts

export type SeverityLevel = "low" | "moderate" | "high" | "uncertain"

export interface FusionResult {
  severityScore: number
  severityLevel: SeverityLevel
}

export function calculateSeverity(
  mlConfidence: number,
  humidity: number,
  temperature: number
): FusionResult {

  // 🔹 Confidence thresholding
  if (mlConfidence < 0.6) {
    return {
      severityScore: mlConfidence,
      severityLevel: "uncertain",
    }
  }

  // 🔹 Humidity factor (0–1 scale)
  const humidityFactor = humidity >= 85
    ? 1
    : humidity >= 70
    ? 0.7
    : humidity >= 50
    ? 0.4
    : 0.2

  // 🔹 Temperature factor (fungal optimal range boost)
  let temperatureFactor = 0.3

  if (temperature >= 18 && temperature <= 25) {
    temperatureFactor = 1
  } else if (temperature >= 26 && temperature <= 30) {
    temperatureFactor = 0.6
  }

  // 🔥 Weighted Fusion Formula
  const severityScore =
    mlConfidence * 0.6 +
    humidityFactor * 0.2 +
    temperatureFactor * 0.2

  let severityLevel: SeverityLevel = "low"

  if (severityScore >= 0.8) {
    severityLevel = "high"
  } else if (severityScore >= 0.6) {
    severityLevel = "moderate"
  }

  return {
    severityScore: Number(severityScore.toFixed(2)),
    severityLevel,
  }
}