import fs from "fs"
import path from "path"
import { toForecastLocation, type ForecastLocation } from "@/app/lib/farmLocation"

/**
 * Weather service — Open-Meteo (free, no API key) with in-memory cache + offline fallback.
 *
 * This is the foundation layer that makes Bhoomitra "weather-aware": the disease
 * recommendation engine and the spread-control model both consume the derived
 * signals below (spray window, fungal pressure, next rain) to make smarter calls.
 *
 * Design goals:
 *  - Never break the demo: a 5s fetch timeout, an in-memory cache, and a
 *    deterministic realistic fallback mean a dead venue Wi-Fi degrades gracefully.
 *  - Honest: `source` tells callers whether the data is live, cached, or fallback,
 *    so the UI can label it truthfully instead of pretending offline data is live.
 */

const farmerProfilePath = path.join(process.cwd(), "app/data/farmer_profile.json")

export function getWeatherLocation(): ForecastLocation {
  try {
    if (!fs.existsSync(farmerProfilePath)) return toForecastLocation(null)
    const profile = JSON.parse(fs.readFileSync(farmerProfilePath, "utf-8"))
    return toForecastLocation(profile?.farmLocation)
  } catch {
    return toForecastLocation(null)
  }
}

export interface HourlyForecast {
  time: string // ISO timestamp
  temperature: number // °C
  humidity: number // %
  rainProbability: number // %
  precipitation: number // mm
  windSpeed: number // km/h
}

export interface CurrentWeather {
  temperature: number // °C
  humidity: number // %
  precipitation: number // mm (last hour)
  windSpeed: number // km/h
  weatherCode: number // WMO code
  description: string
  isDay: boolean
}

export interface WeatherDerived {
  /** Hours until the first hour with a meaningful chance of rain, or null if dry ahead. */
  nextRainHours: number | null
  maxHumidity24h: number
  avgHumidity24h: number
  totalRain24h: number // mm expected over next 24h
  sprayWindow: {
    safeNow: boolean
    nextSafeInHours: number | null
    reason: string
  }
  /** Fungal/bacterial disease pressure from humidity + rain + temperature band. */
  fungalPressure: {
    score: number // 0-100
    band: "low" | "moderate" | "high"
    drivers: string[]
  }
}

export interface WeatherForecast {
  source: "live" | "cached" | "fallback"
  location: ForecastLocation
  fetchedAt: string // ISO
  current: CurrentWeather
  hourly: HourlyForecast[] // next ~48h from now
  derived: WeatherDerived
}

// ── WMO weather-code → human description ─────────────────────────────────────
function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear sky"
  if (code === 1) return "Mainly clear"
  if (code === 2) return "Partly cloudy"
  if (code === 3) return "Overcast"
  if (code === 45 || code === 48) return "Fog"
  if (code >= 51 && code <= 57) return "Drizzle"
  if (code >= 61 && code <= 67) return "Rain"
  if (code >= 71 && code <= 77) return "Snow"
  if (code >= 80 && code <= 82) return "Rain showers"
  if (code >= 95 && code <= 99) return "Thunderstorm"
  return "Unknown"
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

// ── Derived agronomic signals ────────────────────────────────────────────────
function computeDerived(current: CurrentWeather, hourly: HourlyForecast[]): WeatherDerived {
  const next24 = hourly.slice(0, 24)
  const humidities = next24.map((h) => h.humidity)
  const maxHumidity24h = humidities.length ? Math.max(...humidities) : current.humidity
  const avgHumidity24h = humidities.length
    ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length)
    : current.humidity
  const totalRain24h = Number(next24.reduce((a, h) => a + (h.precipitation || 0), 0).toFixed(1))

  // Next rain: first upcoming hour with rain probability >= 50% or measurable rain.
  let nextRainHours: number | null = null
  for (let i = 0; i < hourly.length; i++) {
    if (hourly[i].rainProbability >= 50 || hourly[i].precipitation >= 0.2) {
      nextRainHours = i
      break
    }
  }

  // Spray window: safe when no active rain, low wind, and no imminent rain in the
  // next 3h (spraying before rain wastes chemical — it washes off).
  const next3 = hourly.slice(0, 3)
  const imminentRain = next3.some((h) => h.rainProbability >= 40 || h.precipitation >= 0.2)
  const safeNow = current.precipitation < 0.1 && current.windSpeed < 20 && !imminentRain
  let nextSafeInHours: number | null = safeNow ? 0 : null
  if (!safeNow) {
    for (let i = 0; i + 2 < hourly.length; i++) {
      const window = hourly.slice(i, i + 3)
      const dryLowWind = window.every((h) => h.rainProbability < 40 && h.precipitation < 0.2 && h.windSpeed < 20)
      if (dryLowWind) {
        nextSafeInHours = i
        break
      }
    }
  }
  const sprayReason = safeNow
    ? "Dry and calm — good conditions to spray now."
    : imminentRain
      ? "Rain expected soon — spraying now risks wash-off."
      : current.windSpeed >= 20
        ? "Winds too high for even spray coverage."
        : "Hold until the next dry, low-wind window."

  // Fungal pressure: high humidity + rain + the 18–28°C band that most foliar
  // pathogens love. Each driver contributes to a 0–100 score.
  const humidityFactor = clamp((avgHumidity24h - 60) / 35, 0, 1) // 60%→0, 95%→1
  const rainFactor = clamp(totalRain24h / 10, 0, 1) // 10mm over 24h → 1
  const t = current.temperature
  const tempFactor = t >= 18 && t <= 28 ? 1 : t > 28 && t <= 34 ? 0.5 : t >= 12 && t < 18 ? 0.6 : 0.2
  const score = Math.round(clamp(humidityFactor * 50 + rainFactor * 30 + tempFactor * 20, 0, 100))
  const band = score >= 65 ? "high" : score >= 35 ? "moderate" : "low"
  const drivers: string[] = []
  if (humidityFactor > 0.4) drivers.push(`High humidity (${avgHumidity24h}% avg)`)
  if (rainFactor > 0.2) drivers.push(`${totalRain24h}mm rain expected`)
  if (tempFactor >= 1) drivers.push(`Temperature in the ${t}°C fungal-favourable band`)
  if (drivers.length === 0) drivers.push("Conditions currently unfavourable to spread")

  return {
    nextRainHours,
    maxHumidity24h,
    avgHumidity24h,
    totalRain24h,
    sprayWindow: { safeNow, nextSafeInHours, reason: sprayReason },
    fungalPressure: { score, band, drivers },
  }
}

