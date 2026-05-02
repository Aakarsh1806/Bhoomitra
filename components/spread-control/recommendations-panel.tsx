"use client"

import React from "react"
import { Check, AlertCircle, Shield, Siren, SprayCan, Lock, ArrowRight } from "lucide-react"

interface Recommendation {
  node_id: string
  impact: number
  infections_prevented: number
  description: string
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[]
  selectedNodes: Set<string>
  onToggleNode?: (nodeId: string) => void
}

export default function RecommendationsPanel({
  recommendations,
  selectedNodes,
  onToggleNode,
}: RecommendationsPanelProps) {
  if (!recommendations || recommendations.length === 0) {
    return null
  }

  const getActionLabel = (rec: Recommendation) => {
    if (rec.description.toLowerCase().includes("isolate")) return "Isolate"
    if (rec.description.toLowerCase().includes("spray")) return "Spray"
    return rec.infections_prevented > 4 ? "Spray" : "Protect"
  }

  const getActionIcon = (action: string) => {
    if (action === "Isolate") return <Lock className="h-4 w-4" />
    if (action === "Spray") return <SprayCan className="h-4 w-4" />
    return <Shield className="h-4 w-4" />
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-100 shadow-lg shadow-red-500/10">
          <Siren className="h-6 w-6" />
        </div>
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-red-200/80">Action required</div>
          <h2 className="text-xl font-black text-white">Where to act first</h2>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
        The highest-ranked plots below are your bottlenecks. Acting on them early prevents the spread from jumping to nearby plots.
      </div>

      <div className="mt-4 space-y-3 max-h-[28rem] overflow-y-auto pr-1">
        {recommendations.map((rec, idx) => (
          <div
            key={rec.node_id}
            className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 ${selectedNodes.has(rec.node_id) ? "border-sky-400/50 bg-sky-500/10 shadow-lg shadow-sky-500/10" : "border-white/10 bg-white/5 hover:border-amber-300/40 hover:bg-white/10"}`}
            onClick={() => onToggleNode?.(rec.node_id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">#{idx + 1}</span>
                  <span className="text-base font-bold text-white">{rec.node_id.replace("plot-", "Plot ")}</span>
                  {selectedNodes.has(rec.node_id) && <Check className="h-4 w-4 text-sky-300" />}
                </div>

                <p className="mt-2 text-sm text-slate-300">{rec.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-100">
                    {getActionIcon(getActionLabel(rec))}
                    {getActionLabel(rec)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-red-100">
                    <AlertCircle className="h-4 w-4" />
                    Prevents {rec.infections_prevented} infections
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-3xl font-black text-white">{rec.impact}</div>
                <div className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-400">impact score</div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-200">
                  Act now <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
        <p className="font-black uppercase tracking-[0.18em] text-emerald-200">Recommended action flow</p>
        <div className="mt-3 grid gap-2 text-sm text-emerald-50/90">
          <div>1. Protect the top bottlenecks first.</div>
          <div>2. Spray the plots marked at risk.</div>
          <div>3. Isolate any infected plot with a high impact score.</div>
        </div>
      </div>
    </div>
  )
}
