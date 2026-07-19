import { NextResponse } from "next/server"
import { getForecast } from "@/app/lib/weatherService"

// Live forecast for the farm location, cached server-side (30 min) with an
// offline fallback so the demo never breaks. `?force=1` bypasses the cache.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const force = url.searchParams.get("force") === "1"
    const forecast = await getForecast(force)
    return NextResponse.json(forecast)
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Failed to load forecast" },
      { status: 500 }
    )
  }
}
