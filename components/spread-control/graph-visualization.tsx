"use client"

import React, { useMemo, useState } from "react"
import { RotateCw, ShieldAlert, Siren, Shield, Droplets, Waves, Sprout } from "lucide-react"

interface Node {
  id: string
  label: string
  x?: number
  y?: number
  row?: number
  col?: number
  [key: string]: any
}

interface Edge {
  source: string
  target: string
}

interface SimulationState {
  infected: string[]
  at_risk: string[]
  healthy: string[]
  protected: string[]
}

interface GraphProps {
  nodes: Node[]
  edges: Edge[]
  currentState: SimulationState | null
  selectedNodes: Set<string>
  onToggleNode?: (nodeId: string) => void
  onNodeSelect?: (nodeId: string) => void
  isLoading?: boolean
}

type NodeState = "infected" | "at_risk" | "protected" | "healthy"

function stateLabel(state: NodeState) {
  switch (state) {
    case "infected":
      return "Infected"
    case "at_risk":
      return "At Risk"
    case "protected":
      return "Protected"
    default:
      return "Healthy"
  }
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "red" | "amber" | "sky" | "emerald" }) {
  const theme = {
    red: "border-red-400/20 bg-red-500/15 text-red-100",
    amber: "border-amber-400/20 bg-amber-500/15 text-amber-100",
    sky: "border-sky-400/20 bg-sky-500/15 text-sky-100",
    emerald: "border-emerald-400/20 bg-emerald-500/15 text-emerald-100",
  }

  return <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] ${theme[tone]}`}>{children}</span>
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "emerald" | "sky" }) {
  const theme = {
    red: "from-red-500/20 to-rose-500/10 border-red-400/20 text-red-100",
    amber: "from-amber-500/20 to-orange-500/10 border-amber-400/20 text-amber-100",
    emerald: "from-emerald-500/20 to-green-500/10 border-emerald-400/20 text-emerald-100",
    sky: "from-sky-500/20 to-blue-500/10 border-sky-400/20 text-sky-100",
  }

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${theme[tone]}`}>
      <div className="text-[0.68rem] uppercase tracking-[0.18em] text-white/70">{label}</div>
      <div className="mt-1 text-3xl font-black text-white">{value}</div>
    </div>
  )
}

