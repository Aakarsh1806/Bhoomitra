import { NextResponse } from "next/server"
import {
  hardwareState,
  updateHardwareState,
  getHydrationCandidates,
  startIrrigationCycle,
  setGlobalHydrateRequest,
} from "../zones/data"

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

  const targetedIds = candidates.targeted.map(zone => zone.id)

  // Single-pump compatible path: queue one physical cycle on the first targeted zone,
  // while still reporting all targeted grids for UI intelligence.
  const controllerZone = targetedIds[0]
  const started = startIrrigationCycle(controllerZone, true)

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
    pumpControllerZone: controllerZone,
  })
}
