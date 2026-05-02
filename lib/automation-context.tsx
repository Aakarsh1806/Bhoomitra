"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"

export type Severity = "low" | "moderate" | "high" | "medium"
export type DiseaseType = "Healthy" | "Viral" | "Fungal" | "Bacterial"

export interface DetectionResult {
  id?: string
  disease: string
  confidence: number
  severity: Severity
  type: DiseaseType
}

export interface ZoneState {
  id: string
  disease: string | null
  severity: Severity | null
  pesticide: string | null
  dosage: number | null
  color: string // "green" | "yellow" | "orange" | "red"
  lastUpdated: number | null
}

export interface SprayActivity {
  id: string
  timestamp: string
  zoneId: string
  disease: string
  chemical: string
  dosage: string
  duration: string
}

interface AutomationContextType {
  detectionResult: DetectionResult | null
  setDetectionResult: (result: DetectionResult, zoneId: string) => void
  zones: Record<string, ZoneState>
  isAutoMode: boolean
  setAutoMode: (mode: boolean) => void
  activities: SprayActivity[]
  addActivity: (activity: Omit<SprayActivity, "id">) => void
  triggerSpray: (zoneId: string, chemical: string, dosage: string) => void
}

const AutomationContext = createContext<AutomationContextType | undefined>(undefined)

export function AutomationProvider({ children }: { children: ReactNode }) {
  const [detectionResult, setDetectionResultState] = useState<DetectionResult | null>(null)
  const [isAutoMode, setAutoMode] = useState(true)
  const [activities, setActivities] = useState<SprayActivity[]>([])
  
  // Initialize grid zones A1-D6
  const initialZones: Record<string, ZoneState> = {}
  ;["A", "B", "C", "D"].forEach((row) => {
    for (let i = 1; i <= 6; i++) {
      const id = `${row}${i}`
      initialZones[id] = {
        id,
        disease: null,
        severity: null,
        pesticide: null,
        dosage: null,
        color: "bg-green-100", // Default healthy/idle
        lastUpdated: null,
      }
    }
  })

  const [zones, setZones] = useState<Record<string, ZoneState>>(initialZones)

  const setDetectionResult = (result: DetectionResult, zoneId: string) => {
    setDetectionResultState(result)
    
    // Update zone state based on detection
    setZones(prev => ({
      ...prev,
      [zoneId]: {
        ...prev[zoneId],
        disease: result.disease,
        severity: result.severity,
        color: getZoneColor(result.type),
        lastUpdated: Date.now()
      }
    }))
  }

  const getZoneColor = (type: DiseaseType) => {
    switch (type) {
      case "Viral": return "bg-yellow-400 text-yellow-950 border-yellow-600"
      case "Fungal": return "bg-orange-500 text-white border-orange-700"
      case "Bacterial": return "bg-red-600 text-white border-red-800"
      case "Healthy": return "bg-green-500 text-white border-green-700"
      default: return "bg-slate-100 text-slate-500 border-slate-200"
    }
  }

  const addActivity = (activity: Omit<SprayActivity, "id">) => {
    const newActivity = { ...activity, id: Math.random().toString(36).substr(2, 9) }
    setActivities(prev => [newActivity, ...prev].slice(0, 20))
  }

  const triggerSpray = (zoneId: string, chemical: string, dosage: string) => {
    addActivity({
      timestamp: new Date().toLocaleTimeString(),
      zoneId,
      disease: zones[zoneId]?.disease || "Unknown",
      chemical,
      dosage: `${dosage}%`,
      duration: "15s"
    })
  }

  return (
    <AutomationContext.Provider value={{
      detectionResult,
      setDetectionResult,
      zones,
      isAutoMode,
      setAutoMode,
      activities,
      addActivity,
      triggerSpray
    }}>
      {children}
    </AutomationContext.Provider>
  )
}

export function useAutomation() {
  const context = useContext(AutomationContext)
  if (context === undefined) {
    throw new Error("useAutomation must be used within an AutomationProvider")
  }
  return context
}
