import { NextResponse } from "next/server"
import { zones, farmProfile, getFarmClimate } from "@/app/api/zones/data"
import { readDB } from "@/app/lib/database"
import { getForecast } from "@/app/lib/weatherService"
import { buildSpreadPlan } from "@/app/lib/spreadEngine"
import { projectYieldImpact } from "@/app/lib/yieldModel"

// Live farm-impact intelligence: the confident, defensible metrics —
// disease pressure (real), infections avoided (spread projection), and yield
// protected (research projection). Read-only, always fresh.
export const dynamic = "force-dynamic"

export async function GET() {
  const db = readDB()
  const [weather, climate] = await Promise.all([getForecast(), Promise.resolve(getFarmClimate())])

  // 1) Disease pressure — real, weather-driven.
  const pressure = weather.derived.fungalPressure

  // 2) Infections avoided — spread model, do-nothing vs. protect (projection).
  const plan = buildSpreadPlan({
    zones: zones.map((zone) => ({
      id: zone.id,
      row: zone.row,
      col: zone.col,
      soilMoisture: zone.soilMoisture,
      disease: zone.disease,
      severityLevel: zone.severityLevel,
      severityScore: zone.severityScore,
      mlConfidence: zone.mlConfidence,
    })),
    detections: db.detections || [],
    weather,
    climate: { fresh: climate.fresh, humidity: climate.humidity, temperature: climate.temperature, vpd: climate.vpd },
    days: 5,
    budget: 2,
  })
  const infectionsAvoided = Math.max(0, plan.baseline.finalExpectedInfected - plan.protected.finalExpectedInfected)

  // 3) Yield — research projection from active detections.
  const yieldImpact = projectYieldImpact(db.detections || [])

  // 4) Coverage — real farm geometry.
  const coverage = {
    acres: farmProfile.acres,
    zoneCount: (farmProfile as any).zoneCount ?? zones.length,
    monitoredZones: zones.length,
  }

  return NextResponse.json({
    diseasePressure: {
      score: pressure.score,
      band: pressure.band,
      drivers: pressure.drivers,
      label: "Weather-driven fungal-pressure model",
    },
    infectionsAvoided: {
      value: Math.round(infectionsAvoided * 10) / 10,
      baseline: Math.round(plan.baseline.finalExpectedInfected * 10) / 10,
      protectedOutcome: Math.round(plan.protected.finalExpectedInfected * 10) / 10,
      label: "Model projection · do-nothing vs. protect bottlenecks, day 5",
    },
    yield: yieldImpact,
    coverage,
  })
}
