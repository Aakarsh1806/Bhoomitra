import { NextResponse } from "next/server"
import { readDB } from "@/app/lib/database"

export async function GET() {
  const db = readDB()

  const detections = (db.detections || []).map((d: any) => ({
    ...d,
    status: d.status || "detected",
    type: "alert",
    details: `Detected ${d.disease} with ${(d.confidence * 100).toFixed(1)}% confidence.`,
  }))

  const sprays = (db.sprays || []).map((s: any) => ({
    ...s,
    status: s.status || "completed",
    type: "spray",
    details: `Applied ${s.chemical} (${s.dosage}).`,
  }))

  const persistedActivity = db.activityLog || []

  const history = [...detections, ...sprays, ...persistedActivity].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return NextResponse.json({
    history,
    detections: db.detections || [],
    sprays: db.sprays || [],
    summary: {
      totalDetections: detections.length,
      active: detections.filter((d: any) => d.status === "active").length,
      treated: detections.filter((d: any) => d.status === "treated").length,
      resolved: detections.filter((d: any) => d.status === "resolved").length
    }
  })
}