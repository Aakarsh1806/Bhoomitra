import { NextResponse } from "next/server"
import { readDB } from "@/app/lib/database"

export async function GET() {
  const db = readDB()
  return NextResponse.json(db.activityLog || [])
}