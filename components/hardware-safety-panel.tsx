"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/lib/use-translation"
import { ShieldAlert } from "lucide-react"

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

  return (
    <Card className="border-red-200 bg-red-50/40 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              {t("hardware.killSwitch")}
            </CardTitle>
            <CardDescription>{t("hardware.emergencyStop")}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("hardware.off")}</span>
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
            <span className="text-xs text-muted-foreground">{t("hardware.on")}</span>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
