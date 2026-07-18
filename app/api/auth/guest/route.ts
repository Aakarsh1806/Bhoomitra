import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    // Guest session data
    const sessionData = {
      id: "guest_" + Math.random().toString(36).substr(2, 5),
      name: "Guest Explorer",
      email: "guest@bhoomitra.ai",
      role: "viewer",
      permissions: ["dashboard", "map", "analytics"],
      iat: Date.now(),
      isGuest: true
    }

    const token = Buffer.from(JSON.stringify(sessionData)).toString("base64")

    cookies().set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    })

    cookies().set("dashboard_unlocked", "0", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    })

    return NextResponse.json({ 
      success: true, 
      user: { 
        id: sessionData.id, 
        name: sessionData.name, 
        email: sessionData.email, 
        role: sessionData.role 
      } 
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
