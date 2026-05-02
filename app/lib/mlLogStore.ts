// app/lib/mlLogStore.ts

export interface DetectionLog {
  zone: string
  disease: string
  confidence: number
  severity: "Low" | "Moderate" | "High"
  timestamp: number
}

let detectionLogs: DetectionLog[] = []

export function addDetectionLog(log: DetectionLog) {
  detectionLogs.push(log)
}

export function getDetectionLogs() {
  return detectionLogs
}