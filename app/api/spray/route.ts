import { NextResponse } from "next/server"
import {
  zones,
  zoneHistory,
  pendingCommands,
  hardwareState,
  updateHardwareState,
  recordActivity,
  getSprayWindowStatus,
} from "@/app/api/zones/data"
import { readDB, writeDB } from "@/app/lib/database"

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeSeverity(level?: string): "low" | "moderate" | "high" {
  if (level === "high") return "high"
  if (level === "medium" || level === "moderate") return "moderate"
  return "low"
}

export async function GET() {
  const db = readDB()
  return NextResponse.json(db.sprays)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { zoneId, disease, chemical, dosage, detectionId } = body

  if (hardwareState.killSwitchEngaged) {
    return NextResponse.json({ message: "Safety kill switch is engaged" }, { status: 423 })
  }

  const zoneIndex = zones.findIndex(z => z.id === zoneId)
  if (zoneIndex === -1) {
    return NextResponse.json({ message: "Zone not found" }, { status: 404 })
  }

  const sprayWindow = getSprayWindowStatus(zones[zoneIndex].temperature, zones[zoneIndex].humidity)
  if (!sprayWindow.sprayEnabled) {
    return NextResponse.json(
      {
        message: "Hold spray until optimal VPD window",
        sprayWindow,
      },
      { status: 409 }
    )
  }

  const historyEntry = zoneHistory.find(h => h.zoneId === zoneId)
  if (historyEntry) {
    historyEntry.sprays += 1
  }

  const db = readDB()
  const activeDetections = db.detections.filter((d: any) => d.zoneId === zoneId && d.status === "active")
  const manualWithoutDetection = !detectionId && activeDetections.length === 0

  // ✅ Create spray object FIRST
  const sprayTime = new Date().toISOString()
  const spray = {
    id: crypto.randomUUID(),
    zoneId,
    detectionId: detectionId || null,
    manualWithoutDetection,
    disease,
    chemical,
    dosage,
    timestamp: sprayTime,
    triggeredBy: "Manual Spray"
  }

  db.sprays.push(spray)

  // ✅ Link spray to detection (Lifecycle Update)
  if (detectionId) {
    const detection = db.detections.find((d: any) => d.id === detectionId)

    if (detection) {
      detection.status = "treated"
      detection.treatedAt = spray.timestamp
      detection.linkedSprayId = spray.id
    } else {
      return NextResponse.json({ message: "Detection not found for provided detectionId" }, { status: 404 })
    }
  }

  const remainingActive = db.detections.filter((d: any) => d.zoneId === zoneId && d.status === "active")
  const currentHealth = Number(zones[zoneIndex].healthScore || 65)
  const healthBump = detectionId ? 12 : 6
  const nextHealth = clamp(currentHealth + healthBump, 0, 95)

  let status: "healthy" | "warning" | "critical" = "healthy"
  let diseaseName: string | undefined = undefined

  if (remainingActive.length > 0) {
    const hasHigh = remainingActive.some((d: any) => normalizeSeverity(d.severityLevel) === "high")
    const hasModerate = remainingActive.some((d: any) => normalizeSeverity(d.severityLevel) === "moderate")
    status = hasHigh ? "critical" : hasModerate ? "warning" : "warning"
    diseaseName = remainingActive[0]?.disease
  } else if (nextHealth < 55) {
    status = "critical"
  } else if (nextHealth < 80) {
    status = "warning"
  }

  zones[zoneIndex] = {
    ...zones[zoneIndex],
    status,
    disease: diseaseName,
    healthScore: nextHealth,
    lastSprayed: sprayTime,
  }

  writeDB(db)
  recordActivity({ type: "spray", zoneId, timestamp: sprayTime })

  // Queue command for hardware
  if (!pendingCommands[zoneId]) {
    pendingCommands[zoneId] = []
  }
  pendingCommands[zoneId].push("spray")

  updateHardwareState({
    currentAction: "spray",
    activeZoneId: zoneId,
    currentPath: [zoneId],
    nozzleStatus: "pending",
    lastCommand: `spray:${zoneId}`,
    lastCommandAt: new Date().toISOString(),
    awaitingFeedback: true,
  })

  return NextResponse.json({
    message: manualWithoutDetection
      ? `Spray activated for zone ${zoneId} (no active detection linked)`
      : `Spray activated for zone ${zoneId}`,
    manualWithoutDetection,
    sprayWindow,
  })
}