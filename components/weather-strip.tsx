"use client"

import { useEffect, useState } from "react"
import {
  Cloud,
  CloudRain,
  CloudSun,
  Sun,
  CloudFog,
  Zap,
  Droplets,
  Wind,
  SprayCan,
  Bug,
  Loader2,
  Wifi,
  WifiOff,
  Database,
} from "lucide-react"
import type { WeatherForecast } from "@/app/lib/weatherService"

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code === 0 || code === 1) return <Sun className={className} />
  if (code === 2) return <CloudSun className={className} />
  if (code === 3) return <Cloud className={className} />
  if (code === 45 || code === 48) return <CloudFog className={className} />
  if (code >= 95) return <Zap className={className} />
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className={className} />
  return <CloudSun className={className} />
}

function SourceBadge({ source }: { source: WeatherForecast["source"] }) {
  const map = {
    live: { icon: <Wifi className="h-3 w-3" />, label: "Live", cls: "bg-green-100 text-green-700 border-green-200" },
    cached: { icon: <Database className="h-3 w-3" />, label: "Cached", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    fallback: { icon: <WifiOff className="h-3 w-3" />, label: "Refresh needed", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  }
  const m = map[source]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  )
}

export default function WeatherStrip({ className = "" }: { className?: string }) {
  const [data, setData] = useState<WeatherForecast | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch("/api/weather/forecast")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d && d.current) setData(d)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <div className={`flex items-center gap-3 rounded-2xl border border-green-100 bg-white p-5 shadow-sm ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-green-600" />
        <span className="text-sm font-medium text-[#4a634f]">Loading local farm forecast…</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-800 ${className}`}>
        Checking the forecast connection. The farm map continues to show the latest soil readings.
      </div>
    )
  }

  // The fallback is a demo-safe placeholder, not a weather observation. Do
  // not present its synthetic rain/temperature values as real farm weather.
  if (data.source === "fallback") {
    const locationMessage = data.location.isConfigured
      ? `The regional forecast is reconnecting for ${data.location.name}.`
      : "Set your farm location to activate a local forecast."

    return (
      <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm ${className}`}>
        <div className="flex items-center gap-2 font-bold text-amber-900">
          <WifiOff className="h-4 w-4" /> Regional forecast is reconnecting
        </div>
        <p className="mt-1 text-amber-800">
          {locationMessage} Spray commands remain weather-held. Irrigation guidance uses the latest soil moisture until a current forecast returns.
        </p>
      </div>
    )
  }

  const { current, derived, location } = data
  const checkedAt = new Date(data.fetchedAt)
  const checkedLabel = Number.isNaN(checkedAt.getTime())
    ? "update time pending"
    : `updated ${checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  const pressureColor =
    derived.fungalPressure.band === "high"
      ? "text-red-600"
      : derived.fungalPressure.band === "moderate"
        ? "text-amber-600"
        : "text-green-600"

  const rainText =
    derived.nextRainHours === null
      ? "No rain expected in the next 2 days"
      : derived.nextRainHours === 0
        ? "Rain right now"
        : `Rain likely in ~${derived.nextRainHours}h`

  const rainNow = current.precipitation >= 0.1
  const sprayText = derived.sprayWindow.safeNow
    ? "Safe to spray now"
    : derived.sprayWindow.nextSafeInHours === null
      ? "No clear spray window ahead"
      : rainNow
        ? `Hold now - earliest dry window ~${derived.sprayWindow.nextSafeInHours}h`
        : `Hold now - dry window ~${derived.sprayWindow.nextSafeInHours}h`

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-green-100 bg-gradient-to-br from-white via-[#f6fbf7] to-white shadow-sm ${className}`}>
      <div className="flex flex-1 flex-col p-5">
        {/* Current conditions — the prominent, top-of-card focal point */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-600">
            <WeatherIcon code={current.weatherCode} className="h-9 w-9" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-4xl font-black leading-none text-[#1a2e1d]">{current.temperature}°C</span>
              <SourceBadge source={data.source} />
            </div>
            <div className="mt-1 text-base font-semibold text-[#4a634f]">
              {current.description} · {location.name}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-4 text-sm text-[#5a7a60]">
              <span className="flex items-center gap-1">
                <Droplets className="h-4 w-4" /> {current.humidity}%
              </span>
              <span className="flex items-center gap-1">
                <Wind className="h-4 w-4" /> {current.windSpeed} km/h
              </span>
              <span>{checkedLabel}</span>
            </div>
          </div>
        </div>

        {/* Agronomic signals — full-width, evenly sized cards; grows to fill the row's stretched height */}
        <div className="mt-4 grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="flex flex-col justify-center gap-1 rounded-xl border border-green-100 bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-green-700">
              <CloudRain className="h-4 w-4" /> Rainfall
            </div>
            <div className="text-base font-bold leading-snug text-[#1a2e1d]">{rainText}</div>
          </div>
          <div className="flex flex-col justify-center gap-1 rounded-xl border border-green-100 bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-green-700">
              <SprayCan className="h-4 w-4" /> Spray Window
            </div>
            <div className="text-base font-bold leading-snug text-[#1a2e1d]">{sprayText}</div>
          </div>
          <div className="flex flex-col justify-center gap-1 rounded-xl border border-green-100 bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-green-700">
              <Bug className="h-4 w-4" /> Disease Pressure
            </div>
            <div className={`text-base font-bold capitalize leading-snug ${pressureColor}`}>
              {derived.fungalPressure.band} ({derived.fungalPressure.score})
            </div>
          </div>
        </div>
      </div>
      {rainNow && (
        <div className="border-t border-sky-100 bg-sky-50 px-5 py-2.5 text-sm font-medium text-sky-900">
          Spray is held during rain. The dry-window estimate begins after rainfall; check the product label's rainfastness requirement before applying.
        </div>
      )}
    </div>
  )
}
