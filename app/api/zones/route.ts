import { NextResponse } from "next/server"
import {
  zones,
  updateLiveZones,
  simulationEnabledRef,
  irrigationSettings,
  globalHydrateRequest,
  getHydrationCandidates,
} from "@/app/api/zones/data"

export async function GET() {
  if (simulationEnabledRef.value) {
    updateLiveZones()
  }

  const hydrateMeta = getHydrationCandidates()

  const payload = zones.map(zone => ({
    ...zone,
    cycleStatus: zone.cycle?.state || "idle",
    pumpStatus: zone.pumpStatus || "off",
    sensorError: zone.sensor?.hasError || false,
    sensorErrorMessage: zone.sensor?.errorMessage || null,
  }))

  return NextResponse.json({
    zones: payload,
    irrigation: {
      dryThreshold: irrigationSettings.dryThreshold,
      wetThreshold: irrigationSettings.wetThreshold,
      ripeningMode: irrigationSettings.ripeningMode,
      hydrateDisabled: hydrateMeta.disabled,
      hydrateReason: hydrateMeta.reason,
      targetedZoneIds: hydrateMeta.targeted.map(zone => zone.id),
      ignoredZoneIds: hydrateMeta.ignored,
      globalHydrateRequest,
    },
  })
}
