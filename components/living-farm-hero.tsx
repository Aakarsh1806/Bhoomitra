"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Play, Pause, RotateCcw, ShieldCheck, Flame, Activity, AlertTriangle, Loader2 } from "lucide-react"

/* ─────────────────────────────────────────────────────────────────────────
   Living Farm — the demo centerpiece.
   A cinematic, time-aware digital twin that plays the REAL weather-aware
   spread model forward over N days: do-nothing (the field catches fire) vs.
   protect-bottlenecks (contained). Every value is model output, labelled a
   projection — never a measurement.
   ──────────────────────────────────────────────────────────────────────── */

type TimelinePoint = {
  day: number
  expectedInfected: number
  expectedNewInfections: number
  zoneProbability: Record<string, number>
}
type Simulation = {
  protectedZoneIds: string[]
  timeline: TimelinePoint[]
  finalExpectedInfected: number
  finalExpectedNewInfections: number
}
type SpreadPlan = {
  modelLabel: string
  generatedFrom: { activeDetectionCount: number; seedZoneIds: string[]; assumptions: string[] }
  graph: {
    nodes: { id: string; row: number; col: number; soilMoisture: number }[]
    edges: { source: string; target: string }[]
  }
  urgency: { headline: string; actWithinHours: number | null; reason: string }
  baseline: Simulation
  protected: Simulation
  bottlenecks: { zoneId: string; projectedInfectionsAvoided: number; rationale: string }[]
}

type Scenario = "baseline" | "protected"

