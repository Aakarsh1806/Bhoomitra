"use client"

import React from "react"
import { Play, Pause, ChevronLeft, ChevronRight, Clock3, Flame, ShieldAlert } from "lucide-react"

interface SimulationState {
  time: number
  infected: string[]
  at_risk: string[]
  healthy: string[]
  protected: string[]
}

interface TimelineControlsProps {
  currentTime: number
  maxTime: number
  isPlaying: boolean
  onTimeChange: (time: number) => void
  onPlayPause: () => void
  timelineData: SimulationState[]
}

export default function TimelineControls({
  currentTime,
  maxTime,
  isPlaying,
  onTimeChange,
  onPlayPause,
  timelineData,
}: TimelineControlsProps) {
  const handlePrevious = () => {
    onTimeChange(Math.max(0, currentTime - 1))
  }

  const handleNext = () => {
    onTimeChange(Math.min(maxTime, currentTime + 1))
  }

  const currentState = timelineData[currentTime]
  const progression = currentState
    ? Math.round(
        ((currentState.infected.length + currentState.at_risk.length) /
          Math.max(timelineData[0]?.infected.length || 1, currentState.healthy.length + currentState.infected.length + currentState.at_risk.length + currentState.protected.length)) *
          100
      )
    : 0

  const decisionPoint =
    currentState?.at_risk.length || currentState?.infected.length
      ? currentState?.at_risk.length
        ? `${currentState.at_risk.length} plots need action now`
        : `${currentState.infected.length} infected plots need containment`
      : "No active spread in this step"

  return (
    <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-slate-950 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cyan-100">
            <Clock3 className="h-3.5 w-3.5" />
            Disease timeline
          </div>
          <h3 className="mt-2 text-lg font-black text-white">Spread progression</h3>
        </div>
        <div className="rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-right">
          <div className="text-[0.68rem] uppercase tracking-[0.18em] text-red-200/70">Decision point</div>
          <div className="mt-1 text-sm font-bold text-red-50">{decisionPoint}</div>
        </div>
      </div>

      {/* Timeline Slider */}
      <div className="space-y-2">
        <input
          type="range"
          min="0"
          max={maxTime}
          value={currentTime}
          onChange={(e) => onTimeChange(parseInt(e.target.value))}
          className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-white/10 accent-cyan-400"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>Day 0</span>
          <span>Day {maxTime}</span>
        </div>
      </div>

      {/* Current Time Display */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Current time</p>
        <p className="mt-1 text-4xl font-black text-white">Day {currentTime}</p>
        <p className="mt-2 text-sm text-slate-300">Watch how the infection wave moves to nearby plots.</p>
      </div>

      {/* Infection Progression */}
      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex justify-between text-xs">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-200">
            <Flame className="h-4 w-4 text-red-300" />
            Disease spread pressure
          </span>
          <span className="font-bold text-cyan-200">{progression}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-400 transition-all duration-300"
            style={{ width: `${progression}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={handlePrevious}
          disabled={currentTime === 0}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          onClick={onPlayPause}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 font-semibold text-white transition-all hover:shadow-lg hover:shadow-cyan-500/20"
        >
          {isPlaying ? (
            <>
              <Pause size={20} />
              Pause
            </>
          ) : (
            <>
              <Play size={20} />
              Play
            </>
          )}
        </button>

        <button
          onClick={handleNext}
          disabled={currentTime === maxTime}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Stats for current time */}
      {currentState && (
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-center">
            <div className="font-black text-red-100 text-lg">{currentState.infected.length}</div>
            <div className="text-red-100/70">Infected</div>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-center">
            <div className="font-black text-amber-100 text-lg">{currentState.at_risk.length}</div>
            <div className="text-amber-100/70">At Risk</div>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-center">
            <div className="font-black text-emerald-100 text-lg">{currentState.healthy.length}</div>
            <div className="text-emerald-100/70">Healthy</div>
          </div>
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 text-center">
            <div className="font-black text-sky-100 text-lg">{currentState.protected.length}</div>
            <div className="text-sky-100/70">Protected</div>
          </div>
        </div>
      )}
    </div>
  )
}
