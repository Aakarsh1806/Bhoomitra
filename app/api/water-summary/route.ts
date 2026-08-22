import { NextResponse } from "next/server"
import { zones, irrigationSettings } from "@/app/api/zones/data"
import { readDB } from "@/app/lib/database"
import { summarizeWater } from "@/app/lib/waterLedger"
import { getCurrentFarmId } from "@/app/lib/farmContext"
import { getIrrigationPulsePlan, DEMO_CONTROL_ZONE_IDS } from "@/app/lib/demoHardware"
import { estimatePulseLitres, FLOW_CALIBRATED, FLOW_SOURCE_LABEL } from "@/app/lib/flowModel"

// Live water intelligence for the current farm. Read-only; reflects the live
// ledger and soil readings, so never cache it.
export const dynamic = "force-dynamic"

// A naive "broadcast" cycle waters every pilot zone the same fixed amount,
// ignoring the sensors. Targeted irrigation only waters zones actually below
// the dry threshold — the difference is the honest, sensor-driven saving.
const BROADCAST_CYCLE_PULSES = 3

export async function GET() {
  const farmId = getCurrentFarmId()
  const db = readDB()

  // Season-to-date, from the real logged ledger (farmId-scoped).
  const season = summarizeWater(db.waterLog || [], farmId)

  // Targeted vs. broadcast on the live A1–A4 pilot block. This is a comparison
  // projection from real soil readings + the flow model, not a measurement.
  const pilotZones = zones.filter((zone) => (DEMO_CONTROL_ZONE_IDS as readonly string[]).includes(zone.id))
  let targetedLitres = 0
  const targetedZoneIds: string[] = []
  for (const zone of pilotZones) {
    const plan = getIrrigationPulsePlan(zone.soilMoisture, irrigationSettings.dryThreshold)
    if (plan.pulses > 0) {
      targetedLitres += estimatePulseLitres(plan.pulses) || 0
      targetedZoneIds.push(zone.id)
    }
  }
  const broadcastLitres = (estimatePulseLitres(BROADCAST_CYCLE_PULSES) || 0) * pilotZones.length
  const savedLitres = Math.max(0, broadcastLitres - targetedLitres)
  const savedPercent = broadcastLitres > 0 ? Math.round((savedLitres / broadcastLitres) * 100) : 0

  return NextResponse.json({
    farmId,
    calibrated: FLOW_CALIBRATED,
    volumeSource: FLOW_SOURCE_LABEL,
    season,
    targetedVsBroadcast: {
      targetedLitres: Math.round(targetedLitres * 10) / 10,
      broadcastLitres: Math.round(broadcastLitres * 10) / 10,
      savedLitres: Math.round(savedLitres * 10) / 10,
      savedPercent,
      targetedZoneIds,
      pilotZoneCount: pilotZones.length,
      broadcastCyclePulses: BROADCAST_CYCLE_PULSES,
      basis: `Targeted irrigation vs. a fixed ${BROADCAST_CYCLE_PULSES}-pulse cycle to all ${pilotZones.length} pilot zones. Estimated (conservative), not metered.`,
    },
  })
}
