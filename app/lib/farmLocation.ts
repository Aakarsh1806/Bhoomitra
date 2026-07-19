export type FarmLocationSource = "device" | "search"

export type FarmLocation = {
  label: string
  latitude: number
  longitude: number
  timezone: string
  source: FarmLocationSource
  updatedAt: string
}

export type ForecastLocation = {
  name: string
  latitude: number
  longitude: number
  timezone: string
  isConfigured: boolean
}

export const DEFAULT_FORECAST_LOCATION: ForecastLocation = {
  name: "Farm location not set",
  latitude: 17.385,
  longitude: 78.4867,
  timezone: "auto",
  isConfigured: false,
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function isValidFarmLocation(value: unknown): value is FarmLocation {
  if (!value || typeof value !== "object") return false

  const location = value as Partial<FarmLocation>
  return (
    typeof location.label === "string" &&
    location.label.trim().length >= 2 &&
    location.label.trim().length <= 160 &&
    isFiniteNumber(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    isFiniteNumber(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180 &&
    typeof location.timezone === "string" &&
    location.timezone.trim().length >= 1 &&
    (location.source === "device" || location.source === "search") &&
    typeof location.updatedAt === "string"
  )
}

export function toForecastLocation(value: unknown): ForecastLocation {
  if (!isValidFarmLocation(value)) return DEFAULT_FORECAST_LOCATION

  return {
    name: value.label.trim(),
    latitude: value.latitude,
    longitude: value.longitude,
    timezone: value.timezone.trim() || "auto",
    isConfigured: true,
  }
}
