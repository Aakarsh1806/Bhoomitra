"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  MapPin,
  Droplets,
  Thermometer,
  Wind,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Sprout,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ClipboardCheck,
  ListChecks,
  Clock3,
  Gauge,
  Wifi,
  WifiOff,
  Database,
} from "lucide-react"
import { generateRecommendation } from "@/lib/ai-engine"
import HardwareSafetyPanel from "@/components/hardware-safety-panel"
import FarmLocationPicker from "@/components/farm-location-picker"
import type { FarmLocation } from "@/app/lib/farmLocation"


import { useFarmStore } from "@/store/farmStore"

interface ZoneData {
  id: string
  row: number
  col: number
  status: "healthy" | "warning" | "critical"
  disease?: string
  lastSprayed: string
  soilMoisture: number
  temperature: number
  humidity: number
  plantCount: number
  healthScore: number
  gridColor?: "red" | "yellow" | "green"
  hydrateEligible?: boolean
  pumpStatus?: "on" | "off"
  cycleStatus?: "idle" | "running" | "cooldown" | "done" | "error"
  sensorError?: boolean
  sensorErrorMessage?: string | null
  vpd?: number
  vpdBand?: "green" | "orange" | "red" | "unavailable"
  sprayEnabled?: boolean
  sprayMessage?: string
  decisions?: FarmDecision
}

type FarmClimate = {
  source: "dht11"
  rawTemperature: number | null
  rawHumidity: number | null
  temperature: number | null
  humidity: number | null
  vpd: number | null
  vpdBand: "green" | "orange" | "red" | "unavailable"
  lastValidAt: number | null
  sampleCount: number
  fresh: boolean
  message: string
}

type FarmClimatePresentation = {
  source: "dht11" | "reference"
  isLive: boolean
  temperature: number
  humidity: number
  vpd: number
  vpdBand: "green" | "orange" | "red" | "unavailable"
  lastUpdatedAt: number | null
  message: string
}

const CLIMATE_REFERENCE_FALLBACK: FarmClimatePresentation = {
  source: "reference",
  isLive: false,
  temperature: 28,
  humidity: 69,
  vpd: 1.172,
  vpdBand: "green",
  lastUpdatedAt: null,
  message: "Calibrated farm reference shown until the live DHT11 feed connects.",
}

type IrrigationDecision = {
  action: "irrigate_now" | "defer_for_rain" | "monitor_after_rain" | "no_irrigation_needed" | "weather_unavailable_use_soil_only"
  allowsStart: boolean
  reason: string
  weatherAdvisory: boolean
}

type SprayDecision = {
  action: "allowed" | "hold_for_rain" | "hold_for_wind" | "hold_for_vpd" | "weather_unavailable"
  allowed: boolean
  requiresWeatherOverride: boolean
  reason: string
}

type FarmDecision = {
  irrigation: IrrigationDecision
  spray: SprayDecision
}

