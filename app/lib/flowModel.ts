/**
 * Estimated water-volume model for the prototype pump — Foundation A of the
 * real-numbers rebuild. Every "litres" figure in the app derives from here.
 *
 * There is no flow meter yet, so delivered volume is ESTIMATED from a base
 * pump's rated flow × the real run time. We deliberately anchor to a
 * conservative (worst-case) base pump: real delivery is then AT LEAST this, so
 * we under-claim, never over-claim. Numbers derived from this must be labelled
 * "estimated (conservative)", never "measured".
 *
 * Two clean upgrades later, with NO downstream changes:
 *   1. Add a YF-S201 flow sensor → replace the estimate with a metered reading.
 *   2. Empirically calibrate mL/pulse (jug + stopwatch) → set the constant below.
 *
 * Until BASE_PUMP_FLOW_LPM is set to a real, sourced spec, every helper returns
 * null and the UI must show "calibration pending" — we never render an
 * unverified number.
 */

// Conservative anchor: a standard entry-level 0.5 HP monoblock — the smallest
// pump in common Indian farm use. Rated ~100 L/min at zero head, it delivers
// ~30–40 L/min under realistic field head; we take the low end (30) so real
// output is at least this and we never over-claim. Override by naming a
// specific pump and using its published spec.
// Source: indiamart 0.5 HP monoblock (100 Lpm max), rpswaterpumps 0.5 vs 1 HP guide.
export const BASE_PUMP_FLOW_LPM = 30
export const BASE_PUMP_LABEL = "standard 0.5 HP monoblock (conservative operating flow)"

/**
 * Standard spray water volume (litres per acre), by crop — the knob that scales
 * all per-acre litres. These are STANDARD HIGH-VOLUME DILUTE estimates grouped
 * by canopy type, adjustable to local practice — not individually metered
 * figures. They are deliberately representative operating points, sourced to
 * extension spray guidance (dense tree/vine canopies need more water to cover;
 * low field crops need less). Anchored on the grape reference (~100–300 US
 * gal/acre by season); other crops scaled by canopy density. Tune per crop as
 * real local rates are confirmed.
 *
 * Covers the 14 crops the current model diagnoses. Paddy/cotton/chilli etc. are
 * a separate model track and intentionally absent here.
 */
export const APPLICATION_RATE_LITRES_PER_ACRE: Record<string, number> = {
  // Orchard / vine — dense canopy, high water volume
  grape: 380,
  apple: 500,
  cherry: 500,
  peach: 500,
  orange: 500,
  citrus: 500,
  // Row / staked crops — medium volume
  tomato: 250,
  potato: 250,
  pepper: 250,
  "bell pepper": 250,
  squash: 220,
  // Field / bush / low crops — lower volume
  corn: 200,
  maize: 200,
  soybean: 200,
  strawberry: 220,
  blueberry: 250,
  raspberry: 250,
  default: 300,
}

export function applicationRateFor(crop?: string): number {
  const key = String(crop || "").toLowerCase().trim()
  return APPLICATION_RATE_LITRES_PER_ACRE[key] ?? APPLICATION_RATE_LITRES_PER_ACRE.default
}

/** One physical actuator pulse length, seconds. Matches the hardware demo. */
export const PULSE_SECONDS = 3

export const FLOW_CALIBRATED = BASE_PUMP_FLOW_LPM > 0

/** Estimated litres for N pulses of the standard pulse length. null until calibrated. */
export function estimatePulseLitres(pulses = 1, pulseSeconds = PULSE_SECONDS): number | null {
  if (!FLOW_CALIBRATED) return null
  return BASE_PUMP_FLOW_LPM * ((pulses * pulseSeconds) / 60)
}

/** Estimated litres for an arbitrary run time in seconds. null until calibrated. */
export function estimateRunLitres(seconds: number): number | null {
  if (!FLOW_CALIBRATED) return null
  return BASE_PUMP_FLOW_LPM * (seconds / 60)
}

/** Target litres to apply a standard agronomic rate (L/acre) over an area. */
export function litresForArea(applicationRateLitresPerAcre: number, acres: number): number {
  return applicationRateLitresPerAcre * Math.max(0, acres)
}

/** Run time (seconds) the base pump needs to apply a rate over an area. null until calibrated. */
export function runSecondsForArea(applicationRateLitresPerAcre: number, acres: number): number | null {
  if (!FLOW_CALIBRATED) return null
  const litres = litresForArea(applicationRateLitresPerAcre, acres)
  return (litres / BASE_PUMP_FLOW_LPM) * 60
}

/** Honest source label to render next to any volume derived from this model. */
export const FLOW_SOURCE_LABEL = FLOW_CALIBRATED
  ? `Estimated (conservative) — from ${BASE_PUMP_LABEL} rated flow, not metered`
  : "Calibration pending — set the base-pump rated flow"