export default function SpreadGraphVisualization({
  nodes,
  edges,
  currentState,
  selectedNodes,
  onToggleNode,
  onNodeSelect,
  isLoading,
}: GraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const getNodeState = (nodeId: string): NodeState => {
    if (selectedNodes.has(nodeId)) return "protected"
    if (currentState?.infected?.includes(nodeId)) return "infected"
    if (currentState?.at_risk?.includes(nodeId)) return "at_risk"
    if (currentState?.protected?.includes(nodeId)) return "protected"
    return "healthy"
  }

  const bottlenecks = useMemo(() => {
    const scoreFor = (nodeId: string) => {
      const adjacent = edges.filter((edge) => edge.source === nodeId || edge.target === nodeId)
      const infectedNeighbors = adjacent.filter((edge) => {
        const other = edge.source === nodeId ? edge.target : edge.source
        return currentState?.infected.includes(other)
      }).length
      const atRiskNeighbors = adjacent.filter((edge) => {
        const other = edge.source === nodeId ? edge.target : edge.source
        return currentState?.at_risk.includes(other)
      }).length
      return adjacent.length * 2 + infectedNeighbors * 5 + atRiskNeighbors * 3
    }

    return nodes
      .map((node) => ({ id: node.id, score: scoreFor(node.id), state: getNodeState(node.id) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [nodes, edges, currentState, selectedNodes])

  const metrics = useMemo(() => ({
    infected: currentState?.infected.length || 0,
    atRisk: currentState?.at_risk.length || 0,
    healthy: currentState?.healthy.length || 0,
    protectedCount: currentState?.protected.length || 0,
  }), [currentState])

  const statusTheme: Record<NodeState, { ring: string; fill: string; text: string; icon: React.ReactNode }> = {
    healthy: {
      ring: "ring-emerald-300/50",
      fill: "from-emerald-400 via-emerald-500 to-emerald-600",
      text: "text-emerald-50",
      icon: <Droplets className="h-4 w-4" />,
    },
    infected: {
      ring: "ring-red-300/70",
      fill: "from-red-500 via-red-600 to-rose-700",
      text: "text-red-50",
      icon: <Siren className="h-4 w-4" />,
    },
    at_risk: {
      ring: "ring-amber-300/70",
      fill: "from-amber-400 via-amber-500 to-orange-600",
      text: "text-amber-50",
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    protected: {
      ring: "ring-sky-300/70",
      fill: "from-sky-400 via-blue-500 to-blue-700",
      text: "text-sky-50",
      icon: <Shield className="h-4 w-4" />,
    },
  }

  const stateIcons: Record<NodeState, React.ReactNode> = {
    healthy: <Droplets className="h-4 w-4" />,
    infected: <Siren className="h-4 w-4" />,
    at_risk: <ShieldAlert className="h-4 w-4" />,
    protected: <Shield className="h-4 w-4" />,
  }

  const plotRows = useMemo(() => {
    const rows = new Map<number, Node[]>()
    nodes.forEach((node) => {
      const row = typeof node.row === "number" ? node.row : Math.floor(nodes.indexOf(node) / 4)
      const list = rows.get(row) || []
      list.push(node)
      rows.set(row, list)
    })
    return Array.from(rows.entries()).sort((a, b) => a[0] - b[0])
  }, [nodes])

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[2rem] border border-green-100 bg-gradient-to-br from-[#f8fdf9] via-white to-[#eef8f1] shadow-[0_24px_80px_rgba(22,101,52,0.12)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.10),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,252,248,0.98))]" />
        <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl animate-pulse" />
        <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-lime-500/10 blur-3xl animate-pulse" style={{ animationDelay: "1.2s" }} />

        <div className="relative z-10 p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold tracking-wide text-green-800">
                <Waves className="h-3.5 w-3.5" />
                Disease Spread Radar
              </div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-black text-[#17331f]">
                Plot-by-plot spread map
              </h2>
              <p className="mt-1 text-sm text-[#56715c] max-w-2xl">
                Infection, at-risk zones, and bottlenecks are highlighted directly on the farm grid so you can act without hunting through charts.
              </p>
            </div>

            <div className="rounded-2xl border border-green-100 bg-white px-4 py-3 text-right shadow-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-green-700">Simulation</div>
              <div className="text-2xl font-black text-[#17331f]">Live</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Infected" value={metrics.infected} tone="red" />
            <MetricCard label="At Risk" value={metrics.atRisk} tone="amber" />
            <MetricCard label="Healthy" value={metrics.healthy} tone="emerald" />
            <MetricCard label="Protected" value={metrics.protectedCount} tone="sky" />
          </div>

          <div className="rounded-[1.75rem] border border-green-100 bg-[#f9fdf9] p-4 shadow-inner">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#56715c]">
                <Sprout className="h-4 w-4 text-green-600" />
                Top-down farm plot grid
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-green-700/70">Tap a plot to inspect it</div>
            </div>

            <div className="grid gap-4" style={{ gridTemplateRows: `repeat(${plotRows.length}, minmax(0, 1fr))` }}>
              {plotRows.map(([rowIndex, rowNodes]) => (
                <div key={rowIndex} className="grid grid-cols-4 gap-4">
                  {rowNodes.map((node) => {
                    const state = getNodeState(node.id)
                    const selected = selectedNodes.has(node.id)
                    const score = bottlenecks.find((entry) => entry.id === node.id)?.score || 0

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => {
                          onNodeSelect?.(node.id)
                          onToggleNode?.(node.id)
                        }}
                        className={`group flex flex-col items-center gap-2 transition-transform duration-300 hover:-translate-y-0.5 ${selected ? "scale-[1.03]" : "scale-100"}`}
                      >
                        <div
                          className={`relative flex h-18 w-18 items-center justify-center rounded-full border-4 shadow-lg sm:h-20 sm:w-20 ${
                            state === "infected"
                              ? "border-red-200 bg-red-500 text-white"
                              : state === "at_risk"
                                ? "border-amber-200 bg-amber-500 text-white"
                                : state === "protected"
                                  ? "border-green-200 bg-green-600 text-white"
                                  : "border-green-200 bg-green-500 text-white"
                          } ${selected ? "ring-4 ring-green-300 ring-offset-2 ring-offset-[#f9fdf9]" : ""}`}
                        >
                          <div className="text-lg font-black">{node.label.replace("Plot ", "")}</div>
                          {state === "infected" && <div className="absolute inset-0 animate-pulse rounded-full bg-red-500/20" />}
                        </div>

                        <div className="text-center">
                          <div className="text-[0.7rem] uppercase tracking-[0.18em] text-[#56715c]">
                            {stateLabel(state)}
                          </div>
                          <div className="mt-0.5 text-sm font-bold text-[#17331f]">Plot {node.label.replace("Plot ", "")}</div>
                        </div>

                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-green-100">
                          <div
                            className={`h-full rounded-full ${state === "infected" ? "bg-red-500" : state === "at_risk" ? "bg-amber-500" : state === "protected" ? "bg-green-600" : "bg-green-400"}`}
                            style={{ width: `${Math.max(12, Math.min((score / 30) * 100, 100))}%` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/55 backdrop-blur-sm">
              <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-white px-5 py-4 text-[#17331f] shadow-2xl">
                <RotateCw className="h-5 w-5 animate-spin text-green-600" />
                <div>
                  <div className="text-sm font-bold">Simulating spread</div>
                  <div className="text-xs text-[#56715c]">Updating disease wave and intervention impact</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
