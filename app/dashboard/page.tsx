"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import WeatherStrip from "@/components/weather-strip"
import SprayWindowTimeline from "@/components/spray-window-timeline"
import {
  AlertTriangle,
  ChevronDown,
  Droplets,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react"

type ZoneSnapshot = {
  id: string
  soilMoisture: number
  status: "healthy" | "warning" | "critical" | "uncertain"
  activeDetection?: boolean
  gridColor?: "red" | "yellow" | "green"
  pumpStatus?: "on" | "off"
  cycleStatus?: "idle" | "running" | "cooldown" | "done" | "error"
  sensorError?: boolean
  decisions?: { irrigation?: { action?: string } }
}
type ClimateSnapshot = { vpd: number | null; vpdBand: "green" | "orange" | "red" | "unavailable" | null }
type ActivityItem = { type: "spray" | "water" | "alert"; zoneId: string; timestamp: string }
type ControllerSnapshot = { currentAction?: string; activeZoneId?: string | null; awaitingFeedback?: boolean; lastFeedback?: string | null; queuedCommandCount?: number }
type Recommendation = {
  id: string
  kind: "treatment" | "irrigation" | "preventive"
  title: string
  action: string
  timing: string
  zone: string
  weatherGated: boolean
  confidence?: number
  severity?: "low" | "moderate" | "high"
  disease?: string
}
type Impact = {
  diseasePressure: { score: number; band: "low" | "moderate" | "high" }
  yield: { headline: null | { curable: boolean; projectedProtectedPct: number; projectedLossPct: number; disease: string } }
}
type Water = { calibrated: boolean; targetedVsBroadcast: { savedLitres: number; savedPercent: number } }

const PILOT_ZONE_IDS = ["A1", "A2", "A3", "A4"]

export default function DashboardHome() {
  const [zones, setZones] = useState<ZoneSnapshot[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [controller, setController] = useState<ControllerSnapshot>({})
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [impact, setImpact] = useState<Impact | null>(null)
  const [water, setWater] = useState<Water | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [climate, setClimate] = useState<ClimateSnapshot>({ vpd: null, vpdBand: null })
  // Which Active Detections row (if any) has its action/recommendation
  // detail expanded. Collapsed by default — the initial view stays compact.
  const [expandedDetectionId, setExpandedDetectionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [zonesRes, recRes, impactRes, waterRes] = await Promise.all([
        fetch("/api/zones", { cache: "no-store" }),
        fetch("/api/recommendations", { cache: "no-store" }),
        fetch("/api/farm-impact", { cache: "no-store" }),
        fetch("/api/water-summary", { cache: "no-store" }),
      ])
      if (!zonesRes.ok) throw new Error("zone snapshot failed")
      const z = await zonesRes.json()
      setZones(Array.isArray(z?.zones) ? z.zones : [])
      setActivity(Array.isArray(z?.recentActivity) ? z.recentActivity : [])
      setController(z?.controller || {})
      setClimate({
        vpd: typeof z?.climatePresentation?.vpd === "number" ? z.climatePresentation.vpd : null,
        vpdBand: z?.climatePresentation?.vpdBand ?? null,
      })
      if (recRes.ok) setRecommendations((await recRes.json())?.recommendations || [])
      if (impactRes.ok) setImpact(await impactRes.json())
      if (waterRes.ok) setWater(await waterRes.json())
      setNotice(null)
    } catch {
      setNotice("Refreshing the farm snapshot. Previously loaded observations stay on screen until the connection returns.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 12_000)
    return () => window.clearInterval(timer)
  }, [load])

  const pilotZones = zones.filter((zone) => PILOT_ZONE_IDS.includes(zone.id))
  const pilotMoisture = pilotZones.map((zone) => Number(zone.soilMoisture)).filter(Number.isFinite)
  const moistureRange = pilotMoisture.length ? `${Math.round(Math.min(...pilotMoisture))}–${Math.round(Math.max(...pilotMoisture))}%` : "—"
  const dryPilotZones = pilotZones.filter((zone) => zone.soilMoisture < 40)

  // The recommendations engine already derives one entry per active,
  // actionable detection (kind "treatment" or "preventive"); irrigation
  // entries are a separate concern and excluded here.
  const activeDetectionItems = recommendations.filter((r) => r.kind === "treatment" || r.kind === "preventive")
  const hasActiveDetections = activeDetectionItems.length > 0

  // Live Operations Snapshot — moved here from the Farm Map page. Reuses the
  // same zones already fetched above; no new API calls.
  const runningCycleCount = zones.filter((zone) => zone.cycleStatus === "running").length
  const pumpOnCount = zones.filter((zone) => zone.pumpStatus === "on").length
  const sensorErrorCount = zones.filter((zone) => zone.sensorError).length
  const redGridCount = zones.filter((zone) => zone.gridColor === "red").length
  const farmVpdIsOptimal = climate.vpdBand === "green"
  const recommendedActions = zones
    .map((zone) => {
      const irrigationAction = zone.decisions?.irrigation?.action
      const requiresIrrigation = irrigationAction === "irrigate_now"
      const requiresMonitoring =
        zone.gridColor === "yellow" ||
        zone.status === "warning" ||
        irrigationAction === "defer_for_rain" ||
        irrigationAction === "monitor_after_rain"
      const hasDiseaseAlert = Boolean(zone.activeDetection)
      const priority = requiresIrrigation ? 0 : hasDiseaseAlert ? 1 : requiresMonitoring ? 2 : 3
      const label = requiresIrrigation
        ? `Irrigate ${zone.id}`
        : irrigationAction === "defer_for_rain"
          ? `Defer ${zone.id} — rain expected`
          : irrigationAction === "monitor_after_rain"
            ? `Monitor ${zone.id} after rain`
        : hasDiseaseAlert
          ? `Disease inspection recommended for ${zone.id}`
          : requiresMonitoring
            ? `Monitor ${zone.id}`
            : `Observe ${zone.id}`
      return { zoneId: zone.id, label, priority }
    })
    .sort((a, b) => a.priority - b.priority || a.zoneId.localeCompare(b.zoneId))
    .slice(0, 4)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-strong/80">Bhoomitra · Farm Overview</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-[#14231a]">Good day on the farm</h1>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-[#285d32] transition hover:bg-emerald-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900">{notice}</div>
      )}

      {/* Row 1 — Field at a Glance (medium/slightly larger) beside Active Detections (slightly narrower) */}
      <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-slate-100 bg-white p-6 elevated">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-800">
              <MapPin className="h-4.5 w-4.5 text-brand-strong" /> Field at a Glance
            </h2>
            <Link href="/dashboard/map" className="text-xs font-black text-brand-strong hover:underline">Open map →</Link>
          </div>
          <p className="mt-1 text-xs text-slate-500">12 zones · coloured by soil moisture · A1–A4 pump pilot.</p>
          <div className="mt-4 grid grid-cols-6 gap-2">
            {(zones.length ? zones : Array.from({ length: 12 })).map((zone: any, index) => {
              const moisture = zone ? Number(zone.soilMoisture) : null
              const tone = moisture == null ? "bg-slate-100" : moisture < 25 ? "bg-red-400" : moisture < 40 ? "bg-amber-300" : "bg-emerald-300"
              const isPilot = zone && PILOT_ZONE_IDS.includes(zone.id)
              return (
                <div key={zone?.id || index} className={`flex h-14 flex-col items-center justify-center rounded-lg ${tone} ${isPilot ? "ring-2 ring-brand-strong/60" : ""}`}>
                  <span className="text-[10px] font-black text-white/90">{zone?.id || ""}</span>
                  {moisture != null && <span className="text-[9px] font-bold text-white/70">{Math.round(moisture)}%</span>}
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Good moisture</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> Below target</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Low moisture</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-brand-strong/60" /> Pump pilot</span>
          </div>
          {(controller?.queuedCommandCount || 0) > 0 && (
            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
              {controller.queuedCommandCount} pump command{controller.queuedCommandCount === 1 ? "" : "s"} in the queue — awaiting controller feedback.
            </p>
          )}
        </section>

        <section
          className={`relative overflow-hidden rounded-2xl border p-4 elevated ${hasActiveDetections ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white"}`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${hasActiveDetections ? "bg-amber-600 text-white" : "bg-emerald-100 text-emerald-700"}`}>
              {hasActiveDetections ? <AlertTriangle className="h-4.5 w-4.5" /> : <ShieldCheck className="h-4.5 w-4.5" />}
            </div>
            <div>
              <h2 className={`text-lg font-black leading-tight md:text-xl ${hasActiveDetections ? "text-amber-800" : "text-emerald-700"}`}>
                Active Detections
              </h2>
              <p className="text-xs text-slate-600">
                {hasActiveDetections
                  ? `${activeDetectionItems.length} zone${activeDetectionItems.length === 1 ? "" : "s"} need${activeDetectionItems.length === 1 ? "s" : ""} your attention.`
                  : "No active disease detections. Your farm is healthy today."}
              </p>
            </div>
          </div>

          {hasActiveDetections && (
            <div className="relative mt-3 space-y-2">
              {activeDetectionItems.map((item) => {
                const isExpanded = expandedDetectionId === item.id
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-white/80 backdrop-blur"
                  >
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {item.zone}
                          {typeof item.confidence === "number" ? ` · ${item.confidence}% confidence` : ""}
                        </p>
                        <p className="truncate text-sm font-bold text-slate-800">{item.title}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedDetectionId((current) => (current === item.id ? null : item.id))}
                        aria-expanded={isExpanded}
                        className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg bg-brand-strong px-3.5 py-1.5 text-sm font-black text-white transition hover:opacity-90"
                      >
                        <Zap className="h-3.5 w-3.5" /> Act now
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-100 px-3 pb-3 pt-2.5">
                        <p className="text-xs text-slate-600">{item.action} · {item.timing}</p>
                        <Link
                          href={item.kind === "treatment" ? `/dashboard/autospray?zone=${encodeURIComponent(item.zone)}` : `/dashboard/recommendations?zone=${encodeURIComponent(item.zone)}`}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-black text-brand-strong hover:underline"
                        >
                          {item.kind === "treatment" ? "Open Smart Spray →" : "View full guidance →"}
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Row 2 — Weather (~75% width) and Soil Moisture (~25% width): matching heights, aligned edges */}
      <div className="grid gap-5 lg:grid-cols-[3fr_1fr]">
        <WeatherStrip />

        <section className="flex flex-col rounded-3xl border border-slate-100 bg-white p-6 elevated">
          <h2 className="flex items-center gap-2.5 text-lg font-black text-slate-800">
            <Droplets className="h-5 w-5 text-brand-strong" /> Soil Moisture
          </h2>
          <p className="mt-1 text-sm text-slate-500">Pilot zones A1–A4.</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-3xl font-black tabular-nums text-[#14231a]">{moistureRange}</p>
            <p className="mt-1 text-sm text-slate-500">
              {dryPilotZones.length ? `${dryPilotZones.map((z) => z.id).join(", ")} below target` : "All pilot zones above target"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {pilotZones.map((zone) => (
                <div key={zone.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{zone.id}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-700">{Math.round(zone.soilMoisture)}%</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Row 3 — Spray Window: same data/logic as AI Recommendations, full width */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 elevated">
        <h2 className="text-lg font-black text-slate-800">Spray Window</h2>
        <p className="mt-1 text-sm text-slate-500">Best time to spray, next 48 hours.</p>
        <div className="mt-4">
          <SprayWindowTimeline />
        </div>
      </section>

      {/* Row 4 — Live Operations Snapshot: moved here from the Farm Map page */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 elevated">
        <h2 className="text-lg font-black text-slate-800">Live Operations Snapshot</h2>
        <p className="mt-1 text-sm text-slate-500">Quick view of what is happening right now.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">Cycles Running</p>
            <p className="text-lg font-bold text-blue-700">{runningCycleCount}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">Pumps ON</p>
            <p className="text-lg font-bold text-cyan-700">{pumpOnCount}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">Sensor Errors</p>
            <p className="text-lg font-bold text-red-700">{sensorErrorCount}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">Farm VPD</p>
            <p className={`text-lg font-bold ${farmVpdIsOptimal ? "text-green-700" : "text-amber-700"}`}>
              {climate.vpd != null ? `${climate.vpd.toFixed(2)} kPa` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">Red Moisture Grids</p>
            <p className="text-lg font-bold text-amber-700">{redGridCount}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">Tracked Zones</p>
            <p className="text-lg font-bold text-slate-700">{zones.length}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Today&apos;s Recommended Actions</p>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              {recommendedActions.length > 0 ? (
                recommendedActions.map((item) => (
                  <div key={item.zoneId} className="flex items-start gap-2">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-600" />
                    <span>{item.label}</span>
                  </div>
                ))
              ) : (
                <span>No immediate action required</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
