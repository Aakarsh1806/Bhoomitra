"use client"

import React from "react"
import { Zap, Brain, Gamepad2 } from "lucide-react"

interface ControlPanelProps {
  timeSteps: number
  onTimeStepsChange: (value: number) => void
  budget: number
  onBudgetChange: (value: number) => void
  autoMode: boolean
  onAutoModeChange: (value: boolean) => void
  onOptimize: () => void
  onSimulate: () => void
  isOptimizing: boolean
  isSimulating: boolean
}

export default function ControlPanel({
  timeSteps,
  onTimeStepsChange,
  budget,
  onBudgetChange,
  autoMode,
  onAutoModeChange,
  onOptimize,
  onSimulate,
  isOptimizing,
  isSimulating,
}: ControlPanelProps) {
  return (
    <div className="space-y-4 p-6 bg-white rounded-2xl border-2 border-green-200 shadow-lg">
      <h2 className="text-xl font-bold text-[#1a2e1d] flex items-center gap-2">
        <Gamepad2 className="text-green-600" size={24} />
        Controls
      </h2>

      {/* Time Steps Slider */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Simulation Time Steps
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="20"
            value={timeSteps}
            onChange={(e) => onTimeStepsChange(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={isSimulating || isOptimizing}
          />
          <span className="text-lg font-bold text-green-600 min-w-8 text-right">
            {timeSteps}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          How many time periods to simulate disease spread
        </p>
      </div>

      {/* Budget Slider */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Protection Budget
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="12"
            value={budget}
            onChange={(e) => onBudgetChange(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={isSimulating || isOptimizing}
          />
          <span className="text-lg font-bold text-blue-600 min-w-8 text-right">
            {budget}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Maximum number of plots to protect
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        <label className="block text-sm font-semibold text-gray-700">
          Control Mode
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => onAutoModeChange(true)}
            disabled={isSimulating || isOptimizing}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              autoMode
                ? "bg-green-600 text-white shadow-lg"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            } disabled:opacity-50`}
          >
            <Brain size={18} />
            <span className="hidden sm:inline">Auto (AI)</span>
            <span className="sm:hidden">Auto</span>
          </button>
          <button
            onClick={() => onAutoModeChange(false)}
            disabled={isSimulating || isOptimizing}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              !autoMode
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            } disabled:opacity-50`}
          >
            <Zap size={18} />
            <span className="hidden sm:inline">Manual</span>
            <span className="sm:hidden">Manual</span>
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {autoMode
            ? "Let AI recommend plots to protect"
            : "Click plots in graph to protect them"}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        {autoMode && (
          <button
            onClick={onOptimize}
            disabled={isOptimizing || isSimulating}
            className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Brain size={20} />
            {isOptimizing ? "Optimizing..." : "Get AI Recommendations"}
          </button>
        )}

        {!autoMode && (
          <button
            onClick={onSimulate}
            disabled={isSimulating || isOptimizing}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap size={20} />
            {isSimulating ? "Simulating..." : "Simulate Selection"}
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-gray-700">
        <p className="font-semibold text-blue-900 mb-1">💡 Tip:</p>
        {autoMode
          ? "Click 'Get AI Recommendations' to let the system analyze and suggest the best plots to protect given your budget."
          : "Click on plots in the graph to select them for protection. Watch the disease spread change in real-time."}
      </div>
    </div>
  )
}
