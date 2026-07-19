import type { WeatherForecast } from "@/app/lib/weatherService"

export type VpdBand = "green" | "orange" | "red" | "unavailable"
export type IrrigationAction =
  | "irrigate_now"
  | "defer_for_rain"
  | "monitor_after_rain"
  | "no_irrigation_needed"
  | "weather_unavailable_use_soil_only"
export type SprayAction =
  | "allowed"
  | "hold_for_rain"
  | "hold_for_wind"
  | "hold_for_vpd"
  | "weather_unavailable"

export const FARM_DECISION_CONFIG = {
  criticalMoistureThreshold: 25,
  climateStaleMs: 15 * 60 * 1000,
  weatherStaleMs: 90 * 60 * 1000,
  dht11SmoothingWindow: 5,
  imminentRainHours: 3,
  imminentRainProbability: 60,
  imminentRainMm: 2,
  currentRainMm: 0.1,
  safeWindKmh: 20,
  vpd: {
    holdLow: 0.4,
    optimalLow: 0.8,
    optimalHigh: 1.2,
    holdHigh: 2.0,
  },
} as const

export type FarmClimateSnapshot = {
  source: "dht11"
  rawTemperature: number | null
  rawHumidity: number | null
  temperature: number | null
  humidity: number | null
  vpd: number | null
  vpdBand: VpdBand
  lastValidAt: number | null
  sampleCount: number
  fresh: boolean
  message: string
}

export type WeatherDecisionContext = {
  source: WeatherForecast["source"] | "unavailable"
  fetchedAt: string | null
  ageMinutes: number | null
  usableForDecisions: boolean
  currentDescription: string
  currentTemperature: number | null
  currentHumidity: number | null
  currentPrecipitation: number | null
  currentWindSpeed: number | null
  providerReportedRain: boolean
  imminentRain: boolean
  nextRainHours: number | null
  totalRain24h: number | null
  rainProbabilityNextHours: number | null
  reason: string
}

export type IrrigationDecision = {
  action: IrrigationAction
  allowsStart: boolean
  reason: string
  weatherAdvisory: boolean
}

export type SprayDecision = {
  action: SprayAction
  allowed: boolean
  requiresWeatherOverride: boolean
  reason: string
}

export type FarmDecision = {
  irrigation: IrrigationDecision
  spray: SprayDecision
  climate: FarmClimateSnapshot
  weather: WeatherDecisionContext
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function isValidClimateReading(temperature: unknown, humidity: unknown) {
  return (
    isFiniteNumber(temperature) &&
    isFiniteNumber(humidity) &&
    temperature >= -20 &&
    temperature <= 70 &&
    humidity >= 0 &&
    humidity <= 100
  )
}

export function calculateAirVpd(temperature: number, humidity: number) {
  const saturationVapourPressure =
    0.61078 * Math.exp((17.27 * temperature) / (temperature + 237.3))
  return saturationVapourPressure * (1 - clamp(humidity, 0, 100) / 100)
}

export function classifyVpd(vpd: number | null | undefined): VpdBand {
  if (!isFiniteNumber(vpd)) return "unavailable"

  const { holdLow, optimalLow, optimalHigh, holdHigh } = FARM_DECISION_CONFIG.vpd
  if (vpd < holdLow || vpd > holdHigh) return "red"
  if (vpd >= optimalLow && vpd <= optimalHigh) return "green"
  return "orange"
}

export function buildFarmClimateSnapshot(input: {
  rawTemperature?: number | null
  rawHumidity?: number | null
  temperature?: number | null
  humidity?: number | null
  lastValidAt?: number | null
  sampleCount?: number
  now?: number
}): FarmClimateSnapshot {
  const now = input.now ?? Date.now()
  const temperature = input.temperature ?? null
  const humidity = input.humidity ?? null
  const lastValidAt = input.lastValidAt ?? null
  const hasValidReading = isValidClimateReading(temperature, humidity)
  const fresh = Boolean(
    hasValidReading &&
      lastValidAt &&
      now - lastValidAt >= 0 &&
      now - lastValidAt <= FARM_DECISION_CONFIG.climateStaleMs,
  )
  const vpd = fresh && temperature !== null && humidity !== null
    ? Number(calculateAirVpd(temperature, humidity).toFixed(3))
    : null
  const vpdBand = classifyVpd(vpd)

  const message = !hasValidReading
    ? "Farm climate station has not supplied a valid DHT11 reading."
    : !fresh
      ? "Farm climate reading is stale; VPD is unavailable for spray decisions."
      : vpdBand === "green"
        ? "Farm VPD is in the configured spray window."
        : vpdBand === "orange"
          ? "Farm VPD is marginal for spraying; use caution."
          : "Farm VPD is outside the configured spray window."

  return {
    source: "dht11",
    rawTemperature: input.rawTemperature ?? null,
    rawHumidity: input.rawHumidity ?? null,
    temperature,
    humidity,
    vpd,
    vpdBand,
    lastValidAt,
    sampleCount: input.sampleCount ?? 0,
    fresh,
    message,
  }
}

function isRainWeatherCode(code: number) {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)
}

