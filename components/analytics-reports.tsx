"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, BadgeIndianRupee, CheckCircle2, Clock3, Droplets, Leaf, MapPin, RefreshCw, ShieldCheck, Sprout } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"

type WaterSummary = {
  calibrated: boolean
  season: { totalLitres: number; irrigationLitres: number; sprayLitres: number; commandCount: number }
  targetedVsBroadcast: { savedLitres: number; savedPercent: number; targetedLitres: number; broadcastLitres: number; basis: string }
}

type FarmImpact = {
  diseasePressure: { score: number; band: "low" | "moderate" | "high"; drivers: string[]; label: string }
  infectionsAvoided: { value: number; baseline: number; protectedOutcome: number; label: string }
  yield: {
    hasActive: boolean
    headline: null | { disease: string; crop: string; zoneId: string; curable: boolean; lossLowPct: number; lossHighPct: number; projectedLossPct: number; projectedProtectedPct: number; note?: string }
    basis: string
  }
  coverage: { acres: number; zoneCount: number; monitoredZones: number }
}

type ZoneAnalytics = {
  zoneId: string
  soilMoisture: number
  activeDetections: number
  historicalScans: number
  completedApplications: number
  queuedApplications: number
  currentRiskPercent: number
  status: "critical" | "monitor" | "stable"
  latestDisease: string | null
}

type DiseaseGroup = {
  name: string
  records: number
  active: number
  highestSeverity: "low" | "moderate" | "high"
  crops: string[]
}

type AnalyticsData = {
  totalDetections: number
  totalSprays: number
  queuedApplications: number
  currentRiskPercent: number
  activeDetections: number
  activeZoneCount: number
  farmZoneCount: number
  severityBreakdown: { high: number; moderate: number; low: number }
  zoneAnalytics: ZoneAnalytics[]
  diseaseAnalytics: DiseaseGroup[]
  waterModel: { completedChemicalApplications: number; waterValidationTests: number; calibrationRequired: boolean; message: string }
  financial: { currency: string; totalInputCostInr: number | null; applicationsWithCost: number; completedApplications: number; message: string }
  responseTiming: { completedLinkedApplications: number; averageHours: number | null; message: string }
  preHarvest: { activeHolds: number; nextReleaseAt: string | null; message: string }
  cropContext: { farmCrop: string; crossCropRecords: number; message: string }
}

const statusStyle = (status: ZoneAnalytics["status"]) =>
  status === "critical"
    ? "border-red-200 bg-red-50 text-red-950"
    : status === "monitor"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-emerald-200 bg-emerald-50 text-emerald-950"

const severityStyle = (severity: DiseaseGroup["highestSeverity"]) =>
  severity === "high" ? "destructive" : severity === "moderate" ? "secondary" : "outline"

