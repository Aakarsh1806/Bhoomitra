import { NextResponse } from "next/server"
import {
  zones,
  updateLiveZones,
  simulationEnabledRef,
  irrigationSettings,
  globalHydrateRequest,
  getHydrationCandidates,
  getFarmClimate,
  getFarmClimatePresentation,
} from "@/app/api/zones/data"
import { getForecast } from "@/app/lib/weatherService"
import { decideFarmActions } from "@/app/lib/farmDecisionService"

// This endpoint reflects live soil probes and the shared DHT11 station, so it
// must never be prerendered or served as a build-time snapshot.
export const dynamic = "force-dynamic"

export async function GET() {
  if (simulationEnabledRef.value) {
    updateLiveZones()
  }

  const hydrateMeta = getHydrationCandidates()
  const weatherForecast = await getForecast()
  const farmClimate = getFarmClimate()
  const climatePresentation = getFarmClimatePresentation(farmClimate)

  const decisions = new Map(
    zones.map(zone => [
      zone.id,
      decideFarmActions({
        soilMoisture: zone.soilMoisture,
        dryThreshold: irrigationSettings.dryThreshold,
        climate: farmClimate,
        weather: weatherForecast,
      }),
    ]),
  )
  const actionableTargets = hydrateMeta.targeted.filter(zone => decisions.get(zone.id)?.irrigation.allowsStart)
  const deferredTargets = hydrateMeta.targeted.filter(zone => !decisions.get(zone.id)?.irrigation.allowsStart)
  const weatherContext = zones.length > 0 ? decisions.get(zones[0].id)?.weather : null
  const hydrateDisabled = irrigationSettings.ripeningMode || actionableTargets.length === 0
  const hydrateReason = irrigationSettings.ripeningMode
    ? "Ripening mode is active"
    : actionableTargets.length === 0
      ? deferredTargets[0]
        ? decisions.get(deferredTargets[0].id)?.irrigation.reason || "Weather conditions defer hydration."
        : "All grids are green"
      : null

  const payload = zones.map(zone => ({
    ...zone,
    cycleStatus: zone.cycle?.state || "idle",
    pumpStatus: zone.pumpStatus || "off",
    sensorError: zone.sensor?.hasError || false,
    sensorErrorMessage: zone.sensor?.errorMessage || null,
    decisions: decisions.get(zone.id),
  }))

  return NextResponse.json({
    zones: payload,
    farmClimate,
    climatePresentation,
    weather: weatherContext,
    irrigation: {
      dryThreshold: irrigationSettings.dryThreshold,
      wetThreshold: irrigationSettings.wetThreshold,
      ripeningMode: irrigationSettings.ripeningMode,
      hydrateDisabled,
      hydrateReason,
      targetedZoneIds: actionableTargets.map(zone => zone.id),
      deferredZoneIds: deferredTargets.map(zone => zone.id),
      ignoredZoneIds: hydrateMeta.ignored,
      globalHydrateRequest,
    },
  })
}
