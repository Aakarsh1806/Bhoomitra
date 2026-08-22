import { NextResponse } from "next/server"

/**
 * Retained only so old clients receive a clear, safe response. The prototype
 * has one irrigation pump and demonstrates individual A1-A4 pulse plans; a
 * whole-farm command would misrepresent that physical setup.
 */
export async function POST() {
  return NextResponse.json(
    {
      message: "Global irrigation is not available in this prototype. Choose an A1-A4 zone and queue its three-second water pulses individually.",
      retired: true,
    },
    { status: 410 },
  )
}
