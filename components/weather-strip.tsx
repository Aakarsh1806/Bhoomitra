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
    fallback: { icon: <WifiOff className="h-3 w-3" />, label: "Offline", cls: "bg-amber-100 text-amber-700 border-amber-200" },
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
        Weather forecast is temporarily unavailable.
      </div>
    )
  }

  // The fallback is a demo-safe placeholder, not a weather observation. Do
  // not present its synthetic rain/temperature values as real farm weather.
  if (data.source === "fallback") {
    const locationMessage = data.location.isConfigured
      ? `Live weather is temporarily unavailable for ${data.location.name}.`
      : "Set your farm location to activate a local forecast."

    return (
      <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm ${className}`}>
        <div className="flex items-center gap-2 font-bold text-amber-900">
          <WifiOff className="h-4 w-4" /> Live forecast unavailable
        </div>
        <p className="mt-1 text-amber-800">
          {locationMessage} Rain and spray advice are paused; the farm map will use soil moisture only for irrigation until a live forecast is available.
        </p>
      </div>
    )
  }

  const { current, derived, location } = data
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

  const sprayText = derived.sprayWindow.safeNow
    ? "Safe to spray now"
    : derived.sprayWindow.nextSafeInHours === null
      ? "No clear spray window ahead"
      : `Best spray window in ~${derived.sprayWindow.nextSafeInHours}h`

  return (
    <div className={`overflow-hidden rounded-2xl border border-green-100 bg-gradient-to-br from-white via-[#f6fbf7] to-white shadow-sm ${className}`}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Current conditions */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-600">
            <WeatherIcon code={current.weatherCode} className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-[#1a2e1d]">{current.temperature}°C</span>
              <SourceBadge source={data.source} />
            </div>
            <div className="text-sm font-medium text-[#4a634f]">
              {current.description} · {location.name}
            </div>
            <div className="mt-1 flex items-center gap-4 text-xs text-[#5a7a60]">
              <span className="flex items-center gap-1">
                <Droplets className="h-3.5 w-3.5" /> {current.humidity}%
              </span>
              <span className="flex items-center gap-1">
                <Wind className="h-3.5 w-3.5" /> {current.windSpeed} km/h
              </span>
            </div>
          </div>
        </div>

        {/* Agronomic signals derived from the forecast */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-xl border border-green-100 bg-white px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
              <CloudRain className="h-3.5 w-3.5" /> Rainfall
            </div>
            <div className="mt-0.5 text-sm font-bold text-[#1a2e1d]">{rainText}</div>
          </div>
          <div className="rounded-xl border border-green-100 bg-white px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
              <SprayCan className="h-3.5 w-3.5" /> Spray Window
            </div>
            <div className="mt-0.5 text-sm font-bold text-[#1a2e1d]">{sprayText}</div>
          </div>
          <div className="rounded-xl border border-green-100 bg-white px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
              <Bug className="h-3.5 w-3.5" /> Disease Pressure
            </div>
            <div className={`mt-0.5 text-sm font-bold capitalize ${pressureColor}`}>
              {derived.fungalPressure.band} ({derived.fungalPressure.score})
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
