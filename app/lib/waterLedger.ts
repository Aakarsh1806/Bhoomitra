import { estimatePulseLitres, FLOW_CALIBRATED, FLOW_SOURCE_LABEL, PULSE_SECONDS } from "@/app/lib/flowModel"

/**
 * A single farmId-stamped entry in the unified water-volume ledger (db.waterLog).
 * Every pump command — spray or irrigation — writes one of these, so all litre
 * analytics read from one honest stream. Volume is ESTIMATED from the flow model
 * (see flowModel.ts), never metered, and carries its own source label.
 *
 * `status` is honest about the command lifecycle: "queued" is an intended pulse,
 * "completed" is one the controller confirmed closed. Analytics can sum whichever
 * it needs and must not present queued volume as delivered.
 */
export type WaterLogEntry = {
  id: string
  farmId: string
  zoneId: string
  kind: "spray" | "irrigation"
  mode: string
  pulses: number
  pulseSeconds: number
  estimatedLitres: number | null
  volumeSource: string
  status: "queued" | "completed"
  timestamp: string
}

export function buildWaterLogEntry(params: {
  farmId: string
  zoneId: string
  kind: "spray" | "irrigation"
  mode: string
  pulses?: number
  status?: "queued" | "completed"
  timestamp?: string
}): WaterLogEntry {
  const pulses = Math.max(1, Math.round(params.pulses ?? 1))
  return {
    id: crypto.randomUUID(),
    farmId: params.farmId,
    zoneId: params.zoneId,
    kind: params.kind,
    mode: params.mode,
    pulses,
    pulseSeconds: PULSE_SECONDS,
    estimatedLitres: estimatePulseLitres(pulses),
    volumeSource: FLOW_SOURCE_LABEL,
    status: params.status ?? "queued",
    timestamp: params.timestamp ?? new Date().toISOString(),
  }
}

export type WaterSummary = {
  farmId: string | null
  totalLitres: number
  sprayLitres: number
  irrigationLitres: number
  commandCount: number
  byZone: Record<string, number>
  byStatus: { queued: number; completed: number }
  calibrated: boolean
  volumeSource: string
}

/**
 * Season-to-date aggregation of the water ledger, farmId-scoped. Sums only the
 * real estimated litres already logged — never invents delivery. Callers should
 * present `byStatus.completed` when they need controller-confirmed volume and
 * be explicit that `queued` volume is intended, not yet delivered.
 */
export function summarizeWater(entries: WaterLogEntry[], farmId?: string): WaterSummary {
  const scoped = farmId ? entries.filter((entry) => entry.farmId === farmId) : entries
  let totalLitres = 0
  let sprayLitres = 0
  let irrigationLitres = 0
  const byZone: Record<string, number> = {}
  const byStatus = { queued: 0, completed: 0 }

  for (const entry of scoped) {
    const litres = typeof entry.estimatedLitres === "number" ? entry.estimatedLitres : 0
    totalLitres += litres
    if (entry.kind === "spray") sprayLitres += litres
    else irrigationLitres += litres
    byZone[entry.zoneId] = (byZone[entry.zoneId] || 0) + litres
    if (entry.status === "completed") byStatus.completed += litres
    else byStatus.queued += litres
  }

  return {
    farmId: farmId ?? null,
    totalLitres,
    sprayLitres,
    irrigationLitres,
    commandCount: scoped.length,
    byZone,
    byStatus,
    calibrated: FLOW_CALIBRATED,
    volumeSource: FLOW_SOURCE_LABEL,
  }
}
