import { NextResponse } from "next/server"
import { hardwareState, updateHardwareState, recordActivity, startIrrigationCycle } from "../zones/data"

export async function POST(req: Request) {
  const { zoneId } = await req.json()
  
  if (hardwareState.killSwitchEngaged) {
    return NextResponse.json({ message: "Safety kill switch is engaged" }, { status: 423 })
  }
  
  if (!zoneId) {
    return NextResponse.json({ message: "Zone ID is required" }, { status: 400 })
  }

  const start = startIrrigationCycle(zoneId)
  if (!start.started) {
    return NextResponse.json({ message: `Hydration skipped for ${zoneId}: ${start.reason}` }, { status: 409 })
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

  return NextResponse.json({ message: `Hydration cycle started for zone ${zoneId}` })
}
