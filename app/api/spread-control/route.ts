import { NextResponse } from "next/server"
import { zones, getFarmClimate } from "@/app/api/zones/data"
import { readDB } from "@/app/lib/database"
import { getForecast } from "@/app/lib/weatherService"
import { buildSpreadPlan } from "@/app/lib/spreadEngine"

export const dynamic = "force-dynamic"

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.round(parsed)))
}

async function makePlan(options: { days?: unknown; budget?: unknown }) {
  const [weather, climate] = await Promise.all([getForecast(), Promise.resolve(getFarmClimate())])
  const db = readDB()

  return buildSpreadPlan({
    zones: zones.map((zone) => ({
      id: zone.id,
      row: zone.row,
      col: zone.col,
      soilMoisture: zone.soilMoisture,
      disease: zone.disease,
      severityLevel: zone.severityLevel,
      severityScore: zone.severityScore,
      mlConfidence: zone.mlConfidence,
    })),
    detections: db.detections || [],
    weather,
    climate: {
      fresh: climate.fresh,
      humidity: climate.humidity,
      temperature: climate.temperature,
      vpd: climate.vpd,
    },
    days: boundedInteger(options.days, 5, 1, 14),
    budget: boundedInteger(options.budget, 2, 1, 4),
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const plan = await makePlan({
    days: searchParams.get("days"),
    budget: searchParams.get("budget"),
  })
  return NextResponse.json(plan)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const plan = await makePlan({ days: body.days, budget: body.budget })
  return NextResponse.json(plan)
}
