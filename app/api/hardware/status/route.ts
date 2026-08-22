import { NextResponse } from "next/server"
import { hardwareState, recordControllerFeedback, updateHardwareState } from "../../zones/data"

export async function GET() {
  return NextResponse.json(hardwareState)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (typeof body.killSwitchEngaged === "boolean") {
      updateHardwareState({
        killSwitchEngaged: body.killSwitchEngaged,
        currentAction: body.killSwitchEngaged ? "idle" : hardwareState.currentAction,
      })
    }

    if (body.currentPath) {
      updateHardwareState({ currentPath: Array.isArray(body.currentPath) ? body.currentPath : [] })
    }

    if (body.nozzleStatus === "idle" || body.nozzleStatus === "pending" || body.nozzleStatus === "open" || body.nozzleStatus === "closed" || body.nozzleStatus === "clogged") {
      const zoneId = typeof body.zoneId === "string" ? body.zoneId : hardwareState.activeZoneId
      if (zoneId) {
        recordControllerFeedback(
          zoneId,
          body.nozzleStatus,
          typeof body.feedbackMessage === "string" ? body.feedbackMessage : undefined,
          Array.isArray(body.currentPath) ? body.currentPath : undefined,
        )
      } else {
        updateHardwareState({
          nozzleStatus: body.nozzleStatus,
          awaitingFeedback: body.nozzleStatus === "pending" || body.nozzleStatus === "open",
        })
      }
    }

    if (body.feedbackMessage) {
      updateHardwareState({
        lastFeedback: body.feedbackMessage,
        lastFeedbackAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true, hardwareState })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to update hardware status" }, { status: 500 })
  }
}
