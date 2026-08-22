import { NextResponse } from "next/server"
import { getForecast } from "@/app/lib/weatherService"
import { getFarmClimate } from "@/app/api/zones/data"

// Prescriptive spray-window intelligence: the next 48 hours classified hour by
// hour into safe-to-spray vs. hold, from the real forecast, plus a plain
// farmer-language verdict. Read-only, always fresh.
export const dynamic = "force-dynamic"

const RAIN_PROB_GATE = 40 // %
const PRECIP_GATE = 0.2 // mm
const WIND_GATE = 15 // km/h — the app's spray wind cutoff

export async function GET() {
  const weather = await getForecast()
  const climate = getFarmClimate()

  const hours = weather.hourly.slice(0, 48).map((h, index) => {
    const rainy = h.rainProbability >= RAIN_PROB_GATE || h.precipitation >= PRECIP_GATE
    const windy = h.windSpeed >= WIND_GATE
    const safe = !rainy && !windy
    return {
      hour: index,
      time: h.time,
      safe,
      reason: rainy ? "rain" : windy ? "wind" : "safe",
      windSpeed: Math.round(h.windSpeed),
      rainProbability: Math.round(h.rainProbability),
      precipitation: Number(h.precipitation.toFixed(1)),
      temperature: Math.round(h.temperature),
    }
  })

  // Next usable window = first run of >= 3 consecutive safe hours.
  let windowStart: number | null = null
  for (let i = 0; i + 2 < hours.length; i++) {
    if (hours[i].safe && hours[i + 1].safe && hours[i + 2].safe) {
      windowStart = i
      break
    }
  }
  let windowHours = 0
  if (windowStart !== null) {
    for (let i = windowStart; i < hours.length && hours[i].safe; i++) windowHours++
  }

  const safeNow = hours[0]?.safe ?? false
  const firstReason = hours[0]?.reason
  const whyNot = firstReason === "rain" ? "rain is expected" : firstReason === "wind" ? "winds are too strong" : "conditions are unsuitable"

  // Farmer-language verdict FIRST; the technical gates are subtext in the UI.
  let headline: string
  let tone: "safe" | "hold"
  if (safeNow) {
    tone = "safe"
    headline = `Spray now — the weather is clear for about the next ${windowHours || 1} hour${(windowHours || 1) === 1 ? "" : "s"}.`
  } else if (windowStart !== null) {
    tone = "hold"
    const when = windowStart === 0 ? "shortly" : `in about ${windowStart} hour${windowStart === 1 ? "" : "s"}`
    headline = `Hold off — ${whyNot} right now. Your next good window opens ${when}.`
  } else {
    tone = "hold"
    headline = `Hold off — ${whyNot}, and there is no clear 3-hour window in the next two days.`
  }

  return NextResponse.json({
    source: weather.source,
    safeNow,
    tone,
    headline,
    nextSafeInHours: windowStart,
    windowHours,
    gates: { rainProbabilityPct: RAIN_PROB_GATE, precipitationMm: PRECIP_GATE, windKmh: WIND_GATE },
    vpd: { value: climate.vpd, band: climate.vpdBand, fresh: climate.fresh },
    hours,
  })
}
