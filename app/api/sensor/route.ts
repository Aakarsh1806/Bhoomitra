import { NextResponse } from "next/server"
import {
  zones,
  zoneHistory,
  simulationEnabledRef,
  pendingCommands,
  updateHardwareState,
  recordActivity,
  markSensorError,
  updateSensorRuntime,
  startIrrigationCycle,
  tickIrrigationCycle,
  irrigationSettings,
} from "../zones/data"

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

  if (nozzleStatus) {
    updateHardwareState({
      nozzleStatus,
      awaitingFeedback: nozzleStatus === "pending",
      lastFeedback: feedbackMessage || (nozzleStatus === "open" ? "Nozzle opened successfully" : nozzleStatus === "clogged" ? "Nozzle clogged" : null),
      lastFeedbackAt: new Date().toISOString(),
      currentPath: Array.isArray(currentPath) ? currentPath : zoneId ? [zoneId] : [],
      activeZoneId: zoneId || null,
    })
  }

  const zoneIndex = zones.findIndex(z => z.id === zoneId)

  if (zoneIndex === -1) {
    return NextResponse.json({ message: "Zone not found" }, { status: 404 })
  }

  const currentZone = zones[zoneIndex]
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

  // Calculate status
  let status: "healthy" | "warning" | "critical"

  if (nextSoilMoisture < 25 || nextHumidity > 90) {
    status = "critical"
  } else if (nextSoilMoisture < 40 || nextHumidity > 80) {
    status = "warning"
  } else {
    status = "healthy"
  }

  const healthScore = Math.max(
    40,
    Math.min(95, 100 - Math.abs(60 - nextSoilMoisture))
  )

  zones[zoneIndex] = {
    ...zones[zoneIndex],
    soilMoisture: nextSoilMoisture,
    temperature: nextTemperature,
    humidity: nextHumidity,
    status,
    healthScore,
  }

  updateSensorRuntime(zoneId, nextSoilMoisture)

  if (nextSoilMoisture < irrigationSettings.dryThreshold) {
    startIrrigationCycle(zoneId)
  }

  tickIrrigationCycle(zoneId)

  // 📊 Update history
const historyEntry = zoneHistory.find(h => h.zoneId === zoneId)

if (historyEntry) {
  historyEntry.moistureHistory.push(nextSoilMoisture)
  historyEntry.temperatureHistory.push(nextTemperature)

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
    // ✅ SYNC WITH HARDWARE: Update the zone "lastSprayed" the moment it is DISPATCHED
    if (zones[zoneIndex]) {
      zones[zoneIndex].lastSprayed = now
    }

    console.log(`\x1b[33m[SERVER -> IOT]\x1b[0m 🚀 DISPATCHING COMMAND: ${command.toUpperCase()} to ${zoneId} at ${now}`)
    
    // Create activity log entry
    if (command !== "stop") {
      recordActivity({
        type: command === "water" ? "water" : "spray",
        zoneId,
        timestamp: now,
      })
    }
  }

  return NextResponse.json({ 
    message: "Zone updated successfully",
    command,
    targetZone: zoneId,
    remainingQueue: commandQueue.length
  })
}

