import { NextResponse } from "next/server"
import { resetDetectionData } from "@/app/api/zones/data"

export async function POST() {
  const result = resetDetectionData()
  return NextResponse.json({
    success: true,
    message: "Detection data cleared. Zones now reflect soil-moisture status only.",
    ...result,
  })
}
