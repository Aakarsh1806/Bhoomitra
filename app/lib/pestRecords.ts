import { readDB, writeDB } from "@/app/lib/database"

export type PestPrediction = {
  label: string
  pestId: string
  confidence: number
}

export type PestRecord = {
  id: string
  zoneId: string
  crop: string
  pestId: string
  pestName: string
  scientificName: string
  confidence: number
  confidenceBand: "low" | "medium" | "high"
  cropMatch: "matched" | "review" | "not_applicable"
  predictions: PestPrediction[]
  imageName: string | null
  timestamp: string
  modelId: string | null
  modelVersion: string | null
  farmerConfirmed: boolean
  status: "new" | "monitoring" | "improving" | "increasing" | "resolved"
  followUpDue: string
  outcomeNote: string | null
  updatedAt: string
}

export type NewPestRecord = Omit<PestRecord, "id" | "timestamp" | "status" | "followUpDue" | "outcomeNote" | "updatedAt">

export function listPestRecords() {
  return [...(readDB().pestDetections || [])]
    .filter((record) => !record.sample)
    .sort((a, b) => Date.parse(String(b.timestamp || "")) - Date.parse(String(a.timestamp || ""))) as PestRecord[]
}

export function savePestRecord(input: NewPestRecord) {
  const now = new Date()
  const followUpDue = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const record: PestRecord = {
    ...input,
    id: crypto.randomUUID(),
    timestamp: now.toISOString(),
    status: "monitoring",
    followUpDue: followUpDue.toISOString(),
    outcomeNote: null,
    updatedAt: now.toISOString(),
  }

  const db = readDB()
  db.pestDetections.push(record)
  db.activityLog.unshift({
    type: "alert",
    zoneId: record.zoneId,
    timestamp: record.timestamp,
    source: "pest-classification",
    pestId: record.pestId,
  })
  writeDB(db)
  return record
}

export function updatePestRecord(
  id: string,
  status: PestRecord["status"],
  outcomeNote?: string | null,
  farmerConfirmed?: boolean,
) {
  const db = readDB()
  const record = db.pestDetections.find((entry: PestRecord) => entry.id === id) as PestRecord | undefined
  if (!record) return null

  record.status = status
  record.outcomeNote = outcomeNote?.trim() || null
  if (typeof farmerConfirmed === "boolean") {
    record.farmerConfirmed = farmerConfirmed
  }
  record.updatedAt = new Date().toISOString()
  writeDB(db)
  return record
}

export function confidenceBand(confidence: number): PestRecord["confidenceBand"] {
  if (confidence >= 0.8) return "high"
  if (confidence >= 0.6) return "medium"
  return "low"
}
