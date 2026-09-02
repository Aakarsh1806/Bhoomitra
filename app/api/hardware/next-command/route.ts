import { NextResponse } from "next/server"
import { dispatchNextPendingCommand, hardwareState } from "../../zones/data"

/**
 * Polled directly by hardware_bridge.py on its own timer, independent of the
 * ESP32's sensor-push cycle — see dispatchNextPendingCommand for why that
 * independence is required (only A1 has a real soil probe).
 */
export async function GET() {
  if (hardwareState.killSwitchEngaged) {
    return NextResponse.json({ zoneId: null, command: null, remainingQueue: 0 })
  }
  const result = dispatchNextPendingCommand()
  return NextResponse.json(result)
}
