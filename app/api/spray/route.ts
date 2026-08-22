import { NextResponse } from "next/server"
import {
  zones,
  pendingCommands,
  hardwareState,
  updateHardwareState,
  getFarmClimate,
  irrigationSettings,
} from "@/app/api/zones/data"
import { readDB, writeDB } from "@/app/lib/database"
import { getForecast } from "@/app/lib/weatherService"
import { decideFarmActions } from "@/app/lib/farmDecisionService"
import { isDemoControlZone } from "@/app/lib/demoHardware"
import { estimatePulseLitres, FLOW_SOURCE_LABEL } from "@/app/lib/flowModel"
import { buildWaterLogEntry } from "@/app/lib/waterLedger"
import { getCurrentFarmId } from "@/app/lib/farmContext"

export async function GET() {
  const db = readDB()
  return NextResponse.json(db.sprays)
}

export async function POST(req: Request) {
  const body = await req.json()
  const {
    zoneId,
    disease,
    chemical,
    dosage,
    detectionId,
    weatherOverride,
    tankPrepared,
    demoWaterOnly,
    preHarvestIntervalDays,
    inputCostInr,
    waterPh,
    labelRate,
    rateUnit,
    carrierWaterLiters,
    tankCapacityLiters,
  } = body
  const isWaterValidation = demoWaterOnly === true

  if (hardwareState.killSwitchEngaged) {
    return NextResponse.json({ message: "Safety kill switch is engaged" }, { status: 423 })
  }

  const zoneIndex = zones.findIndex((zone) => zone.id === zoneId)
  if (zoneIndex === -1) {
    return NextResponse.json({ message: "Zone not found" }, { status: 404 })
  }

  if (!isDemoControlZone(zoneId)) {
    return NextResponse.json(
      { message: "The physical spray-pump demonstration is wired to A1–A4. This zone remains available for planning only." },
      { status: 409 },
    )
  }

  const weather = await getForecast()
  const decision = decideFarmActions({
    soilMoisture: zones[zoneIndex].soilMoisture,
    dryThreshold: irrigationSettings.dryThreshold,
    climate: getFarmClimate(),
    weather,
  })
  const isExplicitWeatherOverride =
    decision.spray.requiresWeatherOverride && weatherOverride === true

  if (!isWaterValidation && !tankPrepared) {
    return NextResponse.json(
      {
        message: "Confirm that the farmer-prepared tank matches the verified product label before queueing a chemical application.",
        decision,
      },
      { status: 409 },
    )
  }

  // A combined free-text dosage string (e.g. "0 g/L") can't be trusted to prove
  // a real, non-zero rate — the numeric labelRate + rateUnit must be validated
  // directly, not string-matched against the literal "0".
  const parsedLabelRate = Number(labelRate)
  if (!isWaterValidation && (!chemical || !dosage || !rateUnit || !Number.isFinite(parsedLabelRate) || parsedLabelRate <= 0)) {
    return NextResponse.json(
      {
        message: "A verified product and non-zero label rate (with unit) are required before a chemical application can be queued.",
        decision,
      },
      { status: 422 },
    )
  }

  const parsedCarrierWater = Number(carrierWaterLiters)
  const parsedTankCapacity = Number(tankCapacityLiters)
  if (!isWaterValidation && (!Number.isFinite(parsedCarrierWater) || parsedCarrierWater <= 0 || !Number.isFinite(parsedTankCapacity) || parsedTankCapacity <= 0)) {
    return NextResponse.json(
      {
        message: "Enter verified carrier-water volume and tank capacity before queueing a chemical application.",
        decision,
      },
      { status: 422 },
    )
  }

  const phiDays = Number(preHarvestIntervalDays)
  if (!isWaterValidation && (!Number.isFinite(phiDays) || phiDays < 0)) {
    return NextResponse.json(
      { message: "Enter the pre-harvest interval from the verified product label before queueing a chemical application." },
      { status: 422 },
    )
  }

  const parsedCost = Number(inputCostInr)
  const parsedWaterPh = Number(waterPh)

  if (!isWaterValidation && !decision.spray.allowed && !isExplicitWeatherOverride) {
    return NextResponse.json({ message: decision.spray.reason, decision }, { status: 409 })
  }

  const db = readDB()
  const linkedDetection = detectionId
    ? db.detections.find((d: any) => d.id === detectionId)
    : null

  if (!isWaterValidation && detectionId && !linkedDetection) {
    return NextResponse.json({ message: "Detection not found for the supplied record ID" }, { status: 404 })
  }

  if (!isWaterValidation && linkedDetection?.cropMatch === "review") {
    return NextResponse.json(
      { message: "Crop confirmation is required before a scan can enter the spray queue." },
      { status: 409 },
    )
  }

  if (!isWaterValidation && linkedDetection?.status !== "active") {
    return NextResponse.json(
      { message: "This detection is no longer an active treatment candidate." },
      { status: 409 },
    )
  }

  const hasQueuedSpray = pendingCommands[zoneId]?.includes("spray") || db.sprays.some(
    (spray: any) => spray.zoneId === zoneId && spray.applicationStatus === "queued",
  )
  if (hasQueuedSpray) {
    return NextResponse.json(
      { message: `A spray command for ${zoneId} is already awaiting controller feedback.` },
      { status: 409 },
    )
  }

  const queuedAt = new Date().toISOString()
  const farmId = getCurrentFarmId()
  // One spray command = one physical 3-second pump pulse. Estimated (never
  // metered) from the flow model. The farmer's carrier-water volume is the tank
  // plan and stays separate metadata.
  const estimatedLitres = estimatePulseLitres(1)
  const spray = {
    id: crypto.randomUUID(),
    farmId,
    zoneId,
    detectionId: isWaterValidation ? null : detectionId || null,
    manualWithoutDetection: !isWaterValidation && !detectionId,
    disease: isWaterValidation ? "Pump delivery validation" : disease || "Manual application",
    chemical: isWaterValidation ? "Water-only prototype validation" : chemical,
    dosage: isWaterValidation ? "No chemical added" : dosage,
    timestamp: queuedAt,
    queuedAt,
    completedAt: null,
    applicationStatus: "queued",
    applicationMode: isWaterValidation ? "water-validation" : "farmer-confirmed-mix",
    tankPrepared: isWaterValidation ? true : tankPrepared === true,
    triggeredBy: isWaterValidation ? "Water pump validation" : "Farmer-confirmed application",
    preHarvestIntervalDays: isWaterValidation ? null : phiDays,
    inputCostInr: !isWaterValidation && Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : null,
    waterPh: !isWaterValidation && Number.isFinite(parsedWaterPh) && parsedWaterPh >= 0 && parsedWaterPh <= 14 ? parsedWaterPh : null,
    labelRate: isWaterValidation ? null : parsedLabelRate,
    rateUnit: isWaterValidation ? null : rateUnit,
    carrierWaterLiters: isWaterValidation ? null : parsedCarrierWater,
    tankCapacityLiters: isWaterValidation ? null : parsedTankCapacity,
    estimatedLitres,
    volumeSource: FLOW_SOURCE_LABEL,
  }

  // A queue entry is an intention, not proof of a completed spray. The
  // controller's closed-pump feedback finalizes this record and any linked
  // detection lifecycle update.
  db.sprays.push(spray)
  // Mirror the volume into the unified ledger so analytics has one honest
  // stream for every litre the pump moves (spray + irrigation).
  db.waterLog.push(
    buildWaterLogEntry({
      farmId,
      zoneId,
      kind: "spray",
      mode: isWaterValidation ? "water-validation" : "chemical",
      pulses: 1,
      status: "queued",
      timestamp: queuedAt,
    }),
  )
  writeDB(db)

  if (!pendingCommands[zoneId]) pendingCommands[zoneId] = []
  pendingCommands[zoneId].push("spray")

  updateHardwareState({
    currentAction: "spray",
    activeZoneId: zoneId,
    currentPath: [zoneId],
    nozzleStatus: "pending",
    lastCommand: `spray:${zoneId}:queued`,
    lastCommandAt: queuedAt,
    awaitingFeedback: true,
  })

  return NextResponse.json({
    message: isWaterValidation
      ? `Water-only spray-pump test queued for ${zoneId}. It will complete when the controller reports the pulse closed.`
      : `Verified application queued for ${zoneId}. It remains pending until the controller reports the pulse closed.`,
    applicationStatus: "queued",
    decision,
    weatherOverrideUsed: isExplicitWeatherOverride,
  })
}
