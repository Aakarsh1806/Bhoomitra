"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/lib/use-translation"
import { ShieldAlert, Route, Pipette, Activity } from "lucide-react"

type HardwareState = {
  killSwitchEngaged: boolean
  currentAction: "idle" | "spray" | "hydrate" | "moving"
  activeZoneId: string | null
  currentPath: string[]
  nozzleStatus: "idle" | "pending" | "open" | "clogged" | "closed"
  lastCommand: string | null
  lastCommandAt: string | null
  lastFeedback: string | null
  lastFeedbackAt: string | null
  awaitingFeedback: boolean
}

const defaultState: HardwareState = {
  killSwitchEngaged: false,
  currentAction: "idle",
  activeZoneId: null,
  currentPath: [],
  nozzleStatus: "idle",
  lastCommand: null,
  lastCommandAt: null,
  lastFeedback: null,
  lastFeedbackAt: null,
  awaitingFeedback: false,
}

export default function HardwareSafetyPanel() {
  const t = useTranslation()
  const [hardwareState, setHardwareState] = useState<HardwareState>(defaultState)
  const [loading, setLoading] = useState(false)

  const fetchState = async () => {
    try {
      const res = await fetch("/api/hardware/status")
      const data = await res.json()
      setHardwareState({ ...defaultState, ...data })
    } catch (error) {
      console.error("Failed to fetch hardware status", error)
    }
  }

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 3000)
    return () => clearInterval(interval)
  }, [])

  const toggleKillSwitch = async (enabled: boolean) => {
    try {
      setLoading(true)
      await fetch("/api/hardware/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ killSwitchEngaged: enabled }),
      })
      await fetchState()
    } catch (error) {
      console.error("Failed to update kill switch", error)
    } finally {
      setLoading(false)
    }
  }

  const pathLabel = hardwareState.currentPath.length > 0 ? hardwareState.currentPath.join(" → ") : "Idle"

  return (
    <Card className="border-red-200 bg-red-50/40 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              {t("hardware.killSwitch")}
            </CardTitle>
            <CardDescription>{t("hardware.description", "Live hardware lock, nozzle feedback, and sprayer path")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">OFF</span>
            <Button
              type="button"
              size="sm"
              variant={hardwareState.killSwitchEngaged ? "destructive" : "secondary"}
              onClick={() => toggleKillSwitch(!hardwareState.killSwitchEngaged)}
              disabled={loading}
              className="min-w-24"
            >
              {hardwareState.killSwitchEngaged ? t("hardware.engaged") : t("hardware.enable")}
            </Button>
            <span className="text-xs text-muted-foreground">ON</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-lg bg-white p-3 border">
          <span className="text-muted-foreground flex items-center gap-2"><Activity className="h-4 w-4" /> {t("hardware.mode")}</span>
          <Badge variant={hardwareState.killSwitchEngaged ? "destructive" : "secondary"}>
            {hardwareState.killSwitchEngaged ? t("hardware.automationLocked") : t("hardware.ready")}
          </Badge>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-white p-3 border">
          <span className="text-muted-foreground flex items-center gap-2"><Route className="h-4 w-4" /> {t("hardware.path")}</span>
          <span className="font-medium text-right">{pathLabel}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-white p-3 border">
          <span className="text-muted-foreground flex items-center gap-2"><Pipette className="h-4 w-4" /> {t("zone.nozzle")}</span>
          <span className="font-medium capitalize">{hardwareState.nozzleStatus}</span>
        </div>
        <div className="rounded-lg bg-white p-3 border">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t("hardware.feedback")}</span>
            <span className="font-medium text-right">
              {hardwareState.lastFeedback || (hardwareState.awaitingFeedback ? t("hardware.waiting", "Waiting for hardware response") : t("hardware.none", "None yet"))}
            </span>
          </div>
          {hardwareState.lastCommand && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("hardware.lastCommand")}: {hardwareState.lastCommand}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
