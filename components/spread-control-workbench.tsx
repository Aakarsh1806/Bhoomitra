"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CloudRain, Loader2, RefreshCw, ShieldCheck, Sparkles, Wind } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import type { SpreadPlan } from "@/app/lib/spreadEngine"

function probabilityTone(probability: number, isSeed: boolean, isProtected: boolean) {
  if (isProtected) return "border-emerald-300 bg-emerald-50 text-emerald-950"
  if (isSeed) return "border-red-400 bg-red-600 text-white"
  if (probability >= 0.6) return "border-red-300 bg-red-50 text-red-950"
  if (probability >= 0.25) return "border-amber-300 bg-amber-50 text-amber-950"
  return "border-slate-200 bg-white text-slate-800"
}

function FieldProjection({
  plan,
  scenario,
  day,
  highlightedZone,
}: {
  plan: SpreadPlan
  scenario: "baseline" | "protected"
  day: number
  highlightedZone: string | null
}) {
  const simulation = plan[scenario]
  const point = simulation.timeline[day] || simulation.timeline[simulation.timeline.length - 1]
  const protectedSet = new Set(simulation.protectedZoneIds)
  const seedSet = new Set(plan.generatedFrom.seedZoneIds)

  return (
    <div className="grid grid-cols-6 gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      {plan.graph.nodes.map((zone) => {
        const probability = point?.zoneProbability[zone.id] || 0
        const isProtected = protectedSet.has(zone.id)
        const isSeed = seedSet.has(zone.id)
        return (
          <div
            key={zone.id}
            className={`relative min-h-20 rounded-xl border p-2 transition ${probabilityTone(probability, isSeed, isProtected)} ${highlightedZone === zone.id ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
          >
            <p className="text-xs font-black">{zone.id}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-75">
              {isSeed ? "Detected" : isProtected ? "Protected" : "Projected risk"}
            </p>
            <p className="mt-1 text-sm font-black">{Math.round(probability * 100)}%</p>
            <p className="text-[10px] opacity-70">soil {Math.round(zone.soilMoisture)}%</p>
          </div>
        )
      })}
    </div>
  )
}

export default function SpreadControlWorkbench() {
  const [plan, setPlan] = useState<SpreadPlan | null>(null)
  const [days, setDays] = useState(5)
  const [budget, setBudget] = useState(2)
  const [day, setDay] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [highlightedZone, setHighlightedZone] = useState<string | null>(null)

  const loadPlan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/spread-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, budget }),
      })
      if (!response.ok) throw new Error("The projection could not be refreshed")
      const nextPlan = (await response.json()) as SpreadPlan
      setPlan(nextPlan)
      setDay((current) => Math.min(current, Math.max(0, nextPlan.baseline.timeline.length - 1)))

      const requestedZone = new URLSearchParams(window.location.search).get("zone")
      if (requestedZone && nextPlan.graph.nodes.some((zone) => zone.id === requestedZone)) {
        setHighlightedZone(requestedZone)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The projection could not be refreshed")
    } finally {
      setLoading(false)
    }
  }, [budget, days])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  const currentBaseline = plan?.baseline.timeline[day]
  const currentProtected = plan?.protected.timeline[day]
  const avoidedFinal = useMemo(() => {
    if (!plan) return 0
    return Math.max(0, plan.baseline.finalExpectedInfected - plan.protected.finalExpectedInfected)
  }, [plan])
  const hasActiveDetections = Boolean(plan?.generatedFrom.activeDetectionCount)

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black text-slate-900">
              <Sparkles className="h-8 w-8 text-[#3a7d44]" />
              Spread Control AI
            </h1>
            <p className="mt-1 max-w-3xl text-slate-600">A weather-aware model projection on the real 12-zone farm graph. It compares likely spread if no protection is prepared against a targeted protection plan.</p>
          </div>
          <Button variant="outline" className="bg-white" onClick={loadPlan} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh projection
          </Button>
        </div>

        {error && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <p className="text-sm font-semibold text-amber-950">{error}</p>
              <Button size="sm" onClick={loadPlan}>Retry</Button>
            </CardContent>
          </Card>
        )}

        {plan && (
          <>
            <Card className="border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50">
              <CardContent className="grid gap-4 p-5 md:grid-cols-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Model input</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{plan.generatedFrom.activeDetectionCount} active detection{plan.generatedFrom.activeDetectionCount === 1 ? "" : "s"}</p>
                  <p className="text-xs text-slate-600">Seeds: {plan.generatedFrom.seedZoneIds.length ? plan.generatedFrom.seedZoneIds.join(", ") : "No active disease seed"}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-sky-800">Weather input</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{plan.generatedFrom.weatherSource === "live" ? "Live regional API" : plan.generatedFrom.weatherSource === "cached" ? "Saved regional forecast" : "Advisory regional forecast"}</p>
                  <p className="text-xs text-slate-600">Field climate: {plan.generatedFrom.fieldClimateSource === "dht11" ? "latest DHT11" : "regional weather reference"}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-800">Urgency</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{plan.urgency.actWithinHours ? `Act within ~${plan.urgency.actWithinHours}h` : "Monitor next forecast"}</p>
                  <p className="text-xs text-slate-600">{plan.urgency.reason}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-violet-800">Projection delta</p>
                  <p className="mt-1 text-lg font-black text-slate-900">~{avoidedFinal.toFixed(1)} fewer infections</p>
                  <p className="text-xs text-slate-600">Model comparison at day {days}, not a measured outcome.</p>
                </div>
              </CardContent>
            </Card>

            {!hasActiveDetections ? (
              <Card className="border-sky-100 bg-white">
                <CardContent className="p-8 text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-[#3a7d44]" />
                  <h2 className="mt-3 text-xl font-black text-slate-900">No active disease detection to project</h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">Spread Control stays ready, but it intentionally does not invent infected zones. Scan a confirmed field leaf to build a projection from a real zone seed.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CloudRain className="h-5 w-5 text-sky-600" /> Counterfactual field view</CardTitle>
                    <CardDescription>Every number below is a probability from the same seeded model. Red tiles include real active detection seeds; green tiles are proposed protection targets.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">Do nothing</h3><Badge variant="destructive">{currentBaseline?.expectedInfected.toFixed(1)} projected infected</Badge></div>
                        <FieldProjection plan={plan} scenario="baseline" day={day} highlightedZone={highlightedZone} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">Protect bottlenecks</h3><Badge className="bg-[#3a7d44]">{currentProtected?.expectedInfected.toFixed(1)} projected infected</Badge></div>
                        <FieldProjection plan={plan} scenario="protected" day={day} highlightedZone={highlightedZone} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Label className="font-bold">Projection day: {day} of {days}</Label>
                        <p className="text-xs text-slate-600">Expected new infections today: {currentBaseline?.expectedNewInfections.toFixed(1) || "0.0"} → {currentProtected?.expectedNewInfections.toFixed(1) || "0.0"}</p>
                      </div>
                      <Slider className="mt-4" value={[day]} min={0} max={days} step={1} onValueChange={([value]) => setDay(value)} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#3a7d44]" /> Highest-leverage protection targets</CardTitle>
                    <CardDescription>Ranked by the marginal reduction in projected infections. “Articulation point” describes the real zone graph, not a disease certainty.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    {plan.bottlenecks.map((target, index) => (
                      <div key={target.zoneId} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Priority {index + 1}</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{target.zoneId}</p>
                        <p className="mt-2 text-sm font-bold text-emerald-900">~{target.projectedInfectionsAvoided.toFixed(1)} projected infections avoided</p>
                        <p className="mt-2 text-xs text-slate-600">{target.rationale}</p>
                        <Button
                          size="sm"
                          className="mt-4 w-full bg-[#3a7d44] hover:bg-[#2e6336]"
                          onClick={() => window.location.assign(`/dashboard/autospray?zone=${encodeURIComponent(target.zoneId)}`)}
                        >
                          Open verified spray plan
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wind className="h-5 w-5 text-slate-700" /> Projection controls and assumptions</CardTitle>
                <CardDescription>Change the horizon or number of targeted zones, then refresh the deterministic comparison.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label>Forecast horizon: {days} days</Label>
                  <Slider value={[days]} min={1} max={10} step={1} onValueChange={([value]) => setDays(value)} />
                </div>
                <div className="space-y-3">
                  <Label>Protection targets: {budget}</Label>
                  <Slider value={[budget]} min={1} max={4} step={1} onValueChange={([value]) => setBudget(value)} />
                </div>
                <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:col-span-2">
                  <summary className="cursor-pointer font-bold text-slate-900">Inspect model assumptions</summary>
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    {plan.generatedFrom.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
                  </ul>
                </details>
              </CardContent>
            </Card>
          </>
        )}

        {loading && !plan && (
          <Card>
            <CardContent className="flex items-center gap-3 p-8 text-slate-700"><Loader2 className="h-5 w-5 animate-spin" /> Building the field projection from the current zones, detections, and forecast…</CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
