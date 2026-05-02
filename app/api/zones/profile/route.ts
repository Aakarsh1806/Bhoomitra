import { NextResponse } from "next/server"
import { farmProfile, updateFarmProfile } from "../data"

export async function GET() {
  return NextResponse.json(farmProfile)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const acres = Number(body?.acres)
    const zoneSizeAcres = body?.zoneSizeAcres !== undefined ? Number(body.zoneSizeAcres) : 0.25

    if (!Number.isFinite(acres) || acres < 2 || acres > 10) {
      return NextResponse.json({ message: "acres must be between 2 and 10" }, { status: 400 })
    }

    if (!Number.isFinite(zoneSizeAcres) || zoneSizeAcres <= 0) {
      return NextResponse.json({ message: "zoneSizeAcres must be a positive number" }, { status: 400 })
    }

    const updated = updateFarmProfile(acres, zoneSizeAcres)
    return NextResponse.json({ success: true, profile: updated })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
  }
}
