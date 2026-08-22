import { NextResponse } from "next/server"
import {
  zones,
  zoneHistory,
  simulationEnabledRef,
  pendingCommands,
  markCommandDispatched,
  recordControllerFeedback,
  markSensorError,
  updateSensorRuntime,
  updateFarmClimate,
  getFarmClimate,
  irrigationSettings,
} from "../zones/data"
import { getForecast } from "@/app/lib/weatherService"
import { decideFarmActions } from "@/app/lib/farmDecisionService"
import { readDB } from "@/app/lib/database"

export async function POST(req: Request) {
  const body = await req.json()

  const { zoneId, soilMoisture, temperature, humidity, nozzleStatus, currentPath, feedbackMessage } = body

  // 🛰️ HARDWARE DIAGNOSTIC LOGGING
  console.log(`\x1b[36m[IOT -> SERVER]\x1b[0m 📶 Incoming data for ${zoneId}: Moisture ${soilMoisture}%, Temp ${temperature}°C`)

  // Disable simulation when real sensor sends data
  if (simulationEnabledRef.value !== false) {
    console.log(`\x1b[35m[SYSTEM]\x1b[0m 🟢 Live hardware detected! Disabling simulation mode automatically.`)
    simulationEnabledRef.value = false
  }

  const zoneIndex = zones.findIndex(z => z.id === zoneId)

  if (zoneIndex === -1) {
    return NextResponse.json({ message: "Zone not found" }, { status: 404 })
  }

  if (nozzleStatus === "idle" || nozzleStatus === "pending" || nozzleStatus === "open" || nozzleStatus === "closed" || nozzleStatus === "clogged") {
    recordControllerFeedback(
      zoneId,
      nozzleStatus,
      feedbackMessage,
      Array.isArray(currentPath) ? currentPath : [zoneId],
    )
  }

  const moistureNum = Number(soilMoisture)
  const tempNum = Number(temperature)
  const humidityNum = Number(humidity)

  const moistureValid = Number.isFinite(moistureNum) && moistureNum >= 0 && moistureNum <= 100
  const tempValid = Number.isFinite(tempNum) && tempNum >= -20 && tempNum <= 70
  const humidityValid = Number.isFinite(humidityNum) && humidityNum >= 0 && humidityNum <= 100

  if (!moistureValid || !tempValid || !humidityValid) {
    markSensorError(zoneId, "Sensor Error")
    return NextResponse.json(
      {
        message: "Sensor Error",
        command: "stop",
        targetZone: zoneId,
        remainingQueue: pendingCommands[zoneId]?.length || 0,
      },
      { status: 422 }
    )
  }

  const nextSoilMoisture = moistureNum
  const nextTemperature = tempNum
  const nextHumidity = humidityNum

  // DHT11 is fixed at one farm location. Its values update shared farm
  // climate/VPD, while the moisture reading remains scoped to this zone.
  const climate = updateFarmClimate(nextTemperature, nextHumidity)

  // Keep the displayed zone state aligned with both the soil probe and any
  // active disease record. A fresh moisture reading must not turn a zone with
  // a high-severity diagnosis into a misleading "healthy" tile.
  let moistureStatus: "healthy" | "warning" | "critical"

  if (nextSoilMoisture < 25) {
    moistureStatus = "critical"
  } else if (nextSoilMoisture < 40) {
    moistureStatus = "warning"
  } else {
    moistureStatus = "healthy"
  }

  const activeDetection = (readDB().detections || []).find((d: any) =>
    d.zoneId === zoneId &&
    d.status === "active" &&
    d.cropMatch !== "review" &&
    !String(d.diseaseName || d.disease || "").toLowerCase().includes("healthy"),
  )
  const diseaseStatus = activeDetection?.severityLevel === "high"
    ? "critical"
    : activeDetection?.severityLevel === "moderate" || activeDetection?.severityLevel === "medium"
      ? "warning"
      : "healthy"
  const statusRank = { healthy: 0, warning: 1, critical: 2 }
  const status = statusRank[diseaseStatus] > statusRank[moistureStatus] ? diseaseStatus : moistureStatus

  const healthScore = Math.max(
    40,
    Math.min(95, 100 - Math.abs(60 - nextSoilMoisture))
  )

  zones[zoneIndex] = {
    ...zones[zoneIndex],
    soilMoisture: nextSoilMoisture,
    status,
    healthScore,
  }

  updateSensorRuntime(zoneId, nextSoilMoisture)

  const weather = await getForecast()
  const farmDecision = decideFarmActions({
    soilMoisture: nextSoilMoisture,
    dryThreshold: irrigationSettings.dryThreshold,
    climate: getFarmClimate(),
    weather,
  })

  // A sensor update can recommend irrigation, but it must not start a pump by
  // itself. The farmer initiates a pulse plan from the map or recommendations
  // after seeing the weather-aware reason.

  // 📊 Update history
const historyEntry = zoneHistory.find(h => h.zoneId === zoneId)

if (historyEntry) {
  historyEntry.moistureHistory.push(nextSoilMoisture)
  historyEntry.temperatureHistory.push(climate.temperature ?? nextTemperature)

  if (historyEntry.moistureHistory.length > 20) {
    historyEntry.moistureHistory.shift()
  }

  if (historyEntry.temperatureHistory.length > 20) {
    historyEntry.temperatureHistory.shift()
  }
}


  const commandQueue = pendingCommands[zoneId] || []
  const command = commandQueue.length > 0 ? commandQueue.shift() : null

  if (command) {
    const now = new Date().toISOString()
    // Move this queued instruction into the controller's active state. A pump
    // action is logged only after the board reports that its pulse has closed.
    markCommandDispatched(zoneId, command)

    console.log(`\x1b[33m[SERVER -> IOT]\x1b[0m 🚀 DISPATCHING COMMAND: ${command.toUpperCase()} to ${zoneId} at ${now}`)
    
    // Activity history is written only when controller feedback confirms a
    // closed pulse, not when a command merely leaves the pending queue.
  }

  return NextResponse.json({ 
    message: "Zone updated successfully",
    command,
    targetZone: zoneId,
    remainingQueue: commandQueue.length,
    farmClimate: getFarmClimate(),
    decision: farmDecision,
  })
}
