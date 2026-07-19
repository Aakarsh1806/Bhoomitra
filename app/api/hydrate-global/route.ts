import { NextResponse } from "next/server"
import {
  hardwareState,
  updateHardwareState,
  getHydrationCandidates,
  startIrrigationCycle,
  setGlobalHydrateRequest,
  irrigationSettings,
  getFarmClimate,
} from "../zones/data"
import { getForecast } from "@/app/lib/weatherService"
import { decideFarmActions } from "@/app/lib/farmDecisionService"

export async function POST() {
  if (hardwareState.killSwitchEngaged) {
    return NextResponse.json({ message: "Safety kill switch is engaged" }, { status: 423 })
  }

  const candidates = getHydrationCandidates()
  if (candidates.disabled) {
    return NextResponse.json(
      {
        message: candidates.reason || "Global hydrate not available",
        targetedZones: [],
        ignoredZones: candidates.ignored,
      },
      { status: 409 }
    )
  }

  const weather = await getForecast()
  const climate = getFarmClimate()
  const evaluated = candidates.targeted.map(zone => ({
    zone,
    decision: decideFarmActions({
      soilMoisture: zone.soilMoisture,
      dryThreshold: irrigationSettings.dryThreshold,
      climate,
      weather,
    }),
  }))
  const actionable = evaluated.filter(item => item.decision.irrigation.allowsStart)
  const deferred = evaluated.filter(item => !item.decision.irrigation.allowsStart)

  if (actionable.length === 0) {
    return NextResponse.json(
      {
        message: deferred[0]?.decision.irrigation.reason || "Weather conditions defer global hydration.",
        targetedZones: [],
        deferredZones: deferred.map(item => item.zone.id),
        ignoredZones: candidates.ignored,
      },
      { status: 409 },
    )
  }

  const targetedIds = actionable.map(item => item.zone.id)

  // Single-pump compatible path: queue one physical cycle on the first targeted zone,
  // while still reporting all targeted grids for UI intelligence.
  const controllerZone = targetedIds[0]
  const started = startIrrigationCycle(controllerZone, true, actionable[0].decision.irrigation)

  if (!started.started) {
    return NextResponse.json({ message: `Global hydrate failed: ${started.reason}` }, { status: 409 })
  }

  setGlobalHydrateRequest({
    requestedAt: new Date().toISOString(),
    targetedZones: targetedIds,
    pumpControllerZone: controllerZone,
  })

  updateHardwareState({
    currentAction: "hydrate",
    activeZoneId: controllerZone,
    currentPath: targetedIds,
    nozzleStatus: "pending",
    lastCommand: `hydrate-global:${controllerZone}`,
    lastCommandAt: new Date().toISOString(),
    awaitingFeedback: true,
  })

  return NextResponse.json({
    message: `Global hydration started using controller zone ${controllerZone}`,
    targetedZones: targetedIds,
    ignoredZones: candidates.ignored,
    deferredZones: deferred.map(item => item.zone.id),
    pumpControllerZone: controllerZone,
  })
}
