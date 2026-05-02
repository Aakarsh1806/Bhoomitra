import {
  ZoneStatus,
  ZoneData,
  ZoneHistoryEntry,
  GridColor,
  DetectionEvent,
  VpdBand,
  IrrigationCycleRuntime,
  SensorRuntime,
} from "./types"
import fs from "fs"
import path from "path"
import { readDB, writeDB } from "@/app/lib/database"

const globalMemory = global as any

type FarmProfile = {
  acres: number
  zoneSizeAcres: number
  totalZones: number
  rows: number
  cols: number
}

type FarmerProfileFile = {
  acres?: number
  zones?: number
  zoneCount?: number
  primaryCrop?: string
}

export type HardwareNozzleStatus = "idle" | "pending" | "open" | "clogged" | "closed"

export type HardwareState = {
  killSwitchEngaged: boolean
  currentAction: "idle" | "spray" | "hydrate" | "moving"
  activeZoneId: string | null
  currentPath: string[]
  nozzleStatus: HardwareNozzleStatus
  lastCommand: string | null
  lastCommandAt: string | null
  lastFeedback: string | null
  lastFeedbackAt: string | null
  awaitingFeedback: boolean
}

export type IrrigationSettings = {
  dryThreshold: number
  wetThreshold: number
  ripeningMode: boolean
  singlePumpMode: boolean
  cycleOnMs: number
  cycleOffMs: number
  maxDurationMs: number
  unchangedSensorMs: number
  minChangePercent: number
}

export type SprayWindowStatus = {
  vpd: number
  band: VpdBand
  message: string
  sprayEnabled: boolean
}

const farmerProfilePath = path.join(process.cwd(), "app/data/farmer_profile.json")
const irrigationSettingsPath = path.join(process.cwd(), "app/data/irrigation_settings.json")