function getWeatherAgeMinutes(weather: WeatherForecast, now: number) {
  const fetchedAt = Date.parse(weather.fetchedAt)
  if (Number.isNaN(fetchedAt)) return null
  return Math.max(0, Math.round((now - fetchedAt) / 60_000))
}

export function getWeatherDecisionContext(
  weather: WeatherForecast | null | undefined,
  now = Date.now(),
): WeatherDecisionContext {
  if (!weather) {
    return {
      source: "unavailable",
      fetchedAt: null,
      ageMinutes: null,
      usableForDecisions: false,
      currentDescription: "Weather unavailable",
      currentTemperature: null,
      currentHumidity: null,
      currentPrecipitation: null,
      currentWindSpeed: null,
      providerReportedRain: false,
      imminentRain: false,
      nextRainHours: null,
      totalRain24h: null,
      rainProbabilityNextHours: null,
      reason: "Forecast unavailable; recommendations use soil moisture only.",
    }
  }

  const ageMinutes = getWeatherAgeMinutes(weather, now)
  const usableForDecisions =
    weather.source !== "fallback" &&
    ageMinutes !== null &&
    ageMinutes * 60_000 <= FARM_DECISION_CONFIG.weatherStaleMs

  const nextHours = weather.hourly.slice(0, FARM_DECISION_CONFIG.imminentRainHours)
  const rainProbabilityNextHours = nextHours.length
    ? Math.max(...nextHours.map(hour => Number(hour.rainProbability) || 0))
    : null
  const rainMmNextHours = nextHours.reduce(
    (total, hour) => total + (Number(hour.precipitation) || 0),
    0,
  )
  const providerReportedRain =
    Number(weather.current.precipitation) >= FARM_DECISION_CONFIG.currentRainMm ||
    isRainWeatherCode(Number(weather.current.weatherCode))
  const imminentRain =
    !providerReportedRain &&
    (Boolean(rainProbabilityNextHours && rainProbabilityNextHours >= FARM_DECISION_CONFIG.imminentRainProbability) ||
      rainMmNextHours >= FARM_DECISION_CONFIG.imminentRainMm)

  const reason = weather.source === "fallback"
    ? "Offline fallback forecast is advisory only and cannot defer real irrigation."
    : ageMinutes === null || !usableForDecisions
      ? "Weather data is stale; recommendations use soil moisture only."
      : providerReportedRain
        ? "Weather provider reports rain now."
        : imminentRain
          ? "Meaningful rain is expected within the next 3 hours."
          : "Forecast is suitable for soil-moisture-based irrigation decisions."

  return {
    source: weather.source,
    fetchedAt: weather.fetchedAt,
    ageMinutes,
    usableForDecisions,
    currentDescription: weather.current.description,
    currentTemperature: Number.isFinite(weather.current.temperature) ? weather.current.temperature : null,
    currentHumidity: Number.isFinite(weather.current.humidity) ? weather.current.humidity : null,
    currentPrecipitation: Number(weather.current.precipitation) || 0,
    currentWindSpeed: Number(weather.current.windSpeed) || 0,
    providerReportedRain,
    imminentRain,
    nextRainHours: weather.derived.nextRainHours,
    totalRain24h: weather.derived.totalRain24h,
    rainProbabilityNextHours,
    reason,
  }
}

