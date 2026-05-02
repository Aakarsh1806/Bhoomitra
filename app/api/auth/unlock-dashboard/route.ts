import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  const token = cookies().get("auth_token")?.value

  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  cookies().set("dashboard_unlocked", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  })

  return NextResponse.json({ success: true })
}
