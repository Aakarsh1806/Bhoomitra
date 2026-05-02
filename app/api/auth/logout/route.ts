import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  cookies().delete("auth_token")
  cookies().delete("dashboard_unlocked")
  return NextResponse.json({ success: true, message: "Logged out" })
}