type FarmWeather = {
  source: "live" | "cached" | "fallback" | "unavailable"
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

interface ZonesApiResponse {
  zones: ZoneData[]
  farmClimate?: FarmClimate
  climatePresentation?: FarmClimatePresentation
  weather?: FarmWeather | null
  irrigation: {
    dryThreshold: number
    wetThreshold: number
    ripeningMode: boolean
    hydrateDisabled: boolean
    hydrateReason: string | null
    targetedZoneIds: string[]
    deferredZoneIds?: string[]
    ignoredZoneIds: string[]
    globalHydrateRequest: {
      requestedAt: string
      targetedZones: string[]
      pumpControllerZone: string | null
    } | null
  }
}

interface FarmProfile {
  acres: number
  zones: number
  zoneCount?: number
  primaryCrop?: string
  zoneNames: Record<string, string>
  farmLocation?: FarmLocation | null
}

interface AnalyticsApiResponse {
  currentRiskPercent?: number
  activeDetections?: number
  activeZoneCount?: number
  farmZoneCount?: number
}

function generateZoneIds(count: number) {
  const cols = 6
  const ids: string[] = []

  for (let i = 0; i < count; i++) {
    const row = String.fromCharCode(65 + Math.floor(i / cols))
    const col = (i % cols) + 1
    ids.push(`${row}${col}`)
  }

  return ids
}

function getFarmVpdStatus(climate: FarmClimatePresentation | null) {
  if (!climate || climate.vpdBand === "unavailable") {
    return "Farm climate reading unavailable"
  }

  const referenceSuffix = climate.isLive ? "" : " (calibrated reference)"

  if (climate.vpdBand === "green") {
    return `Optimal now${referenceSuffix}`
  }

  if (climate.vpdBand === "orange") {
    return `Marginal for the configured spray window${referenceSuffix}`
  }

  if (typeof climate.vpd === "number" && climate.vpd < 0.8) {
    return `Too humid for the configured spray window${referenceSuffix}`
  }

  return `Too dry or hot for the configured spray window${referenceSuffix}`
}

function getIrrigationActionLabel(decision?: IrrigationDecision) {
  if (!decision) return "Assessing conditions"
  if (decision.action === "irrigate_now") return "Irrigate now"
  if (decision.action === "defer_for_rain") return "Rain expected: defer"
  if (decision.action === "monitor_after_rain") return "Rain now: monitor"
  if (decision.action === "weather_unavailable_use_soil_only") return "Soil-only decision"
  return "No irrigation needed"
}

export default function FarmMap() {
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null)
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false)
  const [isSpraying, setIsSpraying] = useState(false)
  const [sprayNotice, setSprayNotice] = useState<string | null>(null)
  const [isHydrating, setIsHydrating] = useState(false)
  const [isGlobalHydrating, setIsGlobalHydrating] = useState(false)
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false)
  const [isSavingLocation, setIsSavingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [commandQueue, setCommandQueue] = useState<Record<string, string[]>>({})
  const [zoomLevel, setZoomLevel] = useState(1)
  const { updateSensorData } = useFarmStore()
  const [farmProfile, setFarmProfile] = useState<FarmProfile>({
    acres: 6,
    zones: 24,
    zoneCount: 24,
    primaryCrop: "Other",
    zoneNames: {},
    farmLocation: null,
  })
  const [mlData, setMlData] = useState<{
    [zoneId: string]: {
      confidence: number
      suitability: number
      spreadScore: number
      trend: "up" | "down" | "stable"
      lastScan: Date
    }
  }>({})
  const [irrigationMeta, setIrrigationMeta] = useState<ZonesApiResponse["irrigation"]>({
    dryThreshold: 40,
    wetThreshold: 60,
    ripeningMode: false,
    hydrateDisabled: false,
    hydrateReason: null,
    targetedZoneIds: [],
    ignoredZoneIds: [],
    globalHydrateRequest: null,
  })
  const [farmRisk, setFarmRisk] = useState<Required<AnalyticsApiResponse>>({
    currentRiskPercent: 0,
    activeDetections: 0,
    activeZoneCount: 0,
    farmZoneCount: 0,
  })

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await fetch("/api/zones/queue")
        const data = await res.json()
        setCommandQueue(data)
      } catch (err) { }
    }
    fetchQueue()
    const interval = setInterval(fetchQueue, 2000)
    return () => clearInterval(interval)
  }, [])

  const [farmData, setFarmData] = useState<ZoneData[]>([])
  const [farmClimate, setFarmClimate] = useState<FarmClimate | null>(null)
  const [climatePresentation, setClimatePresentation] = useState<FarmClimatePresentation | null>(null)
  const [farmWeather, setFarmWeather] = useState<FarmWeather | null>(null)
  const [draftFarmLocation, setDraftFarmLocation] = useState<FarmLocation | null>(null)
  const displayClimate: FarmClimatePresentation = climatePresentation ?? (
    farmClimate?.fresh &&
    farmClimate.temperature !== null &&
    farmClimate.humidity !== null &&
    farmClimate.vpd !== null
      ? {
          source: "dht11",
          isLive: true,
          temperature: farmClimate.temperature,
          humidity: farmClimate.humidity,
          vpd: farmClimate.vpd,
          vpdBand: farmClimate.vpdBand,
          lastUpdatedAt: farmClimate.lastValidAt,
          message: farmClimate.message,
        }
      : CLIMATE_REFERENCE_FALLBACK
  )
  const aiRecommendation = selectedZone
    ? generateRecommendation(selectedZone)
    : null
  const fetchZones = async () => {
    try {
      const res = await fetch("/api/zones")
      const raw = await res.json()
      const parsed: ZonesApiResponse = Array.isArray(raw)
        ? {
            zones: raw,
            irrigation: {
              dryThreshold: 40,
              wetThreshold: 60,
              ripeningMode: false,
              hydrateDisabled: false,
              hydrateReason: null,
              targetedZoneIds: [],
              ignoredZoneIds: [],
              globalHydrateRequest: null,
            },
          }
        : raw

      const data = parsed.zones || []
      setIrrigationMeta(parsed.irrigation)
      setFarmClimate(parsed.farmClimate || null)
      setClimatePresentation(parsed.climatePresentation || null)
      setFarmWeather(parsed.weather || null)

      setFarmData(data)

      // Update all zones in global store for comprehensive live dashboard tracking
      data.forEach((zone: ZoneData) => {
        updateSensorData({
          id: zone.id,
          soilMoisture: zone.soilMoisture,
          temperature: zone.temperature,
          humidity: zone.humidity,
          lastUpdate: Date.now()
        })
      })

      if (selectedZone) {
        const updatedZone = data.find((z: ZoneData) => z.id === selectedZone.id)

        if (updatedZone) {
          setSelectedZone(updatedZone)
        }
      }
    } catch (err) {
      console.error("Failed to fetch zones:", err)
    }
  }

  const fetchFarmerProfile = async () => {
    try {
      const res = await fetch("/api/farmer-profile")
      const data = await res.json()

      if (data?.exists && data?.profile) {
        const savedLocation = data.profile.farmLocation ?? null
        setFarmProfile({
          acres: data.profile.acres,
          zones: data.profile.zones,
          zoneCount: data.profile.zoneCount,
          primaryCrop: data.profile.primaryCrop,
          zoneNames: data.profile.zoneNames || {},
          farmLocation: savedLocation,
        })
        setDraftFarmLocation(savedLocation)

        // Existing profiles predate the location-aware forecast. Ask once so
        // the map never presents a generic city's weather as the farmer's.
        if (!savedLocation) {
          setIsLocationDialogOpen(true)
        }
      }
    } catch (err) {
      console.error("Failed to fetch farmer profile:", err)
    }
  }

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/analytics")
      if (!res.ok) return

      const data: AnalyticsApiResponse = await res.json()
      setFarmRisk({
        currentRiskPercent: Number(data?.currentRiskPercent ?? 0),
        activeDetections: Number(data?.activeDetections ?? 0),
        activeZoneCount: Number(data?.activeZoneCount ?? 0),
        farmZoneCount: Number(data?.farmZoneCount ?? 0),
      })
    } catch (err) {
      console.error("Failed to fetch analytics:", err)
    }
  }

  const calculateSuitability = () => {
    let score = 0
    const humidity = displayClimate?.humidity ?? null
    const temperature = displayClimate?.temperature ?? null

    if (humidity !== null && humidity > 85) score += 0.5
    else if (humidity !== null && humidity > 70) score += 0.3

    if (temperature !== null && temperature >= 18 && temperature <= 28) score += 0.3
    else if (temperature !== null && temperature > 28 && temperature <= 32) score += 0.1

    return Math.min(score, 1)
  }

  const calculateConfidence = (zone: ZoneData) => {
    let confidence = 0.15
    const humidity = displayClimate?.humidity ?? null
    const temperature = displayClimate?.temperature ?? null

    if (humidity !== null && temperature !== null && humidity > 80 && temperature >= 18 && temperature <= 28) {
      confidence = 0.65
    } else if (humidity !== null && humidity > 65) {
      confidence = 0.35
    } else {
      confidence = 0.1
    }

    if (zone.status === "healthy") {
      confidence = Math.min(confidence, 0.45)
    } else if (zone.status === "warning") {
      confidence = Math.min(confidence + 0.1, 0.75)
    } else if (zone.status === "critical") {
      confidence = Math.max(confidence, 0.75)
    }

    return Math.min(confidence, 1)
  }

  const getNeighbors = (zone: ZoneData) => {
    return farmData.filter(z =>
      Math.abs(z.row - zone.row) <= 1 &&
      Math.abs(z.col - zone.col) <= 1 &&
      z.id !== zone.id
    )
  }

  const getConfidenceCap = (status: string) => {
    if (status === "healthy") return 0.45
    if (status === "warning") return 0.65
    return 0.85
  }

  useEffect(() => {
    fetchFarmerProfile()
    fetchZones()
    fetchAnalytics()

    const zoneInterval = setInterval(fetchZones, 15000)
    const analyticsInterval = setInterval(fetchAnalytics, 30000)

    return () => {
      clearInterval(zoneInterval)
      clearInterval(analyticsInterval)
    }
  }, [])

  const configuredZoneIds = generateZoneIds(farmProfile.zones)
  const columns = Math.min(farmProfile.zones, 6)
  const rows = Math.ceil(farmProfile.zones / Math.max(columns, 1))
  const zoneMap = new Map(farmData.map(zone => [zone.id, zone]))
  const visibleZones = configuredZoneIds
    .map(id => zoneMap.get(id))
    .filter((zone): zone is ZoneData => Boolean(zone))
  const runningCycleCount = visibleZones.filter(zone => zone.cycleStatus === "running").length
  const pumpOnCount = visibleZones.filter(zone => zone.pumpStatus === "on").length
  const sensorErrorCount = visibleZones.filter(zone => zone.sensorError).length
  const farmVpdIsOptimal = displayClimate?.vpdBand === "green"
  const redGridCount = visibleZones.filter(zone => zone.gridColor === "red").length

  const getZoneLabel = (zoneId: string) => {
    const custom = farmProfile.zoneNames?.[zoneId]
    return custom && custom.trim().length > 0 ? custom : zoneId
  }

  const getDensityDivisor = (crop?: string) => {
    const value = (crop || "").toLowerCase()
    if (value.includes("tomato")) return 4
    if (value.includes("rice") || value.includes("paddy")) return 1
    if (value.includes("cotton")) return 6
    return 3
  }

  const getCalculatedPlantCount = () => {
    const zoneCount = farmProfile.zoneCount ?? farmProfile.zones
    const zoneAreaSqYards = (farmProfile.acres * 4840) / Math.max(1, zoneCount)
    const divisor = getDensityDivisor(farmProfile.primaryCrop)
    return Math.max(1, Math.floor(zoneAreaSqYards / divisor))
  }

  const getZoneRecommendation = (zone: ZoneData) => {
    const zoneLabel = getZoneLabel(zone.id)
    const irrigationDecision = zone.decisions?.irrigation
    const isIrrigationPriority = irrigationDecision?.action === "irrigate_now"

    const actionLabel = isIrrigationPriority
      ? `Irrigate ${zoneLabel}`
      : irrigationDecision?.action === "defer_for_rain"
        ? `Defer ${zoneLabel}`
        : irrigationDecision?.action === "monitor_after_rain"
          ? `Monitor ${zoneLabel} after rain`
          : `Monitor ${zoneLabel}`

    const estimatedMinutes = isIrrigationPriority
      ? Math.max(
          5,
          Math.min(
            15,
            Math.round((irrigationMeta.wetThreshold - zone.soilMoisture) / 4) + 5,
          ),
        )
      : 5

    const reasons = [
      zone.soilMoisture <= irrigationMeta.dryThreshold
        ? "Soil moisture critically low"
        : zone.soilMoisture < irrigationMeta.wetThreshold
          ? "Soil moisture below target"
          : "Soil moisture is within the safe band",
      irrigationDecision?.reason || "Farm weather decision is loading",
      displayClimate?.message || farmClimate?.message || "Farm climate station has not supplied a reading yet",
      new Date(zone.lastSprayed).toDateString() === new Date().toDateString()
        ? "Irrigation was already recorded today"
        : "No irrigation recorded today",
    ]

    return {
      actionLabel,
      estimatedMinutes,
      reasons,
      priorityLabel: isIrrigationPriority ? "Urgent" : irrigationDecision?.weatherAdvisory ? "Weather watch" : "Monitor",
      priorityTone: isIrrigationPriority ? "destructive" : "secondary",
    }
  }

  const selectedZoneRecommendation = selectedZone ? getZoneRecommendation(selectedZone) : null

  const farmSummary = {
    irrigationRequired: visibleZones.filter(zone => zone.decisions?.irrigation.action === "irrigate_now").length,
    monitoringRequired: visibleZones.filter(
      zone => ["defer_for_rain", "monitor_after_rain"].includes(zone.decisions?.irrigation.action || "") || zone.gridColor === "yellow",
    ).length,
    healthyZones: visibleZones.filter(
      zone => zone.gridColor === "green" || zone.status === "healthy",
    ).length,
    noPumpsActive: pumpOnCount === 0,
  }

  const recommendedActions = visibleZones
    .map((zone) => {
      const irrigationDecision = zone.decisions?.irrigation
      const requiresIrrigation = irrigationDecision?.action === "irrigate_now"
      const requiresMonitoring =
        zone.gridColor === "yellow" ||
        zone.status === "warning" ||
        irrigationDecision?.action === "defer_for_rain" ||
        irrigationDecision?.action === "monitor_after_rain"
      const hasDiseaseAlert = Boolean(zone.disease && zone.status !== "healthy")

      const priority = requiresIrrigation ? 0 : hasDiseaseAlert ? 1 : requiresMonitoring ? 2 : 3
      const label = requiresIrrigation
        ? `Irrigate ${getZoneLabel(zone.id)}`
        : irrigationDecision?.action === "defer_for_rain"
          ? `Defer ${getZoneLabel(zone.id)} — rain expected`
          : irrigationDecision?.action === "monitor_after_rain"
            ? `Monitor ${getZoneLabel(zone.id)} after rain`
        : hasDiseaseAlert
          ? `Disease inspection recommended for ${getZoneLabel(zone.id)}`
          : requiresMonitoring
            ? `Monitor ${getZoneLabel(zone.id)}`
            : `Observe ${getZoneLabel(zone.id)}`

      return {
        zoneId: zone.id,
        label,
        priority,
      }
    })
    .sort((a, b) => a.priority - b.priority || a.zoneId.localeCompare(b.zoneId))
    .slice(0, 4)

  const visibleZonesRef = useRef(visibleZones)
  visibleZonesRef.current = visibleZones
  const zoneIdsKey = visibleZones.map(zone => zone.id).join(",")

  useEffect(() => {
    if (visibleZonesRef.current.length === 0) return

    const calculateML = () => {
      setMlData(prev => {
        const updated = { ...prev }

        visibleZonesRef.current.forEach(zone => {
          const confidence = calculateConfidence(zone)

          updated[zone.id] = {
            confidence,
            suitability: calculateSuitability(),
            spreadScore: confidence, // use confidence as spread proxy for now
            trend: "stable",
            lastScan: new Date()
          }
        })

        return updated
      })
    }

    // Run immediately
    calculateML()

    // Then run every 30 seconds
    const interval = setInterval(calculateML, 30000)

    return () => clearInterval(interval)
  }, [zoneIdsKey, displayClimate?.temperature, displayClimate?.humidity])

  const getZoneColor = (zone: ZoneData) => {
    if (zone.gridColor === "green") {
      return "bg-green-500 hover:bg-green-600 border-green-600"
    }

    if (zone.gridColor === "yellow") {
      return "bg-yellow-500 hover:bg-yellow-600 border-yellow-600"
    }

    if (zone.gridColor === "red") {
      return "bg-red-500 hover:bg-red-600 border-red-600"
    }

    switch (zone.status) {
      case "healthy":
        return "bg-green-500 hover:bg-green-600 border-green-600"
      case "warning":
        return "bg-yellow-500 hover:bg-yellow-600 border-yellow-600"
      case "critical":
        return "bg-red-500 hover:bg-red-600 border-red-600"
      default:
        return "bg-gray-400 hover:bg-gray-500 border-gray-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const handleZoomIn = () => setZoomLevel(Math.min(zoomLevel + 0.2, 2))
  const handleZoomOut = () => setZoomLevel(Math.max(zoomLevel - 0.2, 0.6))
  const handleReset = () => {
    setZoomLevel(1)
    setSelectedZone(null)
  }

  const handleReconfigureFarm = async () => {
    const confirmed = window.confirm("This will reopen onboarding and remove the saved farm profile. Continue?")
    if (!confirmed) return

    try {
      const response = await fetch("/api/farmer-profile", {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete profile")
      }

      window.location.assign("/")
    } catch (error) {
      console.error("Failed to delete farmer profile", error)
    }
  }

  const handleSaveFarmLocation = async () => {
    if (!draftFarmLocation) {
      setLocationError("Choose your farm location before saving.")
      return
    }

    setIsSavingLocation(true)
    setLocationError(null)

    try {
      const response = await fetch("/api/farmer-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmLocation: draftFarmLocation }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || "Unable to save farm location")
      }

      const savedLocation = data?.profile?.farmLocation || draftFarmLocation
      setFarmProfile((current) => ({ ...current, farmLocation: savedLocation }))
      setDraftFarmLocation(savedLocation)
      setIsLocationDialogOpen(false)

      // The forecast cache is keyed by coordinates. Refresh immediately so
      // judges see the selected farm's weather without waiting for polling.
      await fetchZones()
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Unable to save farm location")
    } finally {
      setIsSavingLocation(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const climateAge = displayClimate?.isLive && displayClimate.lastUpdatedAt
    ? Math.max(0, Math.round((Date.now() - displayClimate.lastUpdatedAt) / 60_000))
    : null
  const farmLocationLabel = farmProfile.farmLocation?.label?.trim() || null
  const weatherSourceLabel = !farmLocationLabel
    ? "Location needed"
    : farmWeather?.source === "live"
    ? "Live"
    : farmWeather?.source === "cached"
      ? "Cached"
      : farmWeather?.source === "fallback"
        ? "Offline fallback"
        : "Unavailable"
  const weatherDecisionUsable = Boolean(farmWeather?.usableForDecisions)
  const farmWeatherAdvisory = !farmLocationLabel
    ? "Set your farm location to activate a local forecast."
    : !farmWeather || !weatherDecisionUsable
    ? "Forecast unavailable — using soil moisture only."
    : farmWeather.providerReportedRain
      ? "Provider reports rain now — monitor non-critical zones before irrigating."
      : farmWeather.imminentRain
        ? "Rain expected soon — defer non-critical irrigation."
        : farmWeather.reason


  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Interactive Farm Map</h1>
            <p className="text-muted-foreground">Click on zones to view detailed information and control spraying</p>
          </div>

          {/* Map Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut} className="bg-transparent">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn} className="bg-transparent">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} className="bg-transparent">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant={farmLocationLabel ? "outline" : "default"}
              size="sm"
              onClick={() => {
                setDraftFarmLocation(farmProfile.farmLocation || null)
                setLocationError(null)
                setIsLocationDialogOpen(true)
              }}
              className={farmLocationLabel ? "bg-transparent" : "bg-[#3a7d44] text-white hover:bg-[#2e6336]"}
            >
              <MapPin className="mr-1.5 h-4 w-4" />
              {farmLocationLabel ? "Farm Location" : "Set Farm Location"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleReconfigureFarm} className="bg-transparent">
              Reconfigure Farm
            </Button>
            <span className="text-sm text-muted-foreground ml-2">Zoom: {Math.round(zoomLevel * 100)}%</span>
          </div>
        </div>

        {/* Legend */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-green-500 border border-green-600" />
                <span className="text-sm">Adequate soil moisture</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-yellow-500 border border-yellow-600" />
                <span className="text-sm">Below target moisture</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-red-500 border border-red-600" />
                <span className="text-sm">Low soil moisture</span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <p className="text-sm text-muted-foreground">Click on any zone for detailed information</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 shadow-sm">
          <CardContent className="grid gap-4 p-5 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-white/85 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <Wind className="h-4 w-4" /> Farm Climate · {displayClimate?.isLive ? "Live DHT11" : "Reference"}
              </div>
              <p className="mt-2 text-lg font-black text-slate-900">
                {displayClimate
                  ? `${displayClimate.temperature}°C · ${displayClimate.humidity}% RH`
                  : "Climate reference unavailable"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {displayClimate?.isLive
                  ? `DHT11 reading ${climateAge === 0 ? "just now" : `${climateAge}m ago`}`
                  : displayClimate?.message || "Temperature and humidity apply farm-wide, not per grid."}
              </p>
            </div>

            <div className="rounded-xl border border-violet-100 bg-white/85 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
                <Gauge className="h-4 w-4" /> Farm VPD
              </div>
              <p className="mt-2 text-lg font-black text-slate-900">
                {displayClimate ? `${displayClimate.vpd.toFixed(2)} kPa` : "Unavailable"}
              </p>
              <p className="mt-1 text-xs text-slate-600">{getFarmVpdStatus(displayClimate)}</p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-white/85 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700">
                {farmWeather?.source === "live" ? <Wifi className="h-4 w-4" /> : farmWeather?.source === "cached" ? <Database className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                Farm Weather · {weatherSourceLabel}
              </div>
              <p className="mt-2 text-lg font-black text-slate-900">
                {!farmLocationLabel
                  ? "Set farm location"
                  : !weatherDecisionUsable
                  ? "Forecast unavailable"
                  : farmWeather?.providerReportedRain
                  ? "Rain reported now"
                  : farmWeather?.imminentRain
                    ? `Rain likely in ~${farmWeather.nextRainHours ?? 3}h`
                    : farmWeather?.currentDescription || "Forecast unavailable"}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-sky-800">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{farmLocationLabel || "Location required"}</span>
              </p>
              {farmLocationLabel && farmWeather && (
                <p className="mt-1 text-xs text-slate-600">
                  {farmWeather.currentDescription} · {farmWeather.currentTemperature ?? "—"}°C · {farmWeather.currentHumidity ?? "—"}% RH · {farmWeather.currentWindSpeed ?? "—"} km/h wind
                </p>
              )}
              <p className="mt-1 text-xs text-slate-600">{farmWeatherAdvisory}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Irrigation Control</CardTitle>
            <CardDescription>
              Global hydrate targets RED + YELLOW grids using timed cycles (10m ON / 50m OFF).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={
                  isGlobalHydrating ||
                  irrigationMeta.hydrateDisabled ||
                  irrigationMeta.ripeningMode
                }
                onClick={async () => {
                  setIsGlobalHydrating(true)
                  try {
                    await fetch("/api/hydrate-global", { method: "POST" })
                    await fetchZones()
                  } finally {
                    setIsGlobalHydrating(false)
                  }
                }}
              >
                <Droplets className="mr-2 h-4 w-4" />
                {isGlobalHydrating ? "Hydrating..." : "Hydrate"}
              </Button>

              <Button
                variant={irrigationMeta.ripeningMode ? "destructive" : "outline"}
                onClick={async () => {
                  const confirmed = window.confirm(
                    irrigationMeta.ripeningMode
                      ? "Turn off ripening mode?"
                      : "Turn on ripening mode? This will lock hydrate controls until it is turned off."
                  )

                  if (!confirmed) return

                  await fetch("/api/irrigation-settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ripeningMode: !irrigationMeta.ripeningMode }),
                  })
                  await fetchZones()
                }}
              >
                {irrigationMeta.ripeningMode ? "Ripening Mode: ON" : "Ripening Mode: OFF"}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Thresholds: DRY {irrigationMeta.dryThreshold}% | WET {irrigationMeta.wetThreshold}%
            </div>

            {(irrigationMeta.hydrateDisabled || irrigationMeta.ripeningMode) && (
              <p className="text-sm font-medium text-amber-700">
                {irrigationMeta.hydrateReason || "Hydrate is locked right now."}
              </p>
            )}

            {Boolean(irrigationMeta.globalHydrateRequest && irrigationMeta.globalHydrateRequest.targetedZones.length > 0) && (
              <p className="text-xs text-slate-600">
                Last global hydrate targeted: {irrigationMeta.globalHydrateRequest?.targetedZones.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>

        <HardwareSafetyPanel />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)] lg:items-start">
          {/* Farm Map */}
          <div className="space-y-6">

            {/* ================= FARM LAYOUT ================= */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Farm Layout
                  </div>

                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                    Live
                  </div>
                </CardTitle>
                <CardDescription>
                  {farmProfile.zones} zones across {rows} rows and {columns} columns ({farmProfile.acres} acres)
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div
                  className="grid gap-2 p-4 bg-muted/30 rounded-lg overflow-auto"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))`,
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: "top left",
                  }}
                >
                  {visibleZones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`
  relative aspect-square rounded-lg border-2 cursor-pointer transition-all duration-200
  ${getZoneColor(zone)}
  ${selectedZone?.id === zone.id ? "ring-2 ring-primary ring-offset-2" : ""}
  ${mlData[zone.id]?.confidence > 0.7 ? "ring-4 ring-red-400/50" : ""}
                        }
`}
                      onClick={() => {
                        const recommendation = getZoneRecommendation(zone)
                        setSelectedZone(zone)
                        setIsRecommendationOpen(Boolean(recommendation))
                      }}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                        <span className="text-[10px] font-bold text-white opacity-80 uppercase leading-none">{getZoneLabel(zone.id)}</span>
                        <span className="text-xs font-black text-white">{zone.soilMoisture}%</span>
                        <span className="text-[9px] text-white/80">{zone.id}</span>
                        {(zone.decisions?.irrigation.action === "defer_for_rain" ||
                          zone.decisions?.irrigation.action === "monitor_after_rain") && (
                          <span
                            title={zone.decisions.irrigation.reason}
                            className="mt-1 rounded bg-white/20 px-1 text-[8px] font-bold uppercase tracking-wide text-white"
                          >
                            {zone.decisions.irrigation.action === "defer_for_rain" ? "Rain: defer" : "Rain: monitor"}
                          </span>
                        )}
                      </div>

                      {zone.status !== "healthy" && (
                        <div className="absolute -top-1 -right-1 bg-white rounded-full p-1">
                          {getStatusIcon(zone.status)}
                        </div>
                      )}

                      {/* ML Brain Indicator */}
                      {mlData[zone.id] && mlData[zone.id].confidence > 0.7 && (
                        <div className="absolute bottom-1 left-1">
                          <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-md animate-pulse" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ================= FARM ML INTELLIGENCE ================= */}
            <Card className="shadow-md border">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Farm Intelligence Overview
                  </CardTitle>
                  <CardDescription>
                    AI-driven ecosystem and outbreak analysis
                  </CardDescription>
                </div>

                {farmData.length > 0 && (() => {
                  const risk = Math.max(0, Math.min(100, farmRisk.currentRiskPercent))

                  const label =
                    risk >= 60
                      ? "High Alert"
                      : risk >= 30
                        ? "Monitor"
                        : "Stable"

                  const style =
                    risk >= 60
                      ? "bg-red-100 text-red-700"
                      : risk >= 30
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"

                  return (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${style}`}>
                      {label}
                    </span>
                  )
                })()}
              </CardHeader>

              <CardContent>
                {farmData.length > 0 && (
                  <div className="space-y-8">

                    {/* Farm-wide Active Disease Risk */}
                    {(() => {
                      const risk = Math.max(0, Math.min(100, farmRisk.currentRiskPercent))

                      let label = "Stable"
                      let color = "text-green-600"

                      if (risk >= 60) {
                        label = "Critical Outbreak Risk"
                        color = "text-red-600"
                      } else if (risk >= 30) {
                        label = "Moderate Risk"
                        color = "text-yellow-600"
                      }

                      return (
                        <div className={`mt-3 text-sm font-medium ${color}`}>
                          Overall Status: {label}
                        </div>
                      )
                    })()}
                    {(() => {
                      const risk = Math.max(0, Math.min(100, farmRisk.currentRiskPercent))
                      const farmZoneCount = farmRisk.farmZoneCount || farmProfile.zones

                      return (
                        <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-50 via-white to-green-50 border shadow-sm">                          <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            Farm-wide Active Disease Risk
                          </span>
                          <span className="text-3xl font-bold tracking-tight">
                            {risk.toFixed(1)}%
                          </span>
                        </div>

                          <p className="mt-2 text-xs text-slate-600">
                            Active detections: {farmRisk.activeDetections} across {farmRisk.activeZoneCount}/{farmZoneCount} zones
                          </p>

                          <div className="mt-3 h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-700 ${risk >= 60
                                ? "bg-red-500"
                                : risk >= 30
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                                }`}
                              style={{ width: `${risk}%` }}
                            />
                          </div>
                        </div>
                      )
                    })()}

                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-emerald-700" />
                        <h4 className="text-sm font-semibold text-slate-900">Today&apos;s Farm Summary</h4>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-rose-100 bg-rose-50/80 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-600">Irrigation</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{farmSummary.irrigationRequired} grids require irrigation</p>
                        </div>
                        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">Monitoring</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{farmSummary.monitoringRequired} grids require monitoring</p>
                        </div>
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">Healthy</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{farmSummary.healthyZones} healthy grids</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Pumps</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {farmSummary.noPumpsActive ? "No pumps currently active" : `${pumpOnCount} pumps currently active`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Highest Spread Risk Zones */}
                    {Object.keys(mlData).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">
                        Highest Spread Risk Zones
                      </h4>

                      <div className="grid md:grid-cols-3 gap-4">
                        {Object.keys(mlData)
                          .sort((a, b) => mlData[b].confidence - mlData[a].confidence)
                          .slice(0, 3)
                          .map((zoneId) => {
                            const score = mlData[zoneId]?.confidence ?? 0
                            const percent = (score * 100).toFixed(0)

                            const label =
                              score > 0.7
                                ? "High Risk"
                                : score > 0.4
                                  ? "Moderate Risk"
                                  : "Low Risk"

                            const style =
                              score > 0.7
                                ? "text-red-600"
                                : score > 0.4
                                  ? "text-yellow-600"
                                  : "text-green-600"

                            return (
                              <div
                                key={zoneId}
                                className="p-4 rounded-lg border bg-white shadow-sm"
                              >
                                <div className="text-xs uppercase text-muted-foreground">
                                  Zone
                                </div>

                                <div className="text-lg font-semibold">
                                  {zoneId}
                                </div>

                                <div className="text-sm text-muted-foreground">
                                  Risk Score: {percent}%
                                </div>

                                <div className={`mt-2 text-xs font-semibold ${style}`}>
                                  {label}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                    )}

                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border">
              <CardHeader>
                <CardTitle className="text-base">Live Operations Snapshot</CardTitle>
                <CardDescription>Quick view of what is happening right now</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded border p-3">
                    <p className="text-xs text-slate-500">Cycles Running</p>
                    <p className="text-lg font-bold text-blue-700">{runningCycleCount}</p>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-slate-500">Pumps ON</p>
                    <p className="text-lg font-bold text-cyan-700">{pumpOnCount}</p>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-slate-500">Sensor Errors</p>
                    <p className="text-lg font-bold text-red-700">{sensorErrorCount}</p>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-slate-500">Farm VPD</p>
                    <p className={`text-lg font-bold ${farmVpdIsOptimal ? "text-green-700" : "text-amber-700"}`}>
                      {displayClimate ? `${displayClimate.vpd.toFixed(2)} kPa` : "Unavailable"}
                    </p>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-slate-500">Red Moisture Grids</p>
                    <p className="text-lg font-bold text-amber-700">{redGridCount}</p>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-slate-500">Tracked Zones</p>
                    <p className="text-lg font-bold text-slate-700">{visibleZones.length}</p>
                  </div>
                  <div className="rounded border border-emerald-200 bg-emerald-50/80 p-3 col-span-2 md:col-span-2">
                    <p className="text-xs text-emerald-700 font-semibold uppercase tracking-widest">Today&apos;s Recommended Actions</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {recommendedActions.length > 0 ? (
                        recommendedActions.map((item) => (
                          <div key={item.zoneId} className="flex items-start gap-2">
                            <ListChecks className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                            <span>{item.label}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-start gap-2">
                          <Clock3 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                          <span>No immediate action required</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Zone Details */}
          <div className="self-start">
            <Card className="shadow-sm border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sprout className="h-5 w-5 text-green-600" />
                  Zone Details
                </CardTitle>
                <CardDescription>
                  {selectedZone ? `Information for ${getZoneLabel(selectedZone.id)} (${selectedZone.id})` : "Select a zone to view details"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedZone ? (
                  <div className="space-y-5">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={
                          selectedZone.status === "healthy"
                            ? "default"
                            : selectedZone.status === "warning"
                              ? "secondary"
                              : "destructive"
                        }
                        className="capitalize"
                      >
                        {selectedZone.status}
                      </Badge>
                      <span className="text-sm font-medium">Score: {selectedZone.healthScore}%</span>
                    </div>

                    {/* Disease Info */}
                    {selectedZone.disease && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-destructive">Issue Detected:</p>
                        <p className="text-sm">{selectedZone.disease}</p>
                      </div>
                    )}

                    <Separator />

                    {/* Sensor Data */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Environmental Data</h4>

                      <div className="flex items-center gap-3">
                        <Droplets className="h-4 w-4 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm">Soil Moisture</p>
                          <p className="text-lg font-bold">{selectedZone.soilMoisture}%</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border p-2">
                          <div className="text-slate-500">Grid</div>
                          <div className="font-bold uppercase">{selectedZone.gridColor || "green"}</div>
                        </div>
                        <div className="rounded border p-2">
                          <div className="text-slate-500">Pump</div>
                          <div className="font-bold uppercase">{selectedZone.pumpStatus || "off"}</div>
                        </div>
                        <div className="rounded border p-2">
                          <div className="text-slate-500">Cycle</div>
                          <div className="font-bold uppercase">{selectedZone.cycleStatus || "idle"}</div>
                        </div>
                        <div className="rounded border p-2">
                          <div className="text-slate-500">Farm VPD</div>
                          <div className="font-bold uppercase">
                            {displayClimate ? `${displayClimate.vpd.toFixed(2)} kPa` : "Unavailable"} ({displayClimate?.vpdBand || "unavailable"})
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500">
                            {getFarmVpdStatus(displayClimate)}
                          </div>
                        </div>
                      </div>

                      {selectedZone.sensorError && (
                        <p className="text-xs font-semibold text-red-600">
                          {selectedZone.sensorErrorMessage || "Sensor Error"}
                        </p>
                      )}

                      {!selectedZone.decisions?.spray.allowed && (
                        <p className="text-xs font-medium text-amber-700">{selectedZone.decisions?.spray.reason || "Spray conditions are being assessed"}</p>
                      )}

                      <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3 text-xs text-slate-700">
                        <p className="font-bold text-sky-900">Irrigation decision: {getIrrigationActionLabel(selectedZone.decisions?.irrigation)}</p>
                        <p className="mt-1">{selectedZone.decisions?.irrigation.reason || "Waiting for farm weather decision"}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Thermometer className="h-4 w-4 text-orange-600" />
                        <div className="flex-1">
                          <p className="text-sm">Farm Temperature</p>
                          <p className="text-lg font-bold">{displayClimate ? `${displayClimate.temperature}°C` : "—"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Wind className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm">Farm Humidity</p>
                          <p className="text-lg font-bold">{displayClimate ? `${displayClimate.humidity}%` : "—"}</p>
                        </div>
                      </div>
                    </div>
                    {mlData[selectedZone.id] && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium">ML Disease Detection</h4>

                          <div className="text-sm">
                            <strong>Confidence:</strong>{" "}
                            {(mlData[selectedZone.id].confidence * 100).toFixed(2)}%
                          </div>

                          {(() => {
                            const confidence = mlData[selectedZone.id].confidence
                            const humidity = displayClimate?.humidity ?? 0
                            const status = selectedZone.status

                            let spreadRisk = "Low"

                            if (status === "critical" && confidence > 0.7) {
                              spreadRisk = "High"
                            } else if (
                              (confidence > 0.6 && humidity > 70) ||
                              status === "warning"
                            ) {
                              spreadRisk = "Moderate"
                            }

                            const riskColor =
                              spreadRisk === "High"
                                ? "text-red-600 font-semibold"
                                : spreadRisk === "Moderate"
                                  ? "text-yellow-600 font-semibold"
                                  : "text-green-600 font-semibold"

                            return (
                              <div className="text-sm">
                                <strong>Spread Risk:</strong>{" "}
                                <span className={riskColor}>{spreadRisk}</span>
                              </div>
                            )
                          })()}

                          <div className="text-xs text-muted-foreground">
                            Last Scan: {mlData[selectedZone.id].lastScan.toLocaleTimeString()}
                          </div>
                        </div>
                      </>
                    )}

                    {aiRecommendation && (
                      <>
                        <Separator />
                        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-semibold">AI Risk Analysis</h4>

                            <Badge
                              variant={
                                aiRecommendation.severity === "high"
                                  ? "destructive"
                                  : aiRecommendation.severity === "medium"
                                    ? "secondary"
                                    : "default"
                              }
                              className="capitalize"
                            >
                              {aiRecommendation.severity}
                            </Badge>
                          </div>

                          <div className="text-sm">
                            <strong>Risk:</strong> {aiRecommendation.riskType}
                          </div>

                          <div className="text-sm">
                            <strong>Reason:</strong> {aiRecommendation.reason}
                          </div>

                          <div className="text-sm">
                            <strong>Action:</strong> {aiRecommendation.action}
                          </div>

                          <div className="text-sm">
                            💧 Water Required: {aiRecommendation.estimatedWaterLitres} L
                          </div>

                          <div className="text-sm">
                            🌿 Nutrients Required: {aiRecommendation.estimatedNutrientMl} ml
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {aiRecommendation.savingsNote}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Additional Info */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Plant Count:</span>
                        <span className="font-medium">{getCalculatedPlantCount()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Crop Density:</span>
                        <span className="font-medium">1 plant / {getDensityDivisor(farmProfile.primaryCrop)} sq yd</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Last Sprayed:</span>
                        <span className="font-medium">
                          {formatDate(selectedZone.lastSprayed)}
                        </span>
                      </div>
                    </div>


                    <Separator />

                    {/* Hardware Queue */}
                    {commandQueue[selectedZone.id] && commandQueue[selectedZone.id].length > 0 && (
                      <div className="space-y-3 pb-2 pt-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-widest text-blue-700 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                            Hardware Queue
                          </h4>
                          <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-700">
                            {commandQueue[selectedZone.id].length} PENDING
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {commandQueue[selectedZone.id].map((cmd, i) => (
                            <div
                              key={i}
                              className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border shadow-sm transition-all duration-300 ${cmd === "spray" ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"
                                } translate-y-0 hover:-translate-y-0.5`}
                            >
                              {i + 1}. {cmd === "spray" ? "ACTIVATE SPRAYER" : cmd === "stop" ? "STOP PUMP" : "PULSE WATER PUMP"}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Actions */}
                    <div className="space-y-2">
                      <Button
                        className={`w-full ${selectedZone.gridColor === "green"
                          ? "bg-slate-300 hover:bg-slate-300 text-slate-600 border-slate-300 cursor-not-allowed"
                          : !selectedZone.decisions?.irrigation.allowsStart
                            ? "bg-amber-100 hover:bg-amber-100 text-amber-800 border-amber-200 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        variant={selectedZone.gridColor === "green" ? "outline" : "default"}
                        size="sm"
                        disabled={isHydrating || selectedZone.gridColor === "green" || !selectedZone.decisions?.irrigation.allowsStart}
                        onClick={async () => {
                          if (!selectedZone || selectedZone.gridColor === "green" || !selectedZone.decisions?.irrigation.allowsStart) return

                          const confirmed = window.confirm(
                            `Hydrate ${getZoneLabel(selectedZone.id)}? This will start the timed irrigation cycle.`
                          )

                          if (!confirmed) return

                          setIsHydrating(true)

                          try {
                            const response = await fetch("/api/hydrate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ zoneId: selectedZone.id }),
                            })
                            if (!response.ok) {
                              const result = await response.json().catch(() => ({}))
                              window.alert(result?.message || "Hydration could not be started.")
                            }
                            await fetchZones()
                          } finally {
                            setIsHydrating(false)
                          }
                        }}
                      >
                        <Droplets className="mr-2 h-4 w-4" />
                        {isHydrating ? "Hydrating..." : selectedZone.gridColor === "green" ? "Hydrate Locked" : getIrrigationActionLabel(selectedZone.decisions?.irrigation)}
                      </Button>

                      <Button
                        className={`w-full ${
                          selectedZone.decisions?.spray.allowed
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : selectedZone.decisions?.spray.requiresWeatherOverride
                              ? "bg-orange-500 hover:bg-orange-600 text-white"
                              : "bg-red-600 hover:bg-red-700 text-white"
                        }`}
                        size="sm"
                        disabled={isSpraying || (!selectedZone.decisions?.spray.allowed && !selectedZone.decisions?.spray.requiresWeatherOverride)}
                        onClick={async () => {
                          if (!selectedZone) return

                          const sprayDecision = selectedZone.decisions?.spray
                          const weatherOverride = Boolean(sprayDecision?.requiresWeatherOverride && !sprayDecision.allowed)
                          if (!sprayDecision?.allowed && !weatherOverride) {
                            setSprayNotice(sprayDecision?.reason || "Spray conditions are not safe.")
                            return
                          }

                          const confirmed = window.confirm(
                            weatherOverride
                              ? `Forecast safety cannot be confirmed. Override the weather hold and spray ${getZoneLabel(selectedZone.id)}?`
                              : `Spray ${getZoneLabel(selectedZone.id)}? Farm VPD and weather conditions are currently suitable.`
                          )

                          if (!confirmed) return

                          setIsSpraying(true)
                          setSprayNotice(null)

                          try {
                            const response = await fetch("/api/spray", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ zoneId: selectedZone.id, weatherOverride })
                            })

                            const result = await response.json()
                            setSprayNotice(result?.message || result?.decision?.spray?.reason || selectedZone.sprayMessage || null)
                            await fetchZones()
                          } finally {
                            setIsSpraying(false)
                          }
                        }}
                      >
                        <Sprout className="mr-2 h-4 w-4" />
                        {isSpraying ? "Spraying..." : "Spray Now"}
                      </Button>

                      <p className="text-xs text-muted-foreground">
                        {sprayNotice || selectedZone.decisions?.spray.reason || "Spray conditions are being assessed."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Click on any zone in the map to view its detailed information and control options.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {isRecommendationOpen && selectedZoneRecommendation && selectedZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-2xl border-emerald-200 shadow-2xl">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardCheck className="h-5 w-5 text-emerald-700" />
                    Recommended Action
                  </CardTitle>
                  <CardDescription>
                    {getZoneLabel(selectedZone.id)} ({selectedZone.id})
                  </CardDescription>
                </div>

                <Button variant="outline" size="sm" onClick={() => setIsRecommendationOpen(false)}>
                  Close
                </Button>
              </CardHeader>

              <CardContent>
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-green-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Recommended Action
                      </p>
                      <h4 className="mt-1 text-lg font-bold text-slate-900">{selectedZoneRecommendation.actionLabel}</h4>
                    </div>
                    <Badge variant={selectedZoneRecommendation.priorityTone as "default" | "secondary" | "destructive" | "outline"} className="capitalize">
                      {selectedZoneRecommendation.priorityLabel}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Estimated Duration</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{selectedZoneRecommendation.estimatedMinutes} Minutes</p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Reason</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {selectedZoneRecommendation.reasons.map((reason) => (
                          <li key={reason} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog
          open={isLocationDialogOpen}
          onOpenChange={(open) => {
            setIsLocationDialogOpen(open)
            if (!open) setLocationError(null)
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#3a7d44]" />
                Set your farm location
              </DialogTitle>
              <DialogDescription>
                Allow location access or search for the farm. Bhoomitra will use these coordinates for the weather forecast, rain-aware irrigation, and spray safety checks.
              </DialogDescription>
            </DialogHeader>

            <FarmLocationPicker
              value={draftFarmLocation}
              onChange={(location) => {
                setDraftFarmLocation(location)
                setLocationError(null)
              }}
              fallbackLabel="Current farm location"
              disabled={isSavingLocation}
            />

            {locationError && <p className="text-sm font-medium text-red-600">{locationError}</p>}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLocationDialogOpen(false)}
                disabled={isSavingLocation}
              >
                Set later
              </Button>
              <Button
                type="button"
                onClick={handleSaveFarmLocation}
                disabled={isSavingLocation || !draftFarmLocation}
                className="bg-[#3a7d44] text-white hover:bg-[#2e6336]"
              >
                {isSavingLocation ? "Saving location..." : "Save farm location"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