// Heat ramp: calm teal → amber → hot red as infection probability climbs.
function heat(p: number): string {
  const t = Math.max(0, Math.min(1, p))
  const stops =
    t < 0.5
      ? lerp([16, 185, 129], [245, 158, 11], t / 0.5) // green → amber
      : lerp([245, 158, 11], [239, 68, 68], (t - 0.5) / 0.5) // amber → red
  return `rgb(${stops[0]}, ${stops[1]}, ${stops[2]})`
}
function lerp(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

export default function LivingFarmHero() {
  const [plan, setPlan] = useState<SpreadPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [scenario, setScenario] = useState<Scenario>("baseline")
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = useState(false)
  const rafDays = useRef(0)

  useEffect(() => {
    let alive = true
    fetch("/api/spread-control?days=5&budget=2")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) setPlan(data)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const sim = plan ? plan[scenario] : null
  const maxDay = sim ? sim.timeline.length - 1 : 5
  const point = sim?.timeline[Math.min(day, maxDay)] ?? null

  // Auto-advance the timeline while playing, then rest on the final day.
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setDay((d) => {
        if (d >= maxDay) {
          setPlaying(false)
          return d
        }
        return d + 1
      })
    }, 950)
    return () => window.clearInterval(id)
  }, [playing, maxDay])

  const play = useCallback(() => {
    if (day >= maxDay) setDay(0)
    setPlaying(true)
  }, [day, maxDay])

  const reset = useCallback(() => {
    setPlaying(false)
    setDay(0)
  }, [])

  // Node layout (2 rows × 6 cols) as percentages of the stage.
  const cols = 6
  const rows = 2
  const pad = 9
  const pos = useCallback(
    (col: number, row: number) => ({
      x: pad + (col / (cols - 1)) * (100 - 2 * pad),
      y: 24 + (row / (rows - 1)) * 52,
    }),
    [],
  )

  const infectionsAvoided = plan ? Math.max(0, plan.baseline.finalExpectedInfected - plan.protected.finalExpectedInfected) : 0
  const seedSet = useMemo(() => new Set(plan?.generatedFrom.seedZoneIds ?? []), [plan])
  const protectedSet = useMemo(() => new Set(plan?.protected.protectedZoneIds ?? []), [plan])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05100c] text-emerald-200">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-3 text-sm tracking-wide">Running the spread projection…</span>
      </div>
    )
  }

  if (!plan || !sim || !point) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05100c] text-emerald-200/70">
        <AlertTriangle className="mr-2 h-5 w-5" /> No active projection yet — scan a leaf to seed the model.
      </div>
    )
  }

  return (
    <div className="surface-command min-h-screen p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-emerald-400/80">
              <Activity className="h-3.5 w-3.5" /> Living Farm · Command Center
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{plan.urgency.headline}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{plan.urgency.reason}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Model projection</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-200">
              {plan.generatedFrom.activeDetectionCount} active detection{plan.generatedFrom.activeDetectionCount === 1 ? "" : "s"} · seeds {plan.generatedFrom.seedZoneIds.join(", ") || "—"}
            </p>
            {plan.urgency.actWithinHours != null && (
              <p className="mt-0.5 text-xs text-amber-300">Act within ~{plan.urgency.actWithinHours}h</p>
            )}
          </div>
        </div>

        {/* Scenario toggle */}
        <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1 backdrop-blur">
          <button
            onClick={() => setScenario("baseline")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${scenario === "baseline" ? "bg-red-500/20 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.25)]" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Flame className="h-4 w-4" /> Do nothing
          </button>
          <button
            onClick={() => setScenario("protected")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${scenario === "protected" ? "bg-emerald-500/20 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]" : "text-slate-400 hover:text-slate-200"}`}
          >
            <ShieldCheck className="h-4 w-4" /> Protect bottlenecks
          </button>
        </div>

        {/* Stage */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur">
          <div className="relative aspect-[2/1] w-full">
            {/* edges */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {plan.graph.edges.map((e, i) => {
                const s = plan.graph.nodes.find((n) => n.id === e.source)
                const t = plan.graph.nodes.find((n) => n.id === e.target)
                if (!s || !t) return null
                const a = pos(s.col, s.row)
                const b = pos(t.col, t.row)
                const pa = point.zoneProbability[e.source] ?? 0
                const pb = point.zoneProbability[e.target] ?? 0
                const hot = Math.max(pa, pb)
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={heat(hot)}
                    strokeWidth={0.4}
                    strokeOpacity={0.15 + hot * 0.55}
                    style={{ transition: "stroke 0.6s, stroke-opacity 0.6s" }}
                  />
                )
              })}
            </svg>

            {/* nodes */}
            {plan.graph.nodes.map((n) => {
              const p = point.zoneProbability[n.id] ?? 0
              const c = pos(n.col, n.row)
              const isSeed = seedSet.has(n.id)
              const isProtected = scenario === "protected" && protectedSet.has(n.id)
              const color = isProtected ? "rgb(16,185,129)" : heat(p)
              return (
                <div
                  key={n.id}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl border text-center"
                  style={{
                    left: `${c.x}%`,
                    top: `${c.y}%`,
                    width: "12%",
                    height: "30%",
                    background: `radial-gradient(circle at 50% 35%, ${color}44, ${color}14)`,
                    borderColor: `${color}${isProtected || p > 0.4 ? "cc" : "55"}`,
                    boxShadow: isProtected
                      ? "0 0 26px rgba(16,185,129,0.55), inset 0 0 18px rgba(16,185,129,0.25)"
                      : `0 0 ${8 + p * 40}px ${color}${Math.round((0.2 + p * 0.6) * 255).toString(16).padStart(2, "0")}`,
                    transition: "background 0.6s, border-color 0.6s, box-shadow 0.6s",
                  }}
                >
                  <span className="text-sm font-black text-white md:text-lg">{n.id}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/70 md:text-[10px]">
                    {isProtected ? "protected" : isSeed ? "source" : `${Math.round(p * 100)}%`}
                  </span>
                  {isProtected && <ShieldCheck className="mt-0.5 h-3 w-3 text-emerald-200" />}
                </div>
              )
            })}

            {/* day badge */}
            <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-bold tracking-wide text-slate-200 backdrop-blur">
              Day {point.day} of {maxDay}
            </div>
          </div>

          {/* Transport bar */}
          <div className="flex items-center gap-4 border-t border-white/10 bg-black/40 px-5 py-4">
            <button
              onClick={playing ? () => setPlaying(false) : play}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-black transition hover:bg-emerald-400"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
            </button>
            <button onClick={reset} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:text-white">
              <RotateCcw className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={0}
              max={maxDay}
              value={day}
              onChange={(e) => {
                setPlaying(false)
                setDay(Number(e.target.value))
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-emerald-400"
            />
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            tone={scenario === "baseline" ? "red" : "emerald"}
            label={`Infected · day ${point.day}`}
            value={point.expectedInfected.toFixed(1)}
            sub="expected infected zones (projection)"
          />
          <Stat
            tone={scenario === "baseline" ? "red" : "emerald"}
            label="Projected · day 5"
            value={sim.finalExpectedInfected.toFixed(1)}
            sub={scenario === "baseline" ? "if nothing is done" : "with bottlenecks protected"}
          />
          <Stat
            tone="emerald"
            label="Infections avoided"
            value={`~${infectionsAvoided.toFixed(1)}`}
            sub="do-nothing vs. protect, at day 5"
          />
        </div>

        <p className="text-center text-[11px] text-slate-500">
          {plan.modelLabel} · reproducible, weather-aware simulation on the real A1–B6 graph. Numbers are model projections, not measured outcomes.
        </p>
      </div>
    </div>
  )
}

function Stat({ tone, label, value, sub }: { tone: "red" | "emerald"; label: string; value: string; sub: string }) {
  const ring = tone === "red" ? "rgba(239,68,68,0.35)" : "rgba(16,185,129,0.35)"
  const text = tone === "red" ? "text-red-300" : "text-emerald-300"
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur"
      style={{ boxShadow: `0 0 30px -12px ${ring}` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-4xl font-black tabular-nums ${text}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  )
}
