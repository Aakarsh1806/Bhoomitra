"use client"

import React from "react"
import { Lightbulb } from "lucide-react"

interface InsightBoxProps {
  infected: string[]
  at_risk: string[]
  protected: string[]
  time: number
}

export default function InsightBox({
  infected,
  at_risk,
  protected: protectedNodes,
  time,
}: InsightBoxProps) {
  // Generate contextual insight based on current state
  const getInsight = () => {
    if (infected.length === 0) {
      return "🎉 Disease completely controlled! No infections detected."
    }

    if (at_risk.length > infected.length * 2) {
      return `⚠️ High risk of rapid spread! ${at_risk.length} plots are at risk. Act now to contain it.`
    }

    if (protectedNodes.length > 0) {
      const savedPlots = at_risk.length <= 2 ? "several" : `${at_risk.length}`
      return `✅ Protection strategy is working. Your interventions have prevented disease from reaching ${savedPlots} adjacent plots.`
    }

    if (infected.length > 1) {
      const nextInfections = at_risk.slice(0, 3)
      return `📍 Disease spreading from ${infected.length} sources. Adjacent plots at immediate risk: ${nextInfections.map(p => p.replace("plot-", "Plot ")).join(", ")}.`
    }

    return `🔍 Monitoring: Disease starting from single source. Consider early intervention to stop spread.`
  }

  const getSeverity = () => {
    if (infected.length === 0) return "success"
    if (infected.length >= 8) return "critical"
    if (at_risk.length > 6) return "warning"
    return "info"
  }

  const severity = getSeverity()
  const severityColors = {
    success: "bg-green-50 border-green-300 text-green-900",
    warning: "bg-yellow-50 border-yellow-300 text-yellow-900",
    critical: "bg-red-50 border-red-300 text-red-900",
    info: "bg-blue-50 border-blue-300 text-blue-900",
  }

  return (
    <div
      className={`p-4 rounded-lg border-2 flex items-start gap-3 ${severityColors[severity as keyof typeof severityColors]}`}
    >
      <Lightbulb
        size={24}
        className="flex-shrink-0 mt-0.5"
      />
      <div>
        <p className="font-semibold text-sm mb-1">Day {time} Insight</p>
        <p className="text-sm leading-relaxed">{getInsight()}</p>
      </div>
    </div>
  )
}
