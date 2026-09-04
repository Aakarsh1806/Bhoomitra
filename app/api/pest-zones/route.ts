import { NextResponse } from "next/server"
import { listPestZoneObservations, confirmNoPests } from "@/app/lib/pestZoneHistory"
import { getCurrentUser } from "@/app/lib/session"

export const dynamic = "force-dynamic"

export async function GET() {
  const current = getCurrentUser()
  if (!current || current.blocked) return NextResponse.json({ error: "Sign in to view zone history." }, { status: current ? 403 : 401 })
  return NextResponse.json({ observations: listPestZoneObservations() }, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(request: Request) {
  try {
    const current = getCurrentUser()
    if (!current || current.blocked) return NextResponse.json({ error: "Sign in to update zone history." }, { status: current ? 403 : 401 })
    const body = await request.json()
    if (body?.fieldCheckedNoPests !== true || typeof body?.observationId !== "string") {
      return NextResponse.json({ error: "Confirm that you inspected the plants first." }, { status: 400 })
    }
    return NextResponse.json({ observation: confirmNoPests(body.observationId) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save field confirmation." }, { status: 409 })
  }
}
