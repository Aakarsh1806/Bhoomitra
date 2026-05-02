import { NextResponse } from "next/server"
import { irrigationSettings, updateIrrigationSettings } from "../zones/data"

export async function GET() {
  return NextResponse.json(irrigationSettings)
}

export async function POST(req: Request) {
  const body = await req.json()

  const next = updateIrrigationSettings({
    dryThreshold: body?.dryThreshold,
    wetThreshold: body?.wetThreshold,
    ripeningMode: typeof body?.ripeningMode === "boolean" ? body.ripeningMode : undefined,
    singlePumpMode: typeof body?.singlePumpMode === "boolean" ? body.singlePumpMode : undefined,
  })

  return NextResponse.json({ success: true, settings: next })
}