const DEFAULT_SETTINGS: IrrigationSettings = {
  dryThreshold: 40,
  wetThreshold: 60,
  ripeningMode: false,
  singlePumpMode: true,
  cycleOnMs: 10 * 60 * 1000,
  cycleOffMs: 50 * 60 * 1000,
  maxDurationMs: 6 * 60 * 60 * 1000,
  unchangedSensorMs: 30 * 60 * 1000,
  minChangePercent: 0.5,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function readFarmerProfile(): FarmerProfileFile | null {
  try {
    if (!fs.existsSync(farmerProfilePath)) return null
    const raw = fs.readFileSync(farmerProfilePath, "utf-8")
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function readIrrigationSettings(): IrrigationSettings {
  try {
    if (!fs.existsSync(irrigationSettingsPath)) {
      fs.writeFileSync(irrigationSettingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8")
      return { ...DEFAULT_SETTINGS }
    }

    const parsed = JSON.parse(fs.readFileSync(irrigationSettingsPath, "utf-8"))
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      dryThreshold: clamp(Number(parsed?.dryThreshold ?? DEFAULT_SETTINGS.dryThreshold), 5, 95),
      wetThreshold: clamp(Number(parsed?.wetThreshold ?? DEFAULT_SETTINGS.wetThreshold), 5, 95),
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeIrrigationSettings(settings: IrrigationSettings) {
  fs.writeFileSync(irrigationSettingsPath, JSON.stringify(settings, null, 2), "utf-8")
}

function getPlantingDensityDivisor(primaryCrop?: string) {
  const crop = (primaryCrop || "").toLowerCase()

  if (crop.includes("tomato")) return 4
  if (crop.includes("rice") || crop.includes("paddy")) return 1
  if (crop.includes("cotton")) return 6
  return 3
}

function calculateInitialHealthScore(soilMoisture: number, humidity: number, temperature: number) {
  const moisturePenalty = Math.abs(65 - soilMoisture) * 0.8
  const humidityPenalty = Math.max(0, humidity - 75) * 0.5
  const temperaturePenalty = Math.abs(24 - temperature) * 0.6
  return clamp(Math.round(100 - moisturePenalty - humidityPenalty - temperaturePenalty), 35, 95)
}

function getRowLabel(index: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let value = index
  let label = ""

  do {
    label = alphabet[value % 26] + label
    value = Math.floor(value / 26) - 1
  } while (value >= 0)

  return label
}

function buildFarmProfile(acresInput: number, zoneSizeAcresInput: number): FarmProfile {
  const acres = clamp(Number.isFinite(acresInput) ? acresInput : 6, 2, 10)
  const zoneSizeAcres = clamp(Number.isFinite(zoneSizeAcresInput) ? zoneSizeAcresInput : 0.25, 0.1, 1)
  const totalZones = Math.max(1, Math.ceil(acres / zoneSizeAcres))
  const cols = Math.max(2, Math.ceil(Math.sqrt(totalZones)))
  const rows = Math.max(1, Math.ceil(totalZones / cols))

  return {
    acres,
    zoneSizeAcres,
    totalZones,
    rows,
    cols,
  }
}

function getGridColorByMoisture(soilMoisture: number, settings: IrrigationSettings): GridColor {
  if (soilMoisture < settings.dryThreshold) return "red"
  if (soilMoisture < settings.wetThreshold) return "yellow"
  return "green"
}

function createDefaultSensorRuntime(): SensorRuntime {
  return {
    hasError: false,
    errorMessage: null,
    lastValidAt: null,
    lastValue: null,
    unchangedSince: null,
  }
}

function createDefaultCycleRuntime(): IrrigationCycleRuntime {
  return {
    active: false,
    state: "idle",
    cycleStartedAt: null,
    phaseStartedAt: null,
    totalElapsedMs: 0,
    pumpOn: false,
    targetByGlobalHydrate: false,
  }
}

function generateZones(profile: FarmProfile, settings: IrrigationSettings): ZoneData[] {
  const zoneList: ZoneData[] = []
  const farmerProfile = readFarmerProfile()
  const acres = farmerProfile?.acres ?? profile.acres
  const zoneCount = farmerProfile?.zoneCount ?? farmerProfile?.zones ?? profile.totalZones
  const zoneAreaSqYards = (acres * 4840) / Math.max(1, zoneCount)
  const densityDivisor = getPlantingDensityDivisor(farmerProfile?.primaryCrop)
  const dynamicPlantCount = Math.max(1, Math.floor(zoneAreaSqYards / densityDivisor))

  const getInitialStatus = (index: number): ZoneStatus => {
    if (index === 0 || index === 1) return "warning"
    if (index === 2 || index === 3) return "critical"
    return "healthy"
  }

  const getInitialSoilMoisture = (status: ZoneStatus) => {
    if (status === "warning") return 38
    if (status === "critical") return 22
    return 72
  }

  const getInitialHumidity = (status: ZoneStatus) => {
    if (status === "warning") return 81
    if (status === "critical") return 91
    return 68
  }

  for (let i = 0; i < zoneCount; i++) {
    const row = Math.floor(i / profile.cols)
    const col = i % profile.cols
    const rowLabel = getRowLabel(row)
    const id = `${rowLabel}${col + 1}`

    const status = getInitialStatus(i)
    const moisture = getInitialSoilMoisture(status)
    const humidity = getInitialHumidity(status)
    const temperature = status === "critical" ? 29 : status === "warning" ? 26 : 23
    const healthScore = calculateInitialHealthScore(moisture, humidity, temperature)

    zoneList.push({
      id,
      row,
      col,
      status,
      lastSprayed: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
      soilMoisture: moisture,
      temperature,
      humidity,
      plantCount: dynamicPlantCount,
      healthScore,
      gridColor: getGridColorByMoisture(moisture, settings),
      dryThreshold: settings.dryThreshold,
      wetThreshold: settings.wetThreshold,
      hydrateEligible: moisture < settings.wetThreshold,
      sensor: createDefaultSensorRuntime(),
      cycle: createDefaultCycleRuntime(),
      pumpStatus: "off",
      vpd: 0,
      vpdBand: "red",
      sprayEnabled: false,
      sprayMessage: "Hold spray until optimal VPD window",
    })
  }

  return zoneList
}

function generateZoneHistory(zoneList: ZoneData[]): ZoneHistoryEntry[] {
  return zoneList.map(zone => ({
    zoneId: zone.id,
    moistureHistory: [zone.soilMoisture],
    temperatureHistory: [zone.temperature],
    sprays: 0,
    diseaseHistory: [],
    confidenceHistory: [],
    severityHistory: [],
    timestampHistory: [],
    treatmentHistory: [],
  }))
}

export function calculateVPD(temperature: number, humidity: number) {
  return ((100 - humidity) / 100) * (0.61078 * Math.exp((17.27 * temperature) / (temperature + 237.3)))
}

export function getSprayWindowStatus(temperature: number, humidity: number): SprayWindowStatus {
  const vpd = calculateVPD(temperature, humidity)
  let band: VpdBand = "red"

  if (vpd >= 0.8 && vpd <= 1.2) {
    band = "green"
  } else if (vpd >= 1.3 && vpd <= 1.9) {
    band = "orange"
  } else if (vpd < 0.4 || vpd > 2.0) {
    band = "red"
  }

  return {
    vpd: Number(vpd.toFixed(3)),
    band,
    message: band === "red" ? "Hold spray until optimal VPD window" : band === "orange" ? "Spray with caution in current VPD range" : "Optimal spray window",
    sprayEnabled: band === "green",
  }
}

export const simulationEnabledRef = globalMemory.simulationEnabledRef || { value: false }
if (!globalMemory.simulationEnabledRef) globalMemory.simulationEnabledRef = simulationEnabledRef

export const hardwareState: HardwareState = globalMemory.hardwareState || {
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
if (!globalMemory.hardwareState) globalMemory.hardwareState = hardwareState

export function updateHardwareState(partial: Partial<HardwareState>) {
  Object.assign(hardwareState, partial)
  globalMemory.hardwareState = hardwareState
  return hardwareState
}

const defaultProfile = buildFarmProfile(Number(process.env.FARM_ACRES ?? 6), Number(process.env.FARM_ZONE_SIZE_ACRES ?? 0.25))

export let irrigationSettings: IrrigationSettings = globalMemory.irrigationSettings || readIrrigationSettings()
if (!globalMemory.irrigationSettings) globalMemory.irrigationSettings = irrigationSettings

export function updateIrrigationSettings(partial: Partial<IrrigationSettings>) {
  irrigationSettings = {
    ...irrigationSettings,
    ...partial,
    dryThreshold: clamp(Number(partial.dryThreshold ?? irrigationSettings.dryThreshold), 5, 95),
    wetThreshold: clamp(Number(partial.wetThreshold ?? irrigationSettings.wetThreshold), 5, 95),
  }

  if (irrigationSettings.wetThreshold <= irrigationSettings.dryThreshold) {
    irrigationSettings.wetThreshold = Math.min(95, irrigationSettings.dryThreshold + 5)
  }

  writeIrrigationSettings(irrigationSettings)
  globalMemory.irrigationSettings = irrigationSettings

  zones = zones.map(zone => deriveZoneRuntime(zone))
  globalMemory.zones = zones
  return irrigationSettings
}

export let farmProfile: FarmProfile = globalMemory.farmProfile || defaultProfile
if (!globalMemory.farmProfile) globalMemory.farmProfile = farmProfile

export let zones: ZoneData[] = globalMemory.zones || generateZones(farmProfile, irrigationSettings)
if (!globalMemory.zones) globalMemory.zones = zones

export let zoneHistory: ZoneHistoryEntry[] = globalMemory.zoneHistory || generateZoneHistory(zones)
if (!globalMemory.zoneHistory) globalMemory.zoneHistory = zoneHistory

export const activityLog: {
  type: "spray" | "alert" | "water"
  zoneId: string
  timestamp: string
}[] = globalMemory.activityLog || readDB().activityLog || []
if (!globalMemory.activityLog) globalMemory.activityLog = activityLog

export function recordActivity(entry: {
  type: "spray" | "alert" | "water"
  zoneId: string
  timestamp?: string
}) {
  const item = {
    type: entry.type,
    zoneId: entry.zoneId,
    timestamp: entry.timestamp || new Date().toISOString(),
  }

  activityLog.unshift(item)
  if (activityLog.length > 200) activityLog.pop()

  const db = readDB()
  db.activityLog.unshift(item)
  writeDB(db)
  globalMemory.activityLog = activityLog
}

export const pendingCommands: Record<string, ("spray" | "water" | "stop")[]> = globalMemory.pendingCommands || {}
if (!globalMemory.pendingCommands) globalMemory.pendingCommands = pendingCommands

export type GlobalHydrateRequest = {
  requestedAt: string
  targetedZones: string[]
  pumpControllerZone: string | null
}

export let globalHydrateRequest: GlobalHydrateRequest | null = globalMemory.globalHydrateRequest || null
if (!globalMemory.globalHydrateRequest) globalMemory.globalHydrateRequest = globalHydrateRequest

export function setGlobalHydrateRequest(request: GlobalHydrateRequest | null) {
  globalHydrateRequest = request
  globalMemory.globalHydrateRequest = request
}

export function enqueueCommand(zoneId: string, command: "spray" | "water" | "stop") {
  if (!pendingCommands[zoneId]) pendingCommands[zoneId] = []
  const queue = pendingCommands[zoneId]
  const last = queue[queue.length - 1]
  if (last !== command) {
    queue.push(command)
  }
}

export function stopIrrigationCycle(zoneId: string, reason: string) {
  const idx = zones.findIndex(z => z.id === zoneId)
  if (idx < 0) return

  const current = zones[idx]
  const cycle = current.cycle || createDefaultCycleRuntime()
  const next: IrrigationCycleRuntime = {
    ...cycle,
    active: false,
    state: reason === "sensor_error" ? "error" : "done",
    pumpOn: false,
    targetByGlobalHydrate: false,
    lastReason: reason,
    phaseStartedAt: Date.now(),
  }

  zones[idx] = deriveZoneRuntime({
    ...current,
    cycle: next,
    pumpStatus: "off",
  })

  enqueueCommand(zoneId, "stop")
}

export function startIrrigationCycle(zoneId: string, targetByGlobalHydrate = false) {
  const idx = zones.findIndex(z => z.id === zoneId)
  if (idx < 0) return { started: false, reason: "zone_not_found" }

  const zone = deriveZoneRuntime(zones[idx])
  if (irrigationSettings.ripeningMode) return { started: false, reason: "ripening_mode" }
  if (zone.sensor?.hasError) return { started: false, reason: "sensor_error" }
  if ((zone.gridColor || "green") === "green") return { started: false, reason: "grid_green" }

  const now = Date.now()
  const nextCycle: IrrigationCycleRuntime = {
    ...(zone.cycle || createDefaultCycleRuntime()),
    active: true,
    state: "running",
    cycleStartedAt: zone.cycle?.cycleStartedAt || now,
    phaseStartedAt: now,
    totalElapsedMs: zone.cycle?.totalElapsedMs || 0,
    pumpOn: true,
    targetByGlobalHydrate,
    lastReason: "started",
  }

  zones[idx] = deriveZoneRuntime({
    ...zone,
    cycle: nextCycle,
    pumpStatus: "on",
  })

  enqueueCommand(zoneId, "water")
  return { started: true, reason: "ok" }
}

export function tickIrrigationCycle(zoneId: string) {
  const idx = zones.findIndex(z => z.id === zoneId)
  if (idx < 0) return

  const now = Date.now()
  const zone = deriveZoneRuntime(zones[idx])
  const cycle = zone.cycle || createDefaultCycleRuntime()

  if (!cycle.active) {
    zones[idx] = zone
    return
  }

  if (irrigationSettings.ripeningMode || zone.sensor?.hasError) {
    stopIrrigationCycle(zoneId, irrigationSettings.ripeningMode ? "ripening_mode" : "sensor_error")
    return
  }

  if (zone.soilMoisture >= irrigationSettings.wetThreshold) {
    stopIrrigationCycle(zoneId, "wet_threshold_reached")
    return
  }

  const cycleStart = cycle.cycleStartedAt || now
  const phaseStart = cycle.phaseStartedAt || now
  const totalElapsedMs = now - cycleStart

  if (totalElapsedMs >= irrigationSettings.maxDurationMs) {
    stopIrrigationCycle(zoneId, "max_duration_reached")
    return
  }

  const phaseElapsed = now - phaseStart

  if (cycle.pumpOn) {
    if (phaseElapsed >= irrigationSettings.cycleOnMs) {
      zones[idx] = deriveZoneRuntime({
        ...zone,
        cycle: {
          ...cycle,
          state: "cooldown",
          pumpOn: false,
          phaseStartedAt: now,
          totalElapsedMs,
          lastReason: "phase_off",
        },
        pumpStatus: "off",
      })
      enqueueCommand(zoneId, "stop")
      return
    }
  } else if (phaseElapsed >= irrigationSettings.cycleOffMs) {
    zones[idx] = deriveZoneRuntime({
      ...zone,
      cycle: {
        ...cycle,
        state: "running",
        pumpOn: true,
        phaseStartedAt: now,
        totalElapsedMs,
        lastReason: "phase_on",
      },
      pumpStatus: "on",
    })
    enqueueCommand(zoneId, "water")
    return
  }

  zones[idx] = deriveZoneRuntime({
    ...zone,
    cycle: {
      ...cycle,
      totalElapsedMs,
    },
  })
}

export function markSensorError(zoneId: string, message: string) {
  const idx = zones.findIndex(z => z.id === zoneId)
  if (idx < 0) return

  zones[idx] = deriveZoneRuntime({
    ...zones[idx],
    sensor: {
      ...(zones[idx].sensor || createDefaultSensorRuntime()),
      hasError: true,
      errorMessage: message,
    },
  })

  stopIrrigationCycle(zoneId, "sensor_error")
}

export function updateSensorRuntime(zoneId: string, moisture: number) {
  const idx = zones.findIndex(z => z.id === zoneId)
  if (idx < 0) return

  const zone = zones[idx]
  const now = Date.now()
  const sensor = zone.sensor || createDefaultSensorRuntime()
  const lastValue = sensor.lastValue

  let unchangedSince = sensor.unchangedSince
  if (lastValue === null || Math.abs(lastValue - moisture) > irrigationSettings.minChangePercent) {
    unchangedSince = now
  } else if (!unchangedSince) {
    unchangedSince = now
  }

  let hasError = false
  let errorMessage: string | null = null

  if (unchangedSince && now - unchangedSince >= irrigationSettings.unchangedSensorMs) {
    hasError = true
    errorMessage = "Sensor Error"
  }

  zones[idx] = deriveZoneRuntime({
    ...zone,
    sensor: {
      hasError,
      errorMessage,
      lastValidAt: now,
      lastValue: moisture,
      unchangedSince,
    },
  })

  if (hasError) {
    stopIrrigationCycle(zoneId, "sensor_error")
  }
}

function deriveZoneRuntime(zone: ZoneData): ZoneData {
  const spray = getSprayWindowStatus(zone.temperature, zone.humidity)
  const gridColor = getGridColorByMoisture(zone.soilMoisture, irrigationSettings)
  const hydrateEligible =
    !irrigationSettings.ripeningMode &&
    !zone.sensor?.hasError &&
    gridColor !== "green"

  return {
    ...zone,
    gridColor,
    dryThreshold: irrigationSettings.dryThreshold,
    wetThreshold: irrigationSettings.wetThreshold,
    hydrateEligible,
    cycle: zone.cycle || createDefaultCycleRuntime(),
    sensor: zone.sensor || createDefaultSensorRuntime(),
    vpd: spray.vpd,
    vpdBand: spray.band,
    sprayEnabled: spray.sprayEnabled,
    sprayMessage: spray.message,
    pumpStatus: zone.cycle?.pumpOn ? "on" : "off",
  }
}

zones = zones.map(z => deriveZoneRuntime(z))

export function getHydrationCandidates() {
  const hydrated = zones.map(zone => deriveZoneRuntime(zone))
  zones = hydrated
  globalMemory.zones = zones

  const targeted = hydrated.filter(zone => zone.hydrateEligible && (zone.gridColor === "red" || zone.gridColor === "yellow"))
  const ignored = hydrated.filter(zone => zone.gridColor === "green").map(zone => zone.id)

  return {
    targeted,
    ignored,
    disabled: irrigationSettings.ripeningMode || targeted.length === 0,
    reason: irrigationSettings.ripeningMode ? "Ripening mode is active" : targeted.length === 0 ? "All grids are green" : null,
  }
}

export function updateLiveZones() {
  const liveIds = zones.slice(0, Math.min(4, zones.length)).map(zone => zone.id)

  for (const zone of zones) {
    if (!liveIds.includes(zone.id)) continue

    if (zone.status === "healthy") {
      zone.status = "warning"
      zone.soilMoisture = 35
      zone.humidity = 82
      zone.healthScore = 65
    } else if (zone.status === "warning") {
      zone.status = "critical"
      zone.soilMoisture = 20
      zone.humidity = 92
      zone.healthScore = 45
    } else {
      zone.status = "healthy"
      zone.soilMoisture = 70
      zone.humidity = 65
      zone.healthScore = 90
    }
  }

  zones = zones.map(zone => deriveZoneRuntime(zone))
  globalMemory.zones = zones
}

export function updateFarmProfile(acres: number, zoneSizeAcres = 0.25) {
  farmProfile = buildFarmProfile(acres, zoneSizeAcres)
  globalMemory.farmProfile = farmProfile

  const nextZones = generateZones(farmProfile, irrigationSettings)
  const existingMap = new Map(zones.map(zone => [zone.id, zone]))

  zones = nextZones.map(zone => {
    const existing = existingMap.get(zone.id)
    return existing ? deriveZoneRuntime({ ...zone, ...existing, row: zone.row, col: zone.col }) : deriveZoneRuntime(zone)
  })

  globalMemory.zones = zones
  zoneHistory = generateZoneHistory(zones)
  globalMemory.zoneHistory = zoneHistory

  const validZoneIds = new Set(zones.map(zone => zone.id))
  for (const zoneId of Object.keys(pendingCommands)) {
    if (!validZoneIds.has(zoneId)) {
      delete pendingCommands[zoneId]
    }
  }

  return farmProfile
}
