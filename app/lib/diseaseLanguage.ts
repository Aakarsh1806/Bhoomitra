/**
 * Farmer-language interpreter. Turns a model reading into a plain verdict a
 * farmer can act on, with the technical confidence demoted to subtext.
 *
 * Rule (see feedback: farmer-language-first): lead with what it MEANS
 * ("Your field is infected with X"), never a bare "90% confidence". The
 * plain-language tier itself conveys certainty — infected vs. likely vs.
 * possible — so we never overstate a weak read as fact.
 */

export type DetectionTone = "infected" | "likely" | "possible" | "review" | "healthy"

/** Stable codes so the UI can localize; never build farmer-facing sentences here. */
export type VerdictCode =
  | "detectionRead.verdict.review"
  | "detectionRead.verdict.healthy"
  | "detectionRead.verdict.infected"
  | "detectionRead.verdict.likely"
  | "detectionRead.verdict.possible"

export type ConfidenceCode =
  | "detectionRead.confidence.review"
  | "detectionRead.confidence.strong"
  | "detectionRead.confidence.moderate"
  | "detectionRead.confidence.weak"

export type DetectionRead = {
  /** English sentence, kept for non-UI consumers and as the fallback. */
  verdict: string
  tone: DetectionTone
  /** Small muted line, e.g. "strong match · 88%". */
  confidenceLabel: string
  /** Translation key + params for the verdict line. */
  verdictCode: VerdictCode
  verdictParams: { crop: string; disease: string }
  /** Translation key + params for the confidence subtext. */
  confidenceCode: ConfidenceCode
  confidenceParams: { pct: number }
}

function humaniseDisease(raw?: string) {
  if (!raw) return "a disease"
  const afterCrop = raw.includes("___") ? raw.split("___")[1] : raw
  const cleaned = afterCrop.replace(/_/g, " ").replace(/s+/g, " ").trim()
  return cleaned || "a disease"
}

export function interpretDetection(params: {
  disease?: string
  crop?: string
  confidence?: number
  cropMatch?: string
  isHealthy?: boolean
}): DetectionRead {
  const pct = Math.round((params.confidence ?? 0) * 100)
  const disease = humaniseDisease(params.disease)
  const crop = (params.crop || "crop").toLowerCase()
  const base = { verdictParams: { crop, disease }, confidenceParams: { pct } }

  if (params.cropMatch === "review") {
    return {
      ...base,
      verdict: "Confirm the crop before trusting this",
      tone: "review",
      confidenceLabel: `crop doesn't match the model · ${pct}%`,
      verdictCode: "detectionRead.verdict.review",
      confidenceCode: "detectionRead.confidence.review",
    }
  }
  if (params.isHealthy) {
    return {
      ...base,
      verdict: `Your ${crop} looks healthy`,
      tone: "healthy",
      confidenceLabel: `strong match · ${pct}%`,
      verdictCode: "detectionRead.verdict.healthy",
      confidenceCode: "detectionRead.confidence.strong",
    }
  }
  if (pct >= 85) {
    return {
      ...base,
      verdict: `Your ${crop} is infected with ${disease}`,
      tone: "infected",
      confidenceLabel: `strong match · ${pct}%`,
      verdictCode: "detectionRead.verdict.infected",
      confidenceCode: "detectionRead.confidence.strong",
    }
  }
  if (pct >= 65) {
    return {
      ...base,
      verdict: `Likely ${disease} — worth confirming`,
      tone: "likely",
      confidenceLabel: `moderate match · ${pct}%`,
      verdictCode: "detectionRead.verdict.likely",
      confidenceCode: "detectionRead.confidence.moderate",
    }
  }
  return {
    ...base,
    verdict: `Possibly ${disease} — rescan a clear leaf`,
    tone: "possible",
    confidenceLabel: `weak match · ${pct}%`,
    verdictCode: "detectionRead.verdict.possible",
    confidenceCode: "detectionRead.confidence.weak",
  }
}

export const toneColor: Record<DetectionTone, { text: string; bg: string; ring: string }> = {
  infected: { text: "text-red-700", bg: "bg-red-50", ring: "border-red-200" },
  likely: { text: "text-amber-700", bg: "bg-amber-50", ring: "border-amber-200" },
  possible: { text: "text-slate-700", bg: "bg-slate-50", ring: "border-slate-200" },
  review: { text: "text-violet-700", bg: "bg-violet-50", ring: "border-violet-200" },
  healthy: { text: "text-emerald-700", bg: "bg-emerald-50", ring: "border-emerald-200" },
}
