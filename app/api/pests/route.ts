import { NextResponse } from "next/server"
import { listPestRecords, updatePestRecord } from "@/app/lib/pestRecords"

export const dynamic = "force-dynamic"

export async function GET() {
  const records = listPestRecords()
  const now = Date.now()
  const active = records.filter((record) => record.status !== "resolved")
  const increasing = records.filter((record) => record.status === "increasing")
  const followUpsDue = active.filter((record) => Date.parse(record.followUpDue) <= now)

  return NextResponse.json({
    records: records.slice(0, 50),
    summary: {
      total: records.length,
      active: active.length,
      increasing: increasing.length,
      followUpsDue: followUpsDue.length,
    },
  })
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const id = String(body?.id || "").trim()
    const status = String(body?.status || "").trim()
    const allowed = ["monitoring", "improving", "increasing", "resolved"] as const

    if (!id || !allowed.includes(status as typeof allowed[number])) {
      return NextResponse.json({ error: "Choose a valid follow-up outcome." }, { status: 400 })
    }

    const updated = updatePestRecord(
      id,
      status as typeof allowed[number],
      body?.outcomeNote ? String(body.outcomeNote) : null,
      typeof body?.farmerConfirmed === "boolean" ? body.farmerConfirmed : undefined,
    )
    if (!updated) {
      return NextResponse.json({ error: "The pest observation was not found." }, { status: 404 })
    }

    return NextResponse.json({ success: true, record: updated })
  } catch (error) {
    console.error("Update pest result failed", error)
    return NextResponse.json({ error: "The pest follow-up could not be saved." }, { status: 500 })
  }
}