function PressureGauge({ score, band, drivers }: { score: number; band: string; drivers: string[] }) {
  const color = band === "high" ? "#dc2626" : band === "moderate" ? "#f59e0b" : "#10b981"
  const r = 54
  const cx = 70
  const cy = 64
  const len = Math.PI * r
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  return (
    <div>
      <p className="text-center text-xs font-bold uppercase tracking-wide text-slate-500">Disease pressure</p>
      <div className="relative mx-auto mt-2" style={{ width: 140, height: 78 }}>
        <svg viewBox="0 0 140 78" className="w-full">
          <path d={path} fill="none" stroke="#e2e8f0" strokeWidth={10} strokeLinecap="round" />
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * len} ${len}`}
            style={{ transition: "stroke-dasharray 0.7s ease" }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-3xl font-black" style={{ color }}>{score}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 capitalize">{band}</span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">{drivers?.[0] || "Conditions assessed from live weather."}</p>
    </div>
  )
}

function YieldBar({ protectedPct, lossPct }: { protectedPct: number; lossPct: number }) {
  const clampedLoss = Math.max(0, Math.min(100, lossPct))
  const clampedProtected = Math.max(0, Math.min(clampedLoss, protectedPct))
  const residual = Math.max(0, clampedLoss - clampedProtected)
  const safe = Math.max(0, 100 - clampedLoss)
  return (
    <div className="mt-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div style={{ width: `${clampedProtected}%` }} className="bg-emerald-500" />
        <div style={{ width: `${residual}%` }} className="bg-red-400" />
        <div style={{ width: `${safe}%` }} className="bg-slate-200" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> protected ~{clampedProtected}%</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> residual loss ~{residual}%</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> unaffected ~{safe}%</span>
      </div>
    </div>
  )
}

function MiniStat({ tone, label, value, sub }: { tone: "emerald" | "sky" | "slate"; label: string; value: string; sub: string }) {
  const accent = tone === "emerald" ? "text-emerald-700" : tone === "sky" ? "text-sky-700" : "text-slate-800"
  const ring = tone === "emerald" ? "rgba(16,185,129,0.3)" : tone === "sky" ? "rgba(14,165,233,0.3)" : "rgba(100,116,139,0.2)"
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4" style={{ boxShadow: `0 0 26px -14px ${ring}` }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${accent}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
    </div>
  )
}

export default function AnalyticsReports() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [water, setWater] = useState<WaterSummary | null>(null)
  const [impact, setImpact] = useState<FarmImpact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMethod, setShowMethod] = useState(false)
  const [cropScope, setCropScope] = useState<"farm" | "all">("farm")

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [analyticsRes, waterRes, impactRes] = await Promise.all([
        fetch("/api/analytics"),
        fetch("/api/water-summary"),
        fetch("/api/farm-impact"),
      ])
      if (!analyticsRes.ok) throw new Error("Analytics could not be refreshed")
      setData(await analyticsRes.json())
      if (waterRes.ok) setWater(await waterRes.json())
      if (impactRes.ok) setImpact(await impactRes.json())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Analytics could not be refreshed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const fieldHealth = Math.max(0, Math.min(100, 100 - (data?.currentRiskPercent || 0)))
  const severityData = data
    ? [
        { name: "High", value: data.severityBreakdown.high, color: "#dc2626" },
        { name: "Moderate", value: data.severityBreakdown.moderate, color: "#f59e0b" },
        { name: "Low", value: data.severityBreakdown.low, color: "#10b981" },
      ].filter((slice) => slice.value > 0)
    : []
  const zoneRiskData = data ? data.zoneAnalytics.map((zone) => ({ zone: zone.zoneId, risk: Math.round(zone.currentRiskPercent), soil: zone.soilMoisture })) : []
  const visibleDiseaseGroups = useMemo(() => {
    if (!data) return []
    if (cropScope === "all") return data.diseaseAnalytics
    return data.diseaseAnalytics.filter((group) => group.crops.some((crop) => crop.toLowerCase() === data.cropContext.farmCrop.toLowerCase()))
  }, [cropScope, data])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-10 w-80 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />)}</div>
          <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black text-slate-900"><Sprout className="h-8 w-8 text-[#3a7d44]" /> Farm Intelligence</h1>
            <p className="mt-1 max-w-3xl text-slate-600">Current field risk uses active detections only. Records, completed applications, and costs retain their historical context so the numbers do not contradict the farm map.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="bg-white" onClick={() => setShowMethod((current) => !current)}>{showMethod ? "Hide score notes" : "How scores work"}</Button>
            <Button className="bg-[#3a7d44] hover:bg-[#2e6336]" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
          </div>
        </div>

        {error && (
          <Card className="border-amber-200 bg-amber-50"><CardContent className="flex items-center justify-between gap-4 p-4"><p className="text-sm font-semibold text-amber-950">{error}</p><Button size="sm" onClick={load}>Retry</Button></CardContent></Card>
        )}

        {showMethod && (
          <Card className="border-slate-200 bg-slate-900 text-white">
            <CardContent className="grid gap-4 p-5 md:grid-cols-3">
              <div><p className="font-black text-emerald-300">Current field risk</p><p className="mt-1 text-sm text-slate-200">Combines active, non-healthy detections by severity, model confidence, and scan freshness. One high-severity fresh detection meaningfully lowers the field-health score.</p></div>
              <div><p className="font-black text-emerald-300">Application records</p><p className="mt-1 text-sm text-slate-200">Only a controller-closed, farmer-confirmed chemical application is counted as completed. A queued command and a water-only pump test are shown separately.</p></div>
              <div><p className="font-black text-emerald-300">Financial and water data</p><p className="mt-1 text-sm text-slate-200">The app never invents litres, yield value, or cost. Those appear only after calibration or a farmer-entered product price.</p></div>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* ── Field Intelligence: real-data visualization hero ─────────── */}
            <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 elevated">
              <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-200/50 to-transparent blur-2xl" />
              <div className="relative">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600/80">Field Intelligence</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">Everything the field is telling us — right now</h2>

                <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                  {/* Field-health donut */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Field health</p>
                    <div className="relative mt-1">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={severityData.length ? severityData : [{ name: "Healthy", value: 1, color: "#10b981" }]}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={62}
                            outerRadius={88}
                            paddingAngle={severityData.length > 1 ? 3 : 0}
                            startAngle={90}
                            endAngle={-270}
                            stroke="none"
                          >
                            {(severityData.length ? severityData : [{ name: "Healthy", value: 1, color: "#10b981" }]).map((slice, index) => (
                              <Cell key={index} fill={slice.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any, name: any) => [`${value} active`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-4xl font-black ${data.currentRiskPercent >= 50 ? "text-red-600" : "text-emerald-600"}`}>{fieldHealth.toFixed(0)}%</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">healthy</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> {data.severityBreakdown.high} high</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> {data.severityBreakdown.moderate} moderate</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {data.severityBreakdown.low} low</span>
                    </div>
                  </div>

                  {/* Active risk by zone */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Active risk by zone (A1–B6)</p>
                    <div className="mt-1">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={zoneRiskData} margin={{ top: 12, right: 6, left: -22, bottom: 0 }}>
                          <XAxis dataKey="zone" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} />
                          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                          <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} formatter={(value: any) => [`${value}%`, "active risk"]} />
                          <Bar dataKey="risk" radius={[6, 6, 0, 0]}>
                            {zoneRiskData.map((zone, index) => (
                              <Cell key={index} fill={zone.risk >= 55 ? "#dc2626" : zone.risk >= 25 ? "#f59e0b" : "#34d399"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Water intelligence — real ledger + targeted-vs-broadcast */}
                {water?.calibrated && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MiniStat tone="emerald" label="Water saved · now" value={`≈${water.targetedVsBroadcast.savedLitres} L`} sub={`${water.targetedVsBroadcast.savedPercent}% vs. broadcasting the block`} />
                    <MiniStat tone="sky" label="Targeted plan" value={`≈${water.targetedVsBroadcast.targetedLitres} L`} sub="sensor-driven, per zone" />
                    <MiniStat tone="slate" label="Season delivered" value={`≈${Math.round(water.season.totalLitres)} L`} sub={`${water.season.commandCount} pump command${water.season.commandCount === 1 ? "" : "s"} logged`} />
                  </div>
                )}
                <p className="mt-4 text-[11px] text-slate-400">Live from real detections, soil sensors, and the water ledger. Volumes are estimated (conservative) from the base-pump flow, not metered.</p>
              </div>
            </section>

            {/* ── Farm Impact: the confident, defensible numbers ───────────── */}
            {impact && (
              <section className="grid gap-4 lg:grid-cols-3">
                {/* Projected yield protected — the star */}
                <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 elevated">
                  <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-gradient-to-br from-emerald-300/40 to-transparent blur-2xl" />
                  <div className="relative">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600/80">Projected yield protected</p>
                    {impact.yield.headline ? (
                      impact.yield.headline.curable ? (
                        <>
                          <p className="mt-2 text-5xl font-black text-emerald-700">~{impact.yield.headline.projectedProtectedPct}%</p>
                          <p className="mt-1 text-sm text-slate-700">
                            of the crop that <span className="font-bold capitalize">{impact.yield.headline.disease}</span> on {impact.yield.headline.crop} would otherwise cost — kept by treating {impact.yield.headline.zoneId} in time.
                          </p>
                          <YieldBar protectedPct={impact.yield.headline.projectedProtectedPct} lossPct={impact.yield.headline.projectedLossPct} />
                          <p className="mt-3 text-[11px] text-slate-400">Published range {impact.yield.headline.lossLowPct}–{impact.yield.headline.lossHighPct}% at risk. {impact.yield.basis}</p>
                        </>
                      ) : (
                        <>
                          <p className="mt-2 text-3xl font-black text-amber-700">No curative recovery</p>
                          <p className="mt-1 text-sm text-slate-700"><span className="font-bold capitalize">{impact.yield.headline.disease}</span> is non-curable. {impact.yield.headline.note}</p>
                          <p className="mt-2 text-sm text-slate-600">Projected loss up to ~{impact.yield.headline.projectedLossPct}% if unmanaged.</p>
                          <p className="mt-3 text-[11px] text-slate-400">{impact.yield.basis}</p>
                        </>
                      )
                    ) : (
                      <>
                        <p className="mt-2 text-3xl font-black text-emerald-700">No active threat</p>
                        <p className="mt-1 text-sm text-slate-600">No active disease is projecting yield loss right now.</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Disease pressure gauge */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 elevated">
                  <PressureGauge score={impact.diseasePressure.score} band={impact.diseasePressure.band} drivers={impact.diseasePressure.drivers} />
                  <p className="mt-2 text-center text-[11px] text-slate-400">{impact.diseasePressure.label}</p>
                </div>

                {/* Infections avoided + coverage */}
                <div className="grid gap-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 elevated">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Infections avoided</p>
                    <p className="mt-1 text-3xl font-black text-emerald-700">~{impact.infectionsAvoided.value}</p>
                    <p className="mt-0.5 text-xs text-slate-500">zones, by protecting bottlenecks ({impact.infectionsAvoided.baseline} → {impact.infectionsAvoided.protectedOutcome} at day 5). Model projection.</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 elevated">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Monitored coverage</p>
                    <p className="mt-1 text-3xl font-black text-slate-900">{impact.coverage.acres} ac · {impact.coverage.zoneCount} zones</p>
                    <p className="mt-0.5 text-xs text-slate-500">Real farm geometry across A1–B6.</p>
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <Card className={data.currentRiskPercent >= 50 ? "border-red-200" : "border-emerald-200"}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Current field health</CardTitle></CardHeader>
                <CardContent><p className={`text-3xl font-black ${data.currentRiskPercent >= 50 ? "text-red-700" : "text-[#3a7d44]"}`}>{fieldHealth.toFixed(1)}%</p><Progress className="mt-3" value={fieldHealth} /><p className="mt-2 text-xs text-slate-600">Inverse of the same active-risk score shown on the farm map.</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Active disease risk</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-black text-red-700">{data.currentRiskPercent.toFixed(1)}%</p><p className="mt-2 text-xs text-slate-600">{data.activeDetections} active detection{data.activeDetections === 1 ? "" : "s"} across {data.activeZoneCount}/{data.farmZoneCount} zones.</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Completed applications</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-black text-slate-900">{data.totalSprays}</p><p className="mt-2 text-xs text-slate-600">{data.queuedApplications} awaiting controller feedback. Water-pump tests are tracked separately.</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Input cost tracked</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-black text-slate-900">{data.financial.totalInputCostInr != null ? `₹${data.financial.totalInputCostInr.toLocaleString("en-IN")}` : "Start logging"}</p><p className="mt-2 text-xs text-slate-600">{data.financial.message}</p></CardContent>
              </Card>
            </div>

            {data.severityBreakdown.high > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-red-700" /><div><p className="font-black text-red-950">High-severity local action is required</p><p className="mt-1 text-sm text-red-900">{data.severityBreakdown.high} active high-severity detection{data.severityBreakdown.high === 1 ? " is" : "s are"} preventing a “stable” farm headline.</p></div></div><Button className="bg-red-700 hover:bg-red-800" onClick={() => window.location.assign("/dashboard/recommendations")}>Open field plan</Button></CardContent>
              </Card>
            )}

            <Tabs defaultValue="health" className="space-y-5">
              <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-5">
                <TabsTrigger value="health">Field Health</TabsTrigger>
                <TabsTrigger value="zones">Zones</TabsTrigger>
                <TabsTrigger value="applications">Applications</TabsTrigger>
                <TabsTrigger value="diseases">Diseases</TabsTrigger>
                <TabsTrigger value="readiness">Readiness</TabsTrigger>
              </TabsList>

              <TabsContent value="health" className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <Card><CardHeader><CardTitle>Current field status</CardTitle><CardDescription>Risk is operational, not an average that hides a severe local outbreak.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-900">Severity mix</p><div className="mt-3 grid grid-cols-3 gap-3 text-center"><div className="rounded-lg bg-red-50 p-3"><p className="text-2xl font-black text-red-700">{data.severityBreakdown.high}</p><p className="text-xs text-red-800">High</p></div><div className="rounded-lg bg-amber-50 p-3"><p className="text-2xl font-black text-amber-700">{data.severityBreakdown.moderate}</p><p className="text-xs text-amber-800">Moderate</p></div><div className="rounded-lg bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-700">{data.severityBreakdown.low}</p><p className="text-xs text-emerald-800">Low</p></div></div></div><p className="text-sm text-slate-600">A treated detection remains a follow-up record, but no longer inflates the active risk score. Use the farm map and Recommendations to choose the next action.</p></CardContent></Card>
                <Card><CardHeader><CardTitle>Operational data coverage</CardTitle><CardDescription>What the system can state from logged evidence today.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Crop context</p><p className="mt-1 font-black text-slate-900">{data.cropContext.farmCrop}</p><p className="mt-1 text-xs text-slate-600">{data.cropContext.message}</p></div><div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Controller loop</p><p className="mt-1 font-black text-slate-900">{data.queuedApplications} command{data.queuedApplications === 1 ? "" : "s"} awaiting feedback</p><p className="mt-1 text-xs text-slate-600">Completed only after the controller reports the pump closed.</p></div></CardContent></Card>
              </TabsContent>

              <TabsContent value="zones" className="space-y-5">
                <Card><CardHeader><CardTitle>12-zone field overview</CardTitle><CardDescription>A1–B6 only. Soil moisture is shown by zone; the fixed DHT11 climate station is farm-wide.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{data.zoneAnalytics.map((zone) => <div key={zone.zoneId} className={`min-h-28 rounded-xl border p-3 ${statusStyle(zone.status)}`}><p className="font-black">{zone.zoneId}</p><p className="mt-1 text-xs font-semibold uppercase">{zone.status}</p><p className="mt-2 text-sm font-black">{zone.soilMoisture}% soil</p><p className="mt-1 text-[10px]">{zone.activeDetections ? `${zone.activeDetections} active detection${zone.activeDetections === 1 ? "" : "s"}` : "No active diagnosis"}</p></div>)}</div></CardContent></Card>
                <Card><CardHeader><CardTitle>Zone records</CardTitle><CardDescription>Completed applications are controller-confirmed; queued commands remain separate.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Zone</th><th className="p-3">Active risk</th><th className="p-3">Latest diagnosis</th><th className="p-3">Completed</th><th className="p-3">Queued</th></tr></thead><tbody>{data.zoneAnalytics.map((zone) => <tr key={zone.zoneId} className="border-b last:border-0"><td className="p-3 font-black">{zone.zoneId}</td><td className="p-3">{zone.currentRiskPercent.toFixed(1)}%</td><td className="p-3">{zone.latestDisease || "No disease record"}</td><td className="p-3">{zone.completedApplications}</td><td className="p-3">{zone.queuedApplications}</td></tr>)}</tbody></table></CardContent></Card>
              </TabsContent>

              <TabsContent value="applications" className="grid gap-5 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><Droplets className="h-5 w-5 text-sky-600" /> Pump and water record</CardTitle><CardDescription>Separates a physical water-pump proof from a confirmed chemical application.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-xl bg-sky-50 p-4"><p className="text-3xl font-black text-sky-900">{data.waterModel.waterValidationTests}</p><p className="text-sm font-semibold text-sky-950">Water-only pump test{data.waterModel.waterValidationTests === 1 ? "" : "s"}</p></div><p className="text-sm text-slate-600">{data.waterModel.message}</p><p className="text-xs font-semibold text-slate-500">No litre-based efficiency claim is shown until you measure mL delivered by one three-second pulse.</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><BadgeIndianRupee className="h-5 w-5 text-[#3a7d44]" /> Input-cost ledger</CardTitle><CardDescription>Costs come from farmer-entered product prices, never a guessed chemical rate.</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-3xl font-black text-slate-900">{data.financial.totalInputCostInr != null ? `₹${data.financial.totalInputCostInr.toLocaleString("en-IN")}` : "Start logging"}</p><p className="text-sm text-slate-600">{data.financial.message}</p><p className="text-xs text-slate-500">Coverage: {data.financial.applicationsWithCost}/{data.financial.completedApplications} completed application{data.financial.completedApplications === 1 ? "" : "s"} with a cost entry.</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><Leaf className="h-5 w-5 text-[#3a7d44]" /> Pre-harvest interval</CardTitle><CardDescription>Shown only from a PHI logged with a completed, farmer-confirmed application.</CardDescription></CardHeader><CardContent className="space-y-3"><p className="text-3xl font-black text-slate-900">{data.preHarvest.activeHolds ? `${data.preHarvest.activeHolds} hold${data.preHarvest.activeHolds === 1 ? "" : "s"}` : "Clear"}</p><p className="text-sm text-slate-600">{data.preHarvest.message}</p>{data.preHarvest.nextReleaseAt && <p className="text-xs font-semibold text-slate-700">Next release: {new Date(data.preHarvest.nextReleaseAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}</CardContent></Card>
              </TabsContent>

              <TabsContent value="diseases" className="space-y-5">
                <Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Disease records by crop</CardTitle><CardDescription>Use the farm-crop view to avoid mixing unrelated PlantVillage examples into one farm conclusion.</CardDescription></div><div className="flex gap-2"><Button size="sm" variant={cropScope === "farm" ? "default" : "outline"} onClick={() => setCropScope("farm")}>Farm crop: {data.cropContext.farmCrop}</Button><Button size="sm" variant={cropScope === "all" ? "default" : "outline"} onClick={() => setCropScope("all")}>All records</Button></div></CardHeader><CardContent className="space-y-3">{visibleDiseaseGroups.length ? visibleDiseaseGroups.map((group) => <div key={group.name} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-black text-slate-900">{group.name.replace(/___/g, " · ").replace(/_/g, " ")}</p><p className="mt-1 text-xs text-slate-600">Crop: {group.crops.join(", ")} · {group.records} record{group.records === 1 ? "" : "s"}</p></div><div className="flex items-center gap-2"><Badge variant={severityStyle(group.highestSeverity) as any}>{group.highestSeverity} severity</Badge><Badge variant="outline">{group.active} active</Badge></div></div>) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-600">No disease record matches the selected farm-crop view. Other records remain available under “All records” for audit, not farm-wide conclusions.</div>}</CardContent></Card>
              </TabsContent>

              <TabsContent value="readiness" className="grid gap-5 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-[#3a7d44]" /> Response timing</CardTitle><CardDescription>Measured only when a scan is linked to a controller-confirmed application.</CardDescription></CardHeader><CardContent><p className="text-3xl font-black text-slate-900">{data.responseTiming.averageHours != null ? `${data.responseTiming.averageHours.toFixed(1)}h` : "Collecting first loop"}</p><p className="mt-3 text-sm text-slate-600">{data.responseTiming.message}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#3a7d44]" /> Decision safeguards</CardTitle><CardDescription>Controls that keep the demo useful under judge scrutiny.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 text-[#3a7d44]" /> High-severity detections lower the field-health headline.</div><div className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 text-[#3a7d44]" /> Rain, wind, and VPD gate actual chemical commands.</div><div className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 text-[#3a7d44]" /> Crop mismatches become review records, not automatic spray instructions.</div></CardContent></Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}
