import fs from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { readDB } from "@/app/lib/database"

const farmerProfilePath = path.join(process.cwd(), "app/data/farmer_profile.json")

function normalizeSeverityLevel(level?: string): "low" | "moderate" | "high" {
  if (level === "high") return "high"
  if (level === "medium" || level === "moderate") return "moderate"
  return "low"
}

function normalizeDetectionStatus(status?: string): "active" | "treated" | "resolved" {
  if (status === "treated") return "treated"
  if (status === "resolved") return "resolved"
  return "active"
}

function isHealthyDiseaseName(disease?: string) {
  return String(disease || "").toLowerCase().includes("healthy")
}

function effectiveSeverityLevel(detection: any): "low" | "moderate" | "high" {
  const diseaseName = detection?.diseaseName || detection?.disease
  if (isHealthyDiseaseName(diseaseName)) return "low"
  return normalizeSeverityLevel(detection?.severityLevel)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getSeverityWeight(level: "low" | "moderate" | "high") {
  if (level === "high") return 1
  if (level === "moderate") return 0.6
  return 0.25
}

function getConfidenceWeight(confidence: any) {
  const parsed = Number(confidence)
  if (!Number.isFinite(parsed)) return 0.7
  return clamp(parsed, 0.2, 1)
}

function getFreshnessWeight(timestamp?: string) {
  const ms = Date.parse(String(timestamp || ""))
  if (Number.isNaN(ms)) return 0.5

  const ageHours = Math.max(0, (Date.now() - ms) / (1000 * 60 * 60))
  return clamp(Math.exp(-ageHours / 48), 0.1, 1)
}

function readFarmZoneCount() {
  try {
    if (!fs.existsSync(farmerProfilePath)) return 1
    const raw = fs.readFileSync(farmerProfilePath, "utf-8")
    const profile = JSON.parse(raw)
    const count = Number(profile?.zoneCount ?? profile?.zones ?? 1)
    return Math.max(1, Number.isFinite(count) ? count : 1)
  } catch {
    return 1
  }
}

export async function GET() {
  const db = readDB()

  const detections = db.detections || []
  const sprays = db.sprays || []

  const totalDetections = detections.length
  const totalSprays = sprays.length

  /* ============================================================
     SEVERITY MODEL (6 / 3 / 1)
  ============================================================ */

  let high = 0
  let moderate = 0
  let low = 0

  detections.forEach((d: any) => {
    const level = effectiveSeverityLevel(d)
    if (level === "high") high++
    else if (level === "moderate") moderate++
    else low++
  })

  const severityPenalty =
    high * 6 +
    moderate * 3 +
    low * 1

  const maxPossiblePenalty =
    totalDetections * 6 || 1

  const weightedRiskPercent =
    (severityPenalty / maxPossiblePenalty) * 100

    const diseaseFrequency: Record<string, number> ={}

  /* ============================================================
     ZONE GROUPING
  ============================================================ */

  const zoneMap: Record<string, any> = {}

  detections.forEach((d: any) => {
    if (!zoneMap[d.zoneId]) {
      zoneMap[d.zoneId] = {
        detections: [],
        sprays: [],
      }
    }
    zoneMap[d.zoneId].detections.push(d)
  })

  detections.forEach((d: any) => {
    const diseaseName = d.diseaseName || d.disease || "Unknown"

    diseaseFrequency[diseaseName] =
      (diseaseFrequency[diseaseName] || 0) + 1
  })

  sprays.forEach((s: any) => {
    if (!zoneMap[s.zoneId]) {
      zoneMap[s.zoneId] = {
        detections: [],
        sprays: [],
      }
    }
    zoneMap[s.zoneId].sprays.push(s)
  })

  /* ============================================================
     ZONE INTELLIGENCE MODEL
  ============================================================ */

  const zoneAnalytics: any[] = []

  Object.keys(zoneMap).forEach((zoneId) => {
    const zone = zoneMap[zoneId]
    const zoneDetections = zone.detections
    const zoneSprays = zone.sprays

    let zoneHigh = 0
    let zoneModerate = 0

    zoneDetections.forEach((d: any) => {
      const level = effectiveSeverityLevel(d)
      if (level === "high") zoneHigh++
      if (level === "moderate") zoneModerate++
    })

    /* ===== Required Spray Logic ===== */

    const requiredSprays =
      zoneHigh * 1 +
      zoneModerate * 0.7

    const actualSprays = zoneSprays.length

    const overSpray =
      Math.max(0, actualSprays - requiredSprays)

    /* ===== Volume Penalty (Logarithmic) ===== */

    const volumePenalty =
      Math.log(actualSprays + 1) * 30

    /* ============================================================
       TRUE RESPONSE DELAY (HOUR BASED)
    ============================================================ */

    let totalDelayPenalty = 0
    let pairedCount = 0

    zoneDetections.forEach((d: any) => {
      const detectionTime = new Date(d.timestamp).getTime()

      const validSprays = zoneSprays
        .filter((s: any) =>
          new Date(s.timestamp).getTime() >= detectionTime
        )
        .sort(
          (a: any, b: any) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime()
        )

      if (validSprays.length === 0) {
        totalDelayPenalty += 15
        return
      }

      const firstSprayTime =
        new Date(validSprays[0].timestamp).getTime()

      const delayHours =
        (firstSprayTime - detectionTime) /
        (1000 * 60 * 60)

      let penalty = 0

      if (delayHours <= 6) penalty = 0
      else if (delayHours <= 24) penalty = 4
      else if (delayHours <= 48) penalty = 8
      else if (delayHours <= 72) penalty = 12
      else penalty = 15

      totalDelayPenalty += penalty
      pairedCount++
    })

    const avgDelayPenalty =
      pairedCount === 0
        ? 0
        : totalDelayPenalty / pairedCount

    /* ===== Over-Spray Penalty ===== */

    const overPenalty =
      overSpray * 8

    /* ============================================================
       FINAL ZONE EFFICIENCY
    ============================================================ */

    let zoneEfficiency =
      100
      - volumePenalty
      - overPenalty
      - avgDelayPenalty

    zoneEfficiency =
      Math.max(40, zoneEfficiency)

    zoneAnalytics.push({
      zoneId,
      requiredSprays,
      actualSprays,
      overSpray,
      volumePenalty,
      overPenalty,
      avgDelayPenalty,
      zoneEfficiency,
    })
  })

  /* ============================================================
     GLOBAL SPRAY EFFICIENCY
  ============================================================ */

  const globalSprayEfficiency =
    zoneAnalytics.length === 0
      ? 100
      : zoneAnalytics.reduce(
          (sum, z) => sum + z.zoneEfficiency,
          0
        ) / zoneAnalytics.length

  /* ============================================================
     WATER MODELING
  ============================================================ */

  const manualWater =
    (high + moderate + low) * 15

  const aiWater =
    totalSprays * 15

  const waterSaved =
    manualWater - aiWater

  const overuse = Math.max(0, aiWater - manualWater)

  const waterReductionPercent =
    manualWater === 0
      ? 0
      : (waterSaved / manualWater) * 100

  const farmZoneCount = readFarmZoneCount()
  const activeDetectionsList = detections.filter((d: any) => normalizeDetectionStatus(d.status) === "active")
  const activeZoneCount = new Set(activeDetectionsList.map((d: any) => d.zoneId).filter(Boolean)).size

  const activeRiskScore = activeDetectionsList.reduce((sum: number, d: any) => {
    const diseaseName = d?.diseaseName || d?.disease
    if (isHealthyDiseaseName(diseaseName)) return sum

    const level = effectiveSeverityLevel(d)
    const severityWeight = getSeverityWeight(level)
    const confidenceWeight = getConfidenceWeight(d?.confidence)
    const freshnessWeight = getFreshnessWeight(d?.timestamp)

    return sum + severityWeight * confidenceWeight * freshnessWeight
  }, 0)

  const currentRiskPercent = clamp(
    (activeRiskScore / Math.max(1, farmZoneCount)) * 100,
    0,
    100
  )

  /* ============================================================
     RETURN OBJECT
  ============================================================ */

  return NextResponse.json({
    totalDetections,
    totalSprays,
    currentRiskPercent,
    activeDetections: activeDetectionsList.length,
    activeZoneCount,
    farmZoneCount,

    severityBreakdown: {
      high,
      moderate,
      medium: moderate,
      low,
      severityPenalty,
      weightedRiskPercent,
    },

    diseaseFrequency,

    zoneAnalytics,
    globalSprayEfficiency,

    waterModel: {
      manualWater,
      aiWater,
      waterSaved,
      overuse,
      waterReductionPercent,
    },
  })
}
