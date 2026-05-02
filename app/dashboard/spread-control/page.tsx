"use client"

import React, { useState, useEffect } from "react"
import { useFarmStore } from "@/store/farmStore"
import { useTranslation } from "@/lib/use-translation"
import { toast } from "sonner"
import { RotateCcw, Zap } from "lucide-react"
import SpreadGraphVisualization from "@/components/spread-control/graph-visualization"
import ControlPanel from "@/components/spread-control/control-panel"
import TimelineControls from "@/components/spread-control/timeline-controls"

interface Node {
  id: string
  label: string
  x?: number
  y?: number
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

export default function SpreadControlPage() {
  const t = useTranslation()
  const { detections } = useFarmStore()

  // Simulation parameters
  const [timeSteps, setTimeSteps] = useState(10)
  const [budget, setBudget] = useState(3)
  const [autoMode, setAutoMode] = useState(true)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Simulation data
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [timeline, setTimeline] = useState<SimulationState[]>([])
  const [currentTimeStep, setCurrentTimeStep] = useState(0)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false)

  // Initialize graph from farm data
  useEffect(() => {
    initializeGraph()
  }, [detections])

  // Auto-advance timeline when playing
  useEffect(() => {
    if (!isPlaying || timeline.length === 0) return

    const interval = setInterval(() => {
      setCurrentTimeStep((prev) => {
        if (prev >= timeline.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 800)

    return () => clearInterval(interval)
  }, [isPlaying, timeline])

  const initializeGraph = () => {
    // Create a simple grid of farm plots (demo data)
    // In production, this would come from the Farm Map module
    const cols = 4
    const rows = 4
    const spacing = 120
    const newNodes: Node[] = []

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const id = `plot-${i}-${j}`
        newNodes.push({
          id,
          label: `Plot ${(i * cols + j + 1).toString()}`,
          x: j * spacing,
          y: i * spacing,
          row: i,
          col: j,
        })
      }
    }

    // Create edges between adjacent plots
    const newEdges: Edge[] = []
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const current = `plot-${i}-${j}`
        // Right neighbor
        if (j < cols - 1) {
          newEdges.push({ source: current, target: `plot-${i}-${j + 1}` })
        }
        // Bottom neighbor
        if (i < rows - 1) {
          newEdges.push({ source: current, target: `plot-${i + 1}-${j}` })
        }
      }
    }

    setNodes(newNodes)
    setEdges(newEdges)
    setSelectedNodeId(null)

    // Set initially infected nodes based on detections
    if (detections && detections.length > 0) {
      const initialInfected = detections
        .slice(0, 2)
        .map((_, idx) => `plot-0-${idx}`)
      runSimulation(initialInfected, [])
    }
  }

  const getInitialInfectedNodes = () => {
    if (timeline[0]?.infected?.length) return timeline[0].infected

    if (detections && detections.length > 0) {
      return detections.slice(0, 2).map((_, idx) => `plot-0-${idx}`)
    }

    return nodes.length > 0 ? [nodes[0].id] : []
  }

