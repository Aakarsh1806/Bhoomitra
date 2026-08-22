import fs from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { zones } from "@/app/api/zones/data"
import { readDB } from "@/app/lib/database"

const farmerProfilePath = path.join(process.cwd(), "app/data/farmer_profile.json")

type Severity = "low" | "moderate" | "high"

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeSeverity(level?: string): Severity {
  if (level === "high") return "high"
  if (level === "moderate" || level === "medium") return "moderate"
  return "low"
}

function isHealthy(disease?: string) {
  return String(disease || "").toLowerCase().includes("healthy")
}

function cropFromDetection(detection: any) {
  if (detection?.scanCrop) return String(detection.scanCrop)
  if (detection?.modelCrop) return String(detection.modelCrop)
  return String(detection?.diseaseName || detection?.disease || "").split("___")[0]?.replace(/_/g, " ").trim() || "Unspecified crop"
}

function readFarmCrop() {
  try {
    if (!fs.existsSync(farmerProfilePath)) return "Unspecified crop"
    const profile = JSON.parse(fs.readFileSync(farmerProfilePath, "utf-8"))
    return String(profile?.primaryCrop || "Unspecified crop")
  } catch {
    return "Unspecified crop"
  }
}

function freshnessWeight(timestamp?: string) {
  const parsed = Date.parse(String(timestamp || ""))
  if (Number.isNaN(parsed)) return 0.6
  const ageDays = Math.max(0, (Date.now() - parsed) / 86_400_000)
  return clamp(Math.exp(-ageDays / 14), 0.35, 1)
}

function detectionRisk(detection: any) {
  const severity = normalizeSeverity(detection?.severityLevel)
  const base = severity === "high" ? 0.62 : severity === "moderate" ? 0.38 : 0.18
  const confidence = clamp(Number(detection?.confidence) || 0.5, 0.2, 1)
  const decayed = base * (0.45 + confidence * 0.55) * freshnessWeight(detection?.timestamp)
  // An active high-severity detection must never be diluted below the
  // dashboard's "critical" red threshold (currentRiskPercent >= 50) just
  // because confidence or freshness are low — the field-health headline and
  // the zone's "critical" status badge must always agree with each other.
  const floor = severity === "high" ? 0.55 : 0
  return clamp(Math.max(decayed, floor), 0, 0.9)
}

