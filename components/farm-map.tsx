"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
} from "lucide-react"
import { generateRecommendation } from "@/lib/ai-engine"
import HardwareSafetyPanel from "@/components/hardware-safety-panel"


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
  vpdBand?: "green" | "orange" | "red"
  sprayEnabled?: boolean
  sprayMessage?: string
}

interface ZonesApiResponse {
  zones: ZoneData[]
  irrigation: {
    dryThreshold: number
    wetThreshold: number
    ripeningMode: boolean
    hydrateDisabled: boolean
    hydrateReason: string | null
    targetedZoneIds: string[]
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

function getVpdTimingEstimate(zone: ZoneData) {
  if (zone.vpdBand === "green") {
    return "Optimal now"
  }

  if (zone.vpdBand === "orange") {
    return "Estimated optimal window: about 10-20 min"
  }

  if (typeof zone.vpd === "number" && zone.vpd < 0.8) {
    return "Too wet right now; no reliable green-window time estimate"
  }

  return "No reliable time estimate from live sensors"
}

export default function FarmMap() {
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null)
  const [isSpraying, setIsSpraying] = useState(false)
  const [sprayNotice, setSprayNotice] = useState<string | null>(null)
  const [isHydrating, setIsHydrating] = useState(false)
  const [isGlobalHydrating, setIsGlobalHydrating] = useState(false)
  const [commandQueue, setCommandQueue] = useState<Record<string, string[]>>({})
  const [zoomLevel, setZoomLevel] = useState(1)
  const { updateSensorData } = useFarmStore()
  const [farmProfile, setFarmProfile] = useState<FarmProfile>({
    acres: 6,
    zones: 24,
    zoneCount: 24,
    primaryCrop: "Other",
    zoneNames: {},
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
        setFarmProfile({
          acres: data.profile.acres,
          zones: data.profile.zones,
          zoneCount: data.profile.zoneCount,
          primaryCrop: data.profile.primaryCrop,
          zoneNames: data.profile.zoneNames || {},
        })
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

  const calculateSuitability = (zone: ZoneData) => {
    let score = 0

    if (zone.humidity > 85) score += 0.5
    else if (zone.humidity > 70) score += 0.3

    if (zone.temperature >= 18 && zone.temperature <= 28) score += 0.3
    else if (zone.temperature > 28 && zone.temperature <= 32) score += 0.1

    return Math.min(score, 1)
  }

  const calculateConfidence = (zone: ZoneData) => {
    let confidence = 0.15

    if (zone.humidity > 80 && zone.temperature >= 18 && zone.temperature <= 28) {
      confidence = 0.65
    } else if (zone.humidity > 65) {
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
  const greenVpdCount = visibleZones.filter(zone => zone.vpdBand === "green").length
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

  useEffect(() => {
    if (visibleZones.length === 0) return

    const calculateML = () => {
      setMlData(prev => {
        const updated = { ...prev }

        const dynamicZones = visibleZones.map(zone => zone.id)

        dynamicZones.forEach(zoneId => {
          const zone = visibleZones.find(z => z.id === zoneId)
          if (!zone) return
          const confidence = calculateConfidence(zone)




          updated[zone.id] = {
            confidence,
            suitability: calculateSuitability(zone),
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
  }, [visibleZones])

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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut} className="bg-transparent">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn} className="bg-transparent">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} className="bg-transparent">
              <RotateCcw className="h-4 w-4" />
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
                <span className="text-sm">Healthy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-yellow-500 border border-yellow-600" />
                <span className="text-sm">Warning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-red-500 border border-red-600" />
                <span className="text-sm">Critical</span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <p className="text-sm text-muted-foreground">Click on any zone for detailed information</p>
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

        <div className="grid gap-6 lg:grid-cols-3 items-start">
          {/* Farm Map */}
          <div className="lg:col-span-2 space-y-6">

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
                      onClick={() => setSelectedZone(zone)}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                        <span className="text-[10px] font-bold text-white opacity-80 uppercase leading-none">{getZoneLabel(zone.id)}</span>
                        <span className="text-xs font-black text-white">{zone.soilMoisture}%</span>
                        <span className="text-[9px] text-white/80">{zone.id}</span>
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
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
                    <p className="text-xs text-slate-500">Green VPD Zones</p>
                    <p className="text-lg font-bold text-green-700">{greenVpdCount}</p>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-slate-500">Red Moisture Grids</p>
                    <p className="text-lg font-bold text-amber-700">{redGridCount}</p>
                  </div>
                  <div className="rounded border p-3">
                    <p className="text-xs text-slate-500">Tracked Zones</p>
                    <p className="text-lg font-bold text-slate-700">{visibleZones.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Zone Details */}
          <div>
            <Card>
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
                  <div className="space-y-4">
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
                          <div className="text-slate-500">VPD</div>
                          <div className="font-bold uppercase">
                            {typeof selectedZone.vpd === "number" ? selectedZone.vpd.toFixed(2) : "0.00"} ({selectedZone.vpdBand || "red"})
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500">
                            {getVpdTimingEstimate(selectedZone)}
                          </div>
                        </div>
                      </div>

                      {selectedZone.sensorError && (
                        <p className="text-xs font-semibold text-red-600">
                          {selectedZone.sensorErrorMessage || "Sensor Error"}
                        </p>
                      )}

                      {!selectedZone.sprayEnabled && (
                        <p className="text-xs font-medium text-amber-700">Hold spray until optimal VPD window</p>
                      )}

                      <div className="flex items-center gap-3">
                        <Thermometer className="h-4 w-4 text-orange-600" />
                        <div className="flex-1">
                          <p className="text-sm">Temperature</p>
                          <p className="text-lg font-bold">{selectedZone.temperature}°C</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Wind className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm">Humidity</p>
                          <p className="text-lg font-bold">{selectedZone.humidity}%</p>
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
                            const humidity = selectedZone.humidity
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

                    <Separator />
                    {/* AI Recommendation */}
                    {aiRecommendation && (
                      <div className="mt-4 p-4 rounded-lg border bg-muted/40 space-y-3">

                        {/* Header + Severity Badge */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">AI Risk Analysis</span>

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
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        variant={selectedZone.gridColor === "green" ? "outline" : "default"}
                        size="sm"
                        disabled={isHydrating || selectedZone.gridColor === "green"}
                        onClick={async () => {
                          if (!selectedZone || selectedZone.gridColor === "green") return

                          const confirmed = window.confirm(
                            `Hydrate ${getZoneLabel(selectedZone.id)}? This will start the timed irrigation cycle.`
                          )

                          if (!confirmed) return

                          setIsHydrating(true)

                          try {
                            await fetch("/api/hydrate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ zoneId: selectedZone.id }),
                            })

                            const res = await fetch("/api/zones")
                            const raw = await res.json()
                            const zoneList: ZoneData[] = Array.isArray(raw) ? raw : raw.zones || []
                            setFarmData(zoneList)

                            const updatedZone = zoneList.find((z: ZoneData) => z.id === selectedZone.id)
                            if (updatedZone) {
                              setSelectedZone(updatedZone)
                            }
                          } finally {
                            setIsHydrating(false)
                          }
                        }}
                      >
                        <Droplets className="mr-2 h-4 w-4" />
                        {isHydrating ? "Hydrating..." : selectedZone.gridColor === "green" ? "Hydrate Locked" : "Hydrate Zone"}
                      </Button>

                      <Button
                        className={`w-full ${
                          selectedZone.vpdBand === "green"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : selectedZone.vpdBand === "orange"
                              ? "bg-orange-500 hover:bg-orange-600 text-white"
                              : "bg-red-600 hover:bg-red-700 text-white"
                        }`}
                        size="sm"
                        disabled={isSpraying}
                        onClick={async () => {
                          if (!selectedZone) return

                          const confirmed = window.confirm(
                            `Spray ${getZoneLabel(selectedZone.id)}? VPD is advisory and you can override this recommendation.`
                          )

                          if (!confirmed) return

                          setIsSpraying(true)
                          setSprayNotice(null)

                          const response = await fetch("/api/spray", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ zoneId: selectedZone.id })
                          })

                          const result = await response.json()
                          setSprayNotice(result?.message || selectedZone.sprayMessage || null)

                          const res = await fetch("/api/zones")
                          const raw = await res.json()
                          const zoneList: ZoneData[] = Array.isArray(raw) ? raw : raw.zones || []
                          setFarmData(zoneList)

                          const updatedZone = zoneList.find((z: ZoneData) => z.id === selectedZone.id)
                          if (updatedZone) {
                            setSelectedZone(updatedZone)
                          }

                          setIsSpraying(false)
                        }}
                      >
                        <Sprout className="mr-2 h-4 w-4" />
                        {isSpraying ? "Spraying..." : "Spray Now"}
                      </Button>

                      <p className="text-xs text-muted-foreground">
                        {sprayNotice || selectedZone.sprayMessage || "VPD is advisory. You can override after confirmation."}
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
      </div>
    </div>
  )
}