  const runSimulation = async (
    infectedNodes: string[],
    blockedNodes: string[]
  ) => {
    if (nodes.length === 0) return

    setIsSimulating(true)
    try {
      const response = await fetch("/api/spread-control/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          edges,
          initial_infected: infectedNodes,
          blocked_nodes: blockedNodes,
          time_steps: timeSteps,
        }),
      })

      const data = await response.json()
      setTimeline(data.timeline || [])
      setCurrentTimeStep(0)
      setIsPlaying(false)

      toast.success("Simulation completed")
    } catch (error) {
      console.error("Simulation error:", error)
      toast.error("Simulation failed")
    } finally {
      setIsSimulating(false)
    }
  }

  const runOptimization = async () => {
    if (nodes.length === 0) return

    setIsOptimizing(true)
    try {
      const initialInfected = getInitialInfectedNodes()
      if (initialInfected.length === 0) {
        toast.warning("No infected plots available to optimize")
        return
      }

      const response = await fetch("/api/spread-control/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          edges,
          initial_infected: initialInfected,
          budget,
          time_steps: timeSteps,
        }),
      })

      const data = await response.json()
      // Auto-select recommended nodes
      const recommendedIds = new Set(
        data.recommended_nodes.map((r: any) => r.node_id)
      )
      setSelectedNodes(recommendedIds)

      // Re-run simulation with selected nodes
  const initialInfectedList = initialInfected
      await runSimulation(initialInfectedList, Array.from(recommendedIds))

      toast.success(`Recommended ${data.recommended_nodes.length} plots to protect`)
    } catch (error) {
      console.error("Optimization error:", error)
      toast.error("Optimization failed")
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleToggleNode = (nodeId: string) => {
    const newSelected = new Set(selectedNodes)
    if (newSelected.has(nodeId)) {
      newSelected.delete(nodeId)
    } else {
      if (newSelected.size < budget) {
        newSelected.add(nodeId)
      } else {
        toast.warning(`Budget limited to ${budget} plots`)
        return
      }
    }

    setSelectedNodes(newSelected)

    // Re-run simulation with updated selection
    const initialInfected = getInitialInfectedNodes()
    if (initialInfected.length > 0) {
      runSimulation(initialInfected, Array.from(newSelected))
    }
  }

  const handleReset = () => {
    setSelectedNodes(new Set())
    setSelectedNodeId(null)
    setCurrentTimeStep(0)
    setIsPlaying(false)
    initializeGraph()
  }

  const currentState =
    timeline.length > 0 ? timeline[currentTimeStep] : null

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null
  const selectedNodeState = selectedNode ? (currentState?.infected.includes(selectedNode.id)
    ? "infected"
    : currentState?.at_risk.includes(selectedNode.id)
      ? "at_risk"
      : selectedNodes.has(selectedNode.id)
        ? "protected"
        : "healthy") : null
  const selectedNodeImpact = selectedNode
    ? edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).length
    : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-[#1a2e1d] flex items-center gap-3">
            <Zap className="text-green-600 h-9 w-9" />
            Spread Control AI
          </h1>
          <p className="text-[#4a634f] mt-2 text-lg font-medium max-w-3xl">
            High-clarity spread visualization focused on infected plots, at-risk plots, and the best places to intervene.
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={isSimulating || isOptimizing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-green-200 bg-white text-green-800 hover:bg-green-50 disabled:opacity-50 shadow-sm"
        >
          <RotateCcw size={18} />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.75fr_1fr] gap-8 items-start">
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-green-100 bg-gradient-to-br from-white via-green-50/50 to-white p-4 sm:p-6 shadow-[0_18px_50px_rgba(22,101,52,0.10)]">
            <SpreadGraphVisualization
              nodes={nodes}
              edges={edges}
              currentState={currentState}
              selectedNodes={selectedNodes}
              onToggleNode={!autoMode ? handleToggleNode : undefined}
              onNodeSelect={setSelectedNodeId}
              isLoading={isSimulating}
            />
          </div>

          {timeline.length > 0 && (
            <TimelineControls
              currentTime={currentTimeStep}
              maxTime={timeline.length - 1}
              isPlaying={isPlaying}
              onTimeChange={setCurrentTimeStep}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              timelineData={timeline}
            />
          )}
        </div>

        <div className="space-y-4">
          <ControlPanel
            timeSteps={timeSteps}
            onTimeStepsChange={setTimeSteps}
            budget={budget}
            onBudgetChange={setBudget}
            autoMode={autoMode}
            onAutoModeChange={setAutoMode}
            onOptimize={runOptimization}
            onSimulate={() => {
              const initialInfected = getInitialInfectedNodes()
              if (initialInfected.length > 0) {
                runSimulation(initialInfected, Array.from(selectedNodes))
              }
            }}
            isOptimizing={isOptimizing}
            isSimulating={isSimulating}
          />

          <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#1a2e1d]">Selected plot</h2>
              <span className="text-xs uppercase tracking-[0.18em] text-green-700">Click a circle</span>
            </div>

            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 text-lg font-black text-white ${selectedNodeState === "infected" ? "border-red-200 bg-red-500" : selectedNodeState === "at_risk" ? "border-amber-200 bg-amber-500" : selectedNodeState === "protected" ? "border-green-200 bg-green-600" : "border-green-200 bg-green-500"}`}>
                    {selectedNode.label.replace("Plot ", "")}
                  </div>
                  <div>
                    <div className="text-sm uppercase tracking-[0.18em] text-green-700">{selectedNode.label}</div>
                    <div className="mt-1 text-lg font-bold text-[#17331f]">{selectedNodeState === "infected" ? "Contain now" : selectedNodeState === "at_risk" ? "Protect soon" : selectedNodeState === "protected" ? "Already protected" : "Healthy plot"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-green-50 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-green-700">Impact</div>
                    <div className="mt-1 text-2xl font-black text-[#17331f]">{selectedNodeImpact}</div>
                  </div>
                  <div className="rounded-xl bg-green-50 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-green-700">Neighbors</div>
                    <div className="mt-1 text-2xl font-black text-[#17331f]">{edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).length}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-4 text-sm text-[#34513b]">
                  {selectedNodeState === "infected"
                    ? "This plot is currently infected. Use containment or isolation immediately."
                    : selectedNodeState === "at_risk"
                      ? "This plot is likely to spread next. It is a priority for spraying or protection."
                      : selectedNodeState === "protected"
                        ? "This plot is already protected and is acting as a barrier."
                        : "This plot is healthy right now, but it can still help block spread if protected early."}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-green-200 bg-green-50/60 p-6 text-sm text-[#4a634f]">
                No plot selected yet. Click any circle on the farm grid to see the plot data here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