function combinedRisk(detections: any[]) {
  const probabilityNone = detections.reduce((product, detection) => product * (1 - detectionRisk(detection)), 1)
  return Number((clamp((1 - probabilityNone) * 100, 0, 100)).toFixed(1))
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export async function GET() {
  const db = readDB()
  const detections: any[] = db.detections || []
  const allSprays: any[] = db.sprays || []
  const farmCrop = readFarmCrop()

  const activeDetections = detections.filter(
    (detection) => detection.status === "active" && !isHealthy(detection.diseaseName || detection.disease) && detection.cropMatch !== "review",
  )
  const completedChemicalSprays = allSprays.filter(
    (spray) => spray.applicationMode !== "water-validation" && spray.applicationStatus !== "queued",
  )
  // Water-pump validation tests are counted separately (below), so they must not
  // inflate "awaiting controller feedback" — otherwise Analytics claims a pending
  // command while Smart Spray's live queue shows the pump idle.
  const queuedApplications = allSprays.filter(
    (spray) => spray.applicationStatus === "queued" && spray.applicationMode !== "water-validation",
  )
  const waterValidationTests = allSprays.filter((spray) => spray.applicationMode === "water-validation")

  const currentRiskPercent = combinedRisk(activeDetections)
  const high = activeDetections.filter((detection) => normalizeSeverity(detection.severityLevel) === "high").length
  const moderate = activeDetections.filter((detection) => normalizeSeverity(detection.severityLevel) === "moderate").length
  const low = activeDetections.filter((detection) => normalizeSeverity(detection.severityLevel) === "low").length
  const activeZoneCount = new Set(activeDetections.map((detection) => detection.zoneId).filter(Boolean)).size

  const zoneAnalytics = zones
    .slice()
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((zone) => {
      const zoneActive = activeDetections.filter((detection) => detection.zoneId === zone.id)
      const zoneHistory = detections
        .filter((detection) => detection.zoneId === zone.id)
        .slice()
        .sort((a, b) => Date.parse(String(b.timestamp || "")) - Date.parse(String(a.timestamp || "")))
      const zoneSprays = completedChemicalSprays.filter((spray) => spray.zoneId === zone.id)
      const zoneQueued = queuedApplications.filter((spray) => spray.zoneId === zone.id)
      return {
        zoneId: zone.id,
        soilMoisture: zone.soilMoisture,
        activeDetections: zoneActive.length,
        historicalScans: zoneHistory.length,
        completedApplications: zoneSprays.length,
        queuedApplications: zoneQueued.length,
        currentRiskPercent: combinedRisk(zoneActive),
        status: zoneActive.some((detection) => normalizeSeverity(detection.severityLevel) === "high")
          ? "critical"
          : zoneActive.length > 0
            ? "monitor"
            : "stable",
        // A cross-crop/unconfirmed ("review") record must stay audit-only and
        // never surface as the zone's farm conclusion.
        latestDisease: zoneActive[0]?.disease || zoneHistory.find((detection) => detection.cropMatch !== "review")?.disease || null,
      }
    })

  const diseaseGroups = new Map<string, { name: string; records: number; active: number; highestSeverity: Severity; crops: Set<string> }>()
  detections
    .filter((detection) => !isHealthy(detection.diseaseName || detection.disease))
    .forEach((detection) => {
      const name = String(detection.diseaseName || detection.disease || "Unspecified diagnosis")
      const current = diseaseGroups.get(name) || { name, records: 0, active: 0, highestSeverity: "low" as Severity, crops: new Set<string>() }
      current.records += 1
      if (detection.status === "active" && detection.cropMatch !== "review") current.active += 1
      const severity = normalizeSeverity(detection.severityLevel)
      if ((severity === "high") || (severity === "moderate" && current.highestSeverity === "low")) current.highestSeverity = severity
      current.crops.add(cropFromDetection(detection))
      diseaseGroups.set(name, current)
    })

  const loggedCosts = completedChemicalSprays
    .map((spray) => numeric(spray.inputCostInr ?? spray.estimatedInputCostInr))
    .filter((cost): cost is number => cost !== null)
  const responseHours = completedChemicalSprays
    .map((spray) => {
      const detection = spray.detectionId ? detections.find((item) => item.id === spray.detectionId) : null
      const start = Date.parse(String(detection?.timestamp || ""))
      const end = Date.parse(String(spray.completedAt || spray.timestamp || ""))
      return !Number.isNaN(start) && !Number.isNaN(end) && end >= start ? (end - start) / 3_600_000 : null
    })
    .filter((hours): hours is number => hours !== null)
  const crossCropRecords = detections.filter((detection) => {
    const crop = cropFromDetection(detection)
    return detection.cropMatch === "review" || (farmCrop !== "Unspecified crop" && crop !== "Unspecified crop" && crop.toLowerCase() !== farmCrop.toLowerCase())
  })
  const activePhiHolds = completedChemicalSprays
    .map((spray) => {
      const days = Number(spray.preHarvestIntervalDays)
      const completedAt = Date.parse(String(spray.completedAt || spray.timestamp || ""))
      if (!Number.isFinite(days) || days < 0 || Number.isNaN(completedAt)) return null
      const releaseAt = completedAt + days * 86_400_000
      return releaseAt > Date.now() ? { zoneId: spray.zoneId, releaseAt } : null
    })
    .filter((hold): hold is { zoneId: string; releaseAt: number } => hold !== null)

  return NextResponse.json({
    totalDetections: detections.length,
    totalSprays: completedChemicalSprays.length,
    queuedApplications: queuedApplications.length,
    currentRiskPercent,
    activeDetections: activeDetections.length,
    activeZoneCount,
    farmZoneCount: zones.length,
    severityBreakdown: { high, moderate, medium: moderate, low },
    zoneAnalytics,
    diseaseAnalytics: [...diseaseGroups.values()]
      .map((group) => ({ ...group, crops: [...group.crops] }))
      .sort((a, b) => b.active - a.active || b.records - a.records || a.name.localeCompare(b.name)),
    waterModel: {
      completedChemicalApplications: completedChemicalSprays.length,
      waterValidationTests: waterValidationTests.length,
      calibrationRequired: true,
      message: "Volume is intentionally not estimated until the pump's mL-per-three-second calibration is recorded.",
    },
    financial: {
      currency: "INR",
      totalInputCostInr: loggedCosts.length ? Number(loggedCosts.reduce((sum, cost) => sum + cost, 0).toFixed(2)) : null,
      applicationsWithCost: loggedCosts.length,
      completedApplications: completedChemicalSprays.length,
      message: loggedCosts.length
        ? "Input-cost total is based only on farmer-entered product costs."
        : "Log a product cost with a confirmed tank plan to begin input-cost tracking.",
    },
    responseTiming: {
      completedLinkedApplications: responseHours.length,
      averageHours: responseHours.length ? Number((responseHours.reduce((sum, hours) => sum + hours, 0) / responseHours.length).toFixed(1)) : null,
      message: responseHours.length
        ? "Measured from scan time to controller-confirmed application completion."
        : "Response timing appears after a linked application receives controller-closed feedback.",
    },
    preHarvest: {
      activeHolds: activePhiHolds.length,
      nextReleaseAt: activePhiHolds.length ? new Date(Math.min(...activePhiHolds.map((hold) => hold.releaseAt))).toISOString() : null,
      message: activePhiHolds.length
        ? "At least one completed application is still inside its logged pre-harvest interval."
        : "No logged pre-harvest interval is currently holding a completed zone.",
    },
    cropContext: {
      farmCrop,
      crossCropRecords: crossCropRecords.length,
      message: crossCropRecords.length
        ? "Cross-crop or unconfirmed records are separated for review; they do not create automatic spray instructions."
        : "All recorded scans align with the selected crop context.",
    },
  })
}
