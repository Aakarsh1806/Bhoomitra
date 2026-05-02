import { NextResponse } from "next/server"
import { simulationEnabledRef } from "../zones/data"

export async function POST(req: Request) {
  const body = await req.json()
  const { enabled } = body

  simulationEnabledRef.value = enabled

  return NextResponse.json({
    message: enabled
      ? "Simulation enabled"
      : "Simulation disabled"
  })
}

export async function GET() {
  return NextResponse.json({
    simulationEnabled: simulationEnabledRef.value
  })
}
