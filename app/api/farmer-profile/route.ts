import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { isValidFarmLocation } from "@/app/lib/farmLocation"

const profilePath = path.join(process.cwd(), "app/data/farmer_profile.json")

function readProfile() {
  if (!fs.existsSync(profilePath)) {
    return null
  }

  const raw = fs.readFileSync(profilePath, "utf-8")
  return JSON.parse(raw)
}

export async function GET() {
  try {
    const profile = readProfile()

    if (!profile) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({ exists: true, profile })
  } catch (error) {
    return NextResponse.json({ exists: false, message: "Failed to read profile" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const requiredFields = [
      "farmerName",
      "village",
      "district",
      "acres",
      "totalFarmAreaAcres",
      "primaryCrop",
      "zones",
      "zoneCount",
      "zoneNames",
      "sensorAssignments",
      "farmLocation",
    ]

    const missingField = requiredFields.find((field) => body?.[field] === undefined)
    if (missingField) {
      return NextResponse.json({ success: false, message: `Missing field: ${missingField}` }, { status: 400 })
    }

    if (!isValidFarmLocation(body.farmLocation)) {
      return NextResponse.json({ success: false, message: "Farm location is invalid" }, { status: 400 })
    }

    const profile = {
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), "utf-8")

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to save profile" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const existingProfile = readProfile()
    if (!existingProfile) {
      return NextResponse.json({ success: false, message: "Create the farm profile before setting its location" }, { status: 404 })
    }

    const body = await req.json()
    if (!isValidFarmLocation(body?.farmLocation)) {
      return NextResponse.json({ success: false, message: "Farm location is invalid" }, { status: 400 })
    }

    const profile = {
      ...existingProfile,
      farmLocation: body.farmLocation,
      updatedAt: new Date().toISOString(),
    }

    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), "utf-8")
    return NextResponse.json({ success: true, profile })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to save farm location" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    if (fs.existsSync(profilePath)) {
      fs.unlinkSync(profilePath)
    }

    return NextResponse.json({ success: true, message: "Profile deleted" })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to delete profile" }, { status: 500 })
  }
}
