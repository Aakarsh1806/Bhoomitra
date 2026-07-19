import { NextResponse } from "next/server"
import {
  hardwareState,
  updateHardwareState,
  recordActivity,
  startIrrigationCycle,
  zones,
  irrigationSettings,
  getFarmClimate,
} from "../zones/data"
import { getForecast } from "@/app/lib/weatherService"
import { decideFarmActions } from "@/app/lib/farmDecisionService"

export async function POST(req: Request) {
  const { zoneId } = await req.json()
  
  if (hardwareState.killSwitchEngaged) {
    return NextResponse.json({ message: "Safety kill switch is engaged" }, { status: 423 })
  }
  
  if (!zoneId) {
    return NextResponse.json({ message: "Zone ID is required" }, { status: 400 })
  }

  const zone = zones.find(item => item.id === zoneId)
  if (!zone) {
    return NextResponse.json({ message: "Zone not found" }, { status: 404 })
  }

  const weather = await getForecast()
  const decision = decideFarmActions({
    soilMoisture: zone.soilMoisture,
    dryThreshold: irrigationSettings.dryThreshold,
    climate: getFarmClimate(),
    weather,
  })

  const start = startIrrigationCycle(zoneId, false, decision.irrigation)
  if (!start.started) {
    return NextResponse.json(
      { message: decision.irrigation.reason || `Hydration skipped for ${zoneId}: ${start.reason}`, decision },
      { status: 409 },
    )
  }

  updateHardwareState({
    currentAction: "hydrate",
    activeZoneId: zoneId,
    currentPath: [zoneId],
    nozzleStatus: "pending",
    lastCommand: `hydrate:${zoneId}`,
    lastCommandAt: new Date().toISOString(),
    awaitingFeedback: true,
  })

  // Log the activity
  recordActivity({ type: "water", zoneId })

  return NextResponse.json({ message: `Hydration cycle started for zone ${zoneId}`, decision })
}
