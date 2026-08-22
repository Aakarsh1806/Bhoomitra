"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import WeatherStrip from "@/components/weather-strip"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Droplets,
  Leaf,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Zap,
} from "lucide-react"

type ZoneSnapshot = {
  id: string
  soilMoisture: number
  status: "healthy" | "warning" | "critical" | "uncertain"
  activeDetection?: boolean
}
type ActivityItem = { type: "spray" | "water" | "alert"; zoneId: string; timestamp: string }
type ControllerSnapshot = { currentAction?: string; activeZoneId?: string | null; awaitingFeedback?: boolean; lastFeedback?: string | null; queuedCommandCount?: number }
type Recommendation = { id: string; kind: "treatment" | "irrigation" | "preventive"; title: string; action: string; timing: string; zone: string; weatherGated: boolean }
type Impact = {
  diseasePressure: { score: number; band: "low" | "moderate" | "high" }
  yield: { headline: null | { curable: boolean; projectedProtectedPct: number; projectedLossPct: number; disease: string } }
}
type Water = { calibrated: boolean; targetedVsBroadcast: { savedLitres: number; savedPercent: number } }

const PILOT_ZONE_IDS = ["A1", "A2", "A3", "A4"]

function activityLabel(activity: ActivityItem) {
  if (activity.type === "water") return `Water-pump pulse completed in ${activity.zoneId}`
  if (activity.type === "spray") return `Confirmed application completed in ${activity.zoneId}`
  return `Field alert recorded in ${activity.zoneId}`
}

