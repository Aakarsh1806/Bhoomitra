import fs from "fs"
import path from "path"

const dbPath = path.join(process.cwd(), "app/data/db.json")
const archiveDir = path.join(process.cwd(), "app/data/archive")
const MAX_DETECTIONS = 5000
const MAX_SPRAYS = 5000
const MAX_ACTIVITY = 5000

type DBShape = {
  detections: any[]
  sprays: any[]
  zoneHistory: any[]
  activityLog: any[]
}

function ensureArchiveDir() {
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true })
  }
}

function normalizeDB(data: any): DBShape {
  return {
    detections: Array.isArray(data?.detections) ? data.detections : [],
    sprays: Array.isArray(data?.sprays) ? data.sprays : [],
    zoneHistory: Array.isArray(data?.zoneHistory) ? data.zoneHistory : [],
    activityLog: Array.isArray(data?.activityLog) ? data.activityLog : [],
  }
}

function archiveOverflow(key: "detections" | "sprays" | "activityLog", items: any[]) {
  if (items.length === 0) return
  ensureArchiveDir()
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  const filePath = path.join(archiveDir, `${key}-${ts}.json`)
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2))
}

function applyRetention(db: DBShape) {
  if (db.detections.length > MAX_DETECTIONS) {
    const overflow = db.detections.splice(0, db.detections.length - MAX_DETECTIONS)
    archiveOverflow("detections", overflow)
  }

  if (db.sprays.length > MAX_SPRAYS) {
    const overflow = db.sprays.splice(0, db.sprays.length - MAX_SPRAYS)
    archiveOverflow("sprays", overflow)
  }

  if (db.activityLog.length > MAX_ACTIVITY) {
    const overflow = db.activityLog.splice(0, db.activityLog.length - MAX_ACTIVITY)
    archiveOverflow("activityLog", overflow)
  }
}

export function readDB() {
  try {
    const raw = fs.readFileSync(dbPath, "utf-8")
    return normalizeDB(JSON.parse(raw))
  } catch (error) {
    const initialData: DBShape = {
      detections: [],
      sprays: [],
      zoneHistory: [],
      activityLog: [],
    }
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2))
    return initialData
  }
}

export function writeDB(data: any) {
  const normalized = normalizeDB(data)
  applyRetention(normalized)
  fs.writeFileSync(dbPath, JSON.stringify(normalized, null, 2))
}