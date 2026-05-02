"use client"

import React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts"
import { TrendingDown } from "lucide-react"

interface ImpactComparisonProps {
  baselineInfections: number
  finalInfections: number
  impact: number
}

export default function ImpactComparison({
  baselineInfections,
  finalInfections,
  impact,
}: ImpactComparisonProps) {
  const percentageReduction =
    baselineInfections > 0
      ? Math.round((impact / baselineInfections) * 100)
      : 0

  const data = [
    {
      name: "No Intervention",
      infections: baselineInfections,
      fill: "#ef4444",
    },
    {
      name: "With Strategy",
      infections: finalInfections,
      fill: "#22c55e",
    },
  ]

  return (
    <div className="p-6 bg-white rounded-2xl border-2 border-blue-200 shadow-lg">
      <h2 className="text-xl font-bold text-[#1a2e1d] flex items-center gap-2 mb-4">
        <TrendingDown className="text-blue-600" size={24} />
        Impact Analysis
      </h2>

      {/* Chart */}
      <div className="mb-4 -mx-4">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.05)" }}
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="infections" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg border border-red-200">
          <span className="font-semibold text-gray-700">Baseline (No action):</span>
          <span className="text-lg font-bold text-red-600">{baselineInfections}</span>
        </div>

        <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg border border-green-200">
          <span className="font-semibold text-gray-700">With Strategy:</span>
          <span className="text-lg font-bold text-green-600">{finalInfections}</span>
        </div>

        <div className="flex justify-between items-center p-2 bg-blue-50 rounded-lg border border-blue-200">
          <span className="font-semibold text-gray-700">Infections Prevented:</span>
          <span className="text-lg font-bold text-blue-600">{impact}</span>
        </div>

        <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border-2 border-purple-300">
          <span className="font-bold text-gray-800">Impact Reduction:</span>
          <span className="text-2xl font-black text-purple-600">
            {percentageReduction}%
          </span>
        </div>
      </div>

      {/* Insight */}
      <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200 text-xs text-gray-700">
        <p className="font-semibold text-purple-900 mb-1">📊 Summary:</p>
        <p className="text-purple-800">
          {impact > 0
            ? `Your intervention strategy can prevent ${impact} infection(s), reducing the disease spread by ${percentageReduction}%.`
            : "Adjust your strategy to increase impact."}
        </p>
      </div>
    </div>
  )
}