export default function DashboardHome() {
  const [zones, setZones] = useState<ZoneSnapshot[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [controller, setController] = useState<ControllerSnapshot>({})
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [impact, setImpact] = useState<Impact | null>(null)
  const [water, setWater] = useState<Water | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

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

  const activeDetections = zones.filter((zone) => zone.activeDetection)
  const criticalZones = zones.filter((zone) => zone.status === "critical")
  const pilotZones = zones.filter((zone) => PILOT_ZONE_IDS.includes(zone.id))
  const pilotMoisture = pilotZones.map((zone) => Number(zone.soilMoisture)).filter(Number.isFinite)
  const moistureRange = pilotMoisture.length ? `${Math.round(Math.min(...pilotMoisture))}–${Math.round(Math.max(...pilotMoisture))}%` : "—"
  const dryPilotZones = pilotZones.filter((zone) => zone.soilMoisture < 40)
  const priority = recommendations[0]
  const queueCount = controller?.queuedCommandCount || 0

  // Farmer-language farm verdict first; numbers are subtext.
  const attention = activeDetections.length > 0 || criticalZones.length > 0
  const attentionCount = activeDetections.length || criticalZones.length
  const verdict = attention
    ? `${attentionCount} zone${attentionCount === 1 ? " needs" : "s need"} your attention`
    : "Your farm is healthy today"
  const verdictSub = attention
    ? `Active detections in ${(activeDetections.length ? activeDetections : criticalZones).map((z) => z.id).join(", ")}. Act on the priority below.`
    : "No active disease and no zone in the red. Keep scouting and watch the weather."

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

      <WeatherStrip />

      {notice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900">{notice}</div>
      )}

      {/* Hero verdict banner — farmer language first */}
      <section
        className={`relative overflow-hidden rounded-3xl border p-6 elevated md:p-7 ${attention ? "border-red-100 bg-gradient-to-br from-red-50 to-white" : "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white"}`}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-2xl"
          style={{ background: attention ? "radial-gradient(circle, rgba(239,68,68,0.22), transparent 70%)" : "radial-gradient(circle, rgba(16,185,129,0.28), transparent 70%)" }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${attention ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
              {attention ? <AlertTriangle className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div>
              <h2 className={`text-2xl font-black leading-tight md:text-3xl ${attention ? "text-red-700" : "text-emerald-700"}`}>{loading && !zones.length ? "Reading the field…" : verdict}</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-600">{verdictSub}</p>
            </div>
          </div>
          {priority && (
            <div className="shrink-0 rounded-2xl border border-slate-100 bg-white/80 p-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Do this first</p>
              <p className="mt-1 max-w-xs text-sm font-bold text-slate-800">{priority.title}</p>
              <Link
                href={priority.kind === "treatment" ? `/dashboard/autospray?zone=${encodeURIComponent(priority.zone)}` : "/dashboard/recommendations"}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-strong px-4 py-2 text-sm font-black text-white transition hover:opacity-90"
              >
                <Zap className="h-4 w-4" /> Act now
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Confident numbers — the best of what the app knows */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Leaf className="h-5 w-5" />} tone="emerald" label="Projected yield protected"
          value={impact?.yield.headline?.curable ? `~${impact.yield.headline.projectedProtectedPct}%` : impact?.yield.headline ? "Cultural" : "—"}
          sub={impact?.yield.headline?.curable ? `by treating ${impact.yield.headline.disease} in time` : impact?.yield.headline ? "non-curable — manage, don't cure" : "no active threat"} />
        <StatCard icon={<Droplets className="h-5 w-5" />} tone="sky" label="Water saved now"
          value={water?.calibrated ? `≈${water.targetedVsBroadcast.savedLitres} L` : "—"}
          sub={water?.calibrated ? `${water.targetedVsBroadcast.savedPercent}% vs. broadcasting` : "run a pump command to log"} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} tone={impact?.diseasePressure.band === "high" ? "red" : impact?.diseasePressure.band === "moderate" ? "amber" : "emerald"} label="Disease pressure"
          value={impact ? `${impact.diseasePressure.score}/100` : "—"}
          sub={impact ? `${impact.diseasePressure.band} · weather-driven` : "checking weather"} />
        <StatCard icon={<Droplets className="h-5 w-5" />} tone="amber" label="Pilot soil moisture"
          value={moistureRange}
          sub={dryPilotZones.length ? `${dryPilotZones.map((z) => z.id).join(", ")} below target` : "all pilot zones above target"} />
      </div>

      {/* Activity + zone strip */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 elevated">
          <h2 className="flex items-center gap-2.5 text-lg font-black text-slate-800"><Activity className="h-5 w-5 text-brand-strong" /> Recent confirmed activity</h2>
          <p className="mt-1 text-sm text-slate-500">Only controller-confirmed pump actions appear here.</p>
          <div className="mt-5 space-y-3">
            {activity.length ? activity.slice(0, 4).map((item, index) => (
              <div key={`${item.zoneId}-${item.timestamp}-${index}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-xl bg-emerald-50 p-2.5 text-brand-strong">{item.type === "spray" ? <CloudRain className="h-5 w-5" /> : <Droplets className="h-5 w-5" />}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-700">{activityLabel(item)}</p>
                    <p className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Closed</span>
              </div>
            )) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm font-medium text-slate-500">Completed pump actions show up here after your controller reports back.</div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-6 elevated">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2.5 text-lg font-black text-slate-800"><MapPin className="h-5 w-5 text-brand-strong" /> Field at a glance</h2>
            <Link href="/dashboard/map" className="text-xs font-black text-brand-strong hover:underline">Open map →</Link>
          </div>
          <p className="mt-1 text-sm text-slate-500">12 zones · coloured by soil moisture · A1–A4 pump pilot.</p>
          <div className="mt-5 grid grid-cols-6 gap-2">
            {(zones.length ? zones : Array.from({ length: 12 })).map((zone: any, index) => {
              const moisture = zone ? Number(zone.soilMoisture) : null
              const tone = moisture == null ? "bg-slate-100" : moisture < 25 ? "bg-red-400" : moisture < 40 ? "bg-amber-300" : "bg-emerald-300"
              const isPilot = zone && PILOT_ZONE_IDS.includes(zone.id)
              return (
                <div key={zone?.id || index} className={`flex aspect-square flex-col items-center justify-center rounded-xl ${tone} ${isPilot ? "ring-2 ring-brand-strong/60" : ""}`}>
                  <span className="text-[11px] font-black text-white/90">{zone?.id || ""}</span>
                  {moisture != null && <span className="text-[9px] font-bold text-white/70">{Math.round(moisture)}%</span>}
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Good moisture</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> Below target</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Low moisture</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-brand-strong/60" /> Pump pilot</span>
          </div>
          {queueCount > 0 && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">{queueCount} pump command{queueCount === 1 ? "" : "s"} in the queue — awaiting controller feedback.</p>}
        </section>
      </div>
    </div>
  )
}

function StatCard({ icon, tone, label, value, sub }: { icon: React.ReactNode; tone: "emerald" | "sky" | "amber" | "red"; label: string; value: string; sub: string }) {
  const map = {
    emerald: { text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-600", ring: "rgba(16,185,129,0.28)" },
    sky: { text: "text-sky-700", chip: "bg-sky-50 text-sky-600", ring: "rgba(14,165,233,0.28)" },
    amber: { text: "text-amber-700", chip: "bg-amber-50 text-amber-600", ring: "rgba(245,158,11,0.28)" },
    red: { text: "text-red-700", chip: "bg-red-50 text-red-600", ring: "rgba(239,68,68,0.28)" },
  }[tone]
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 elevated" style={{ boxShadow: `0 0 30px -14px ${map.ring}` }}>
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <div className={`rounded-xl p-2 ${map.chip}`}>{icon}</div>
      </div>
      <p className={`mt-2 text-3xl font-black tabular-nums ${map.text}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  )
}