// ── Live fetch from Open-Meteo ───────────────────────────────────────────────
async function fetchLive(location: ForecastLocation): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code,is_day",
    hourly: "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m",
    forecast_days: "3",
    timezone: location.timezone || "auto",
  })
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  let raw: any
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`)
    raw = await res.json()
  } finally {
    clearTimeout(timeout)
  }

  const c = raw.current
  const current: CurrentWeather = {
    temperature: Math.round(c.temperature_2m),
    humidity: Math.round(c.relative_humidity_2m),
    precipitation: Number(c.precipitation) || 0,
    windSpeed: Math.round(c.wind_speed_10m),
    weatherCode: Number(c.weather_code) || 0,
    description: describeWeatherCode(Number(c.weather_code) || 0),
    isDay: Boolean(c.is_day),
  }

  // Align hourly arrays and keep only entries from "now" forward (next ~48h).
  const times: string[] = raw.hourly.time
  const nowMs = Date.now()
  const hourly: HourlyForecast[] = []
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]).getTime() < nowMs - 60 * 60 * 1000) continue // drop past hours
    hourly.push({
      time: times[i],
      temperature: Math.round(raw.hourly.temperature_2m[i]),
      humidity: Math.round(raw.hourly.relative_humidity_2m[i]),
      rainProbability: Math.round(raw.hourly.precipitation_probability?.[i] ?? 0),
      precipitation: Number(raw.hourly.precipitation?.[i]) || 0,
      windSpeed: Math.round(raw.hourly.wind_speed_10m[i]),
    })
    if (hourly.length >= 48) break
  }

  return {
    source: "live",
    location,
    fetchedAt: new Date().toISOString(),
    current,
    hourly,
    derived: computeDerived(current, hourly),
  }
}

// ── Deterministic offline fallback ─────────────────────────────────────────
// This is advisory-only and is never presented as live weather for the farm.
function buildFallback(location: ForecastLocation): WeatherForecast {
  const now = Date.now()
  const startHour = new Date(now).getHours()
  const hourly: HourlyForecast[] = []
  for (let i = 0; i < 48; i++) {
    const hourOfDay = (startHour + i) % 24
    // Diurnal temperature curve (cooler pre-dawn ~24°C, warmer mid-afternoon ~31°C).
    const temp = Math.round(27.5 + 3.5 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI))
    // Humidity inversely tracks temperature; monsoon keeps it high (68–92%).
    const humidity = Math.round(80 - 12 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI))
    // Afternoon convective showers ~14:00–18:00.
    const showerWindow = hourOfDay >= 14 && hourOfDay <= 18
    const rainProbability = showerWindow ? 55 + ((i * 7) % 25) : 10 + ((i * 5) % 20)
    const precipitation = showerWindow ? Number((0.6 + ((i * 3) % 10) / 10).toFixed(1)) : 0
    const windSpeed = 8 + ((i * 3) % 10)
    hourly.push({
      time: new Date(now + i * 3600 * 1000).toISOString(),
      temperature: temp,
      humidity,
      rainProbability,
      precipitation,
      windSpeed,
    })
  }
  const first = hourly[0]
  const current: CurrentWeather = {
    temperature: first.temperature,
    humidity: first.humidity,
    precipitation: first.precipitation,
    windSpeed: first.windSpeed,
    weatherCode: first.rainProbability > 50 ? 61 : 2,
    description: first.rainProbability > 50 ? "Rain" : "Partly cloudy",
    isDay: startHour >= 6 && startHour < 19,
  }
  return {
    source: "fallback",
    location,
    fetchedAt: new Date().toISOString(),
    current,
    hourly,
    derived: computeDerived(current, hourly),
  }
}

// ── Module-level cache ───────────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000 // refresh at most every 30 minutes
let cached: { at: number; locationKey: string; data: WeatherForecast } | null = null

export async function getForecast(force = false): Promise<WeatherForecast> {
  const location = getWeatherLocation()
  const locationKey = `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`

  // Never treat the old default city as the farm's weather. The map asks the
  // user to set a location first, then forecasts are scoped to those coords.
  if (!location.isConfigured) {
    return buildFallback(location)
  }

  if (!force && cached && cached.locationKey === locationKey && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ...cached.data, source: "cached" }
  }
  try {
    const live = await fetchLive(location)
    cached = { at: Date.now(), locationKey, data: live }
    return live
  } catch (err) {
    // Live fetch failed (offline / timeout). Serve last good cache, else fallback.
    if (cached && cached.locationKey === locationKey) return { ...cached.data, source: "cached" }
    return buildFallback(location)
  }
}