export function decideFarmActions(input: {
  soilMoisture: number
  dryThreshold: number
  climate: FarmClimateSnapshot
  weather: WeatherForecast | null | undefined
  now?: number
}): FarmDecision {
  const now = input.now ?? Date.now()
  const weather = getWeatherDecisionContext(input.weather, now)
  const critical = input.soilMoisture <= FARM_DECISION_CONFIG.criticalMoistureThreshold
  const needsIrrigation = input.soilMoisture < input.dryThreshold

  let irrigation: IrrigationDecision
  if (!needsIrrigation) {
    irrigation = {
      action: "no_irrigation_needed",
      allowsStart: false,
      reason: "Soil moisture is within the configured safe band.",
      weatherAdvisory: false,
    }
  } else if (!weather.usableForDecisions) {
    irrigation = {
      action: "weather_unavailable_use_soil_only",
      allowsStart: true,
      reason: "Forecast unavailable; irrigation recommendation uses soil moisture only.",
      weatherAdvisory: true,
    }
  } else if (critical) {
    irrigation = {
      action: "irrigate_now",
      allowsStart: true,
      reason: weather.providerReportedRain || weather.imminentRain
        ? "Soil moisture is critical; irrigate despite the rain forecast."
        : "Soil moisture is critical; irrigate now.",
      weatherAdvisory: weather.providerReportedRain || weather.imminentRain,
    }
  } else if (weather.providerReportedRain) {
    irrigation = {
      action: "monitor_after_rain",
      allowsStart: false,
      reason: "Weather provider reports rain now; monitor soil response before irrigating.",
      weatherAdvisory: true,
    }
  } else if (weather.imminentRain) {
    irrigation = {
      action: "defer_for_rain",
      allowsStart: false,
      reason: "Meaningful rain is expected soon; defer non-critical irrigation.",
      weatherAdvisory: true,
    }
  } else {
    irrigation = {
      action: "irrigate_now",
      allowsStart: true,
      reason: "Soil moisture is below the dry threshold and no meaningful rain is expected soon.",
      weatherAdvisory: false,
    }
  }

  let spray: SprayDecision
  if (!weather.usableForDecisions) {
    spray = {
      action: "weather_unavailable",
      allowed: false,
      requiresWeatherOverride: input.climate.fresh && input.climate.vpdBand === "green",
      reason: "Forecast is unavailable or offline; weather safety cannot be confirmed for spraying.",
    }
  } else if (weather.providerReportedRain || weather.imminentRain) {
    spray = {
      action: "hold_for_rain",
      allowed: false,
      requiresWeatherOverride: false,
      reason: weather.providerReportedRain
        ? "Weather provider reports rain now; spraying risks wash-off."
        : "Rain is expected soon; spraying risks wash-off.",
    }
  } else if ((weather.currentWindSpeed ?? 0) >= FARM_DECISION_CONFIG.safeWindKmh) {
    spray = {
      action: "hold_for_wind",
      allowed: false,
      requiresWeatherOverride: false,
      reason: `Wind is ${weather.currentWindSpeed} km/h, above the safe spray threshold.`,
    }
  } else if (!input.climate.fresh || input.climate.vpdBand !== "green") {
    spray = {
      action: "hold_for_vpd",
      allowed: false,
      requiresWeatherOverride: false,
      reason: !input.climate.fresh
        ? "Farm climate reading is unavailable or stale; VPD cannot clear spraying."
        : input.climate.vpdBand === "red"
          ? "Farm VPD is outside the configured spray window."
          : "Farm VPD is marginal; wait for the configured optimal window.",
    }
  } else {
    spray = {
      action: "allowed",
      allowed: true,
      requiresWeatherOverride: false,
      reason: "Farm VPD, wind, and weather conditions are suitable for spraying.",
    }
  }

  return { irrigation, spray, climate: input.climate, weather }
}
