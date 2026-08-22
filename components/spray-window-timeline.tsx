"use client"

import { useEffect, useState } from "react"
import { CloudRain, Wind, CheckCircle2, Clock, Loader2 } from "lucide-react"

type Hour = {
  hour: number
  time: string
  safe: boolean
  reason: "safe" | "rain" | "wind"
  windSpeed: number
  rainProbability: number
  precipitation: number
  temperature: number
}
type SprayWindow = {
  source: "live" | "cached" | "fallback"
  safeNow: boolean
  tone: "safe" | "hold"
  headline: string
  nextSafeInHours: number | null
  windowHours: number
  gates: { rainProbabilityPct: number; precipitationMm: number; windKmh: number }
  vpd: { value: number | null; band: string; fresh: boolean }
  hours: Hour[]
}

const barColor = (h: Hour) => (h.reason === "rain" ? "#38bdf8" : h.reason === "wind" ? "#f59e0b" : "#10b981")

function hourLabel(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString([], { hour: "numeric", hour12: true }).replace(" ", "").toLowerCase()
}

export default function SprayWindowTimeline() {
  const [data, setData] = useState<SprayWindow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch("/api/spray-window")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setData(d))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Reading the 48-hour forecast…
      </div>
    )
  }
  if (!data) return null

  const isSafe = data.tone === "safe"
  const total = data.hours.length
  const windowStart = data.nextSafeInHours

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 elevated">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-2xl"
        style={{ background: isSafe ? "radial-gradient(circle, rgba(16,185,129,0.28), transparent 70%)" : "radial-gradient(circle, rgba(245,158,11,0.25), transparent 70%)" }}
      />
      <div className="relative">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Best time to spray · next 48 hours</p>

        {/* Farmer-language verdict first; the technical gates are subtext. */}
        <div className="mt-2 flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSafe ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {isSafe ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
          </div>
          <div>
            <h2 className={`text-2xl font-black leading-tight ${isSafe ? "text-emerald-700" : "text-amber-700"}`}>{data.headline}</h2>
            <p className="mt-1 text-xs text-slate-500">
              From the location forecast ({data.source}). A window is “safe” when wind stays under {data.gates.windKmh} km/h with no rain in the hour
              {data.vpd.value != null ? ` · leaf VPD ${data.vpd.value} kPa (${data.vpd.band})` : ""}.
            </p>
          </div>
        </div>

        {/* 48-hour timeline */}
        <div className="mt-6">
          <div className="flex h-16 w-full items-stretch gap-[2px] overflow-hidden rounded-xl">
            {data.hours.map((h) => (
              <div
                key={h.hour}
                className="group relative flex-1 transition-all"
                style={{ background: barColor(h), opacity: h.safe ? 1 : 0.85 }}
                title={`+${h.hour}h · ${hourLabel(h.time)} · ${h.reason === "safe" ? "safe" : h.reason} · ${h.temperature}°C · wind ${h.windSpeed} km/h · rain ${h.rainProbability}%`}
              >
                {windowStart != null && windowStart > 0 && h.hour === windowStart && (
                  <span className="absolute -top-5 left-0 whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-emerald-700">▼ next window</span>
                )}
              </div>
            ))}
          </div>
          {/* Axis */}
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-400">
            <span>now</span>
            {total > 12 && <span>+12h</span>}
            {total > 24 && <span>+24h</span>}
            {total > 36 && <span>+36h</span>}
            <span>+{total}h</span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Safe to spray</span>
          <span className="flex items-center gap-1.5"><CloudRain className="h-3.5 w-3.5 text-sky-500" /> Rain — wash-off risk</span>
          <span className="flex items-center gap-1.5"><Wind className="h-3.5 w-3.5 text-amber-500" /> Wind — poor coverage</span>
        </div>
      </div>
    </section>
  )
}
