/**
 * Physical capabilities of the hackathon prototype.
 *
 * Keep these facts in one place so the map, recommendations, and actuator
 * screens never overstate what the board can physically do.
 */
export const DEMO_CONTROL_ZONE_IDS = ["A1", "A2", "A3", "A4"] as const

export const IRRIGATION_PULSE_MS = 3_000
export const SPRAY_PULSE_MS = 3_000

// Hard safety bound on the closed loop. Even if the moisture sensor is stuck or
// stale and never reports "target reached", the controller must stop after this
// many pulses (≈24 s total run) so a faulty sensor can never run the pump dry.
export const MAX_IRRIGATION_PULSES = 8
export const MAX_IRRIGATION_RUNTIME_MS = MAX_IRRIGATION_PULSES * IRRIGATION_PULSE_MS

// The reference flow model (flowModel.ts) gives a conservative litres ESTIMATE
// from a generic 0.5 HP pump spec. That is NOT the actual 12V rig pump. Until
// the real pump is measured (jug + stopwatch → mL per 3 s pulse), the only real
// delivery number is the PULSE COUNT the controller reports. Volume stays a
// clearly-labelled model estimate, never asserted as metered litres.
export const PUMP_CALIBRATED = false

export const DEMO_PUMP_PROFILE = {
  irrigation: {
    label: "Irrigation pump",
    pulseMs: IRRIGATION_PULSE_MS,
    purpose: "Guided water pulses for the A1–A4 pilot control area",
  },
  spray: {
    label: "Application pump",
    pulseMs: SPRAY_PULSE_MS,
    purpose: "Water-only actuator validation until a farmer-prepared tank is connected",
  },
} as const

export function isDemoControlZone(zoneId: string) {
  return (DEMO_CONTROL_ZONE_IDS as readonly string[]).includes(zoneId)
}

/**
 * The controller runs a CLOSED LOOP: it fires short 3-second pulses and keeps
 * going until the zone recovers to target, then stops on its own. The app never
 * pre-queues a stack of pulses — it sends one "water" command and the hardware
 * owns the loop. `pulses` here is an *estimate* of how many the loop will likely
 * need (a guide for the volume estimate), not a fixed queue.
 */
export function getIrrigationPulsePlan(soilMoisture: number, dryThreshold: number) {
  const deficit = Math.max(0, dryThreshold - soilMoisture)
  // Estimate is bounded by the same safety cap the controller enforces, so the
  // UI never promises more pulses than the loop is allowed to run.
  const estimatedPulses = deficit <= 0 ? 0 : Math.min(MAX_IRRIGATION_PULSES, Math.max(1, Math.ceil(deficit / 7)))

  return {
    pulses: estimatedPulses,
    maxPulses: MAX_IRRIGATION_PULSES,
    pulseMs: IRRIGATION_PULSE_MS,
    durationLabel: `${(IRRIGATION_PULSE_MS / 1000).toFixed(0)}-second water pulse`,
    rationale:
      estimatedPulses === 0
        ? "Soil moisture is within the configured dry threshold."
        : `${Math.round(deficit)} points below target — the pump loops short pulses (max ${MAX_IRRIGATION_PULSES}) until it recovers.`,
  }
}
