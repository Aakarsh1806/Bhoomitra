import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"
import { cookies } from "next/headers"
import { normalizePhone, verifyOtp } from "@/app/lib/otpStore"
import { readUsers, writeUsers } from "@/app/lib/usersStore"
import { isBlockedStatus } from "@/app/lib/session"

const REASON_MESSAGES: Record<string, string> = {
  not_found: "OTP expired or not requested. Please send a new one.",
  expired: "OTP expired. Please send a new one.",
  too_many_attempts: "Too many incorrect attempts. Please send a new OTP.",
  mismatch: "Incorrect OTP. Please try again.",
}

export async function POST(req: Request) {
  try {
    const { phone, otp, password } = await req.json()
    const normalized = normalizePhone(phone)

    if (!normalized || !String(otp || "").trim()) {
      return NextResponse.json({ success: false, message: "Phone and OTP are required" }, { status: 400 })
    }

    const result = verifyOtp(normalized, otp)

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: REASON_MESSAGES[result.reason] || "Verification failed" },
        { status: 401 }
      )
    }

    const users = readUsers()
    const userIndex = users.findIndex((u: any) => u.phone === normalized)
    const now = new Date().toISOString()

    if (userIndex < 0 && String(password || "").length < 6) {
      return NextResponse.json(
        { success: false, message: "A password with at least 6 characters is required to create an account" },
        { status: 400 }
      )
    }

    let user
    if (userIndex >= 0) {
      if (isBlockedStatus(users[userIndex].status)) {
        return NextResponse.json(
          { success: false, message: "This account has been blocked. Contact an administrator." },
          { status: 403 }
        )
      }
      const shouldSetPassword = !users[userIndex].password && String(password || "").length >= 6
      users[userIndex] = {
        ...users[userIndex],
        ...(shouldSetPassword ? { password: hashSync(password, 10), authMethod: "password" as const } : {}),
        lastLogin: now,
      }
      user = users[userIndex]
    } else {
      user = {
        id: "u_" + Math.random().toString(36).slice(2, 10),
        name: result.name || "Farmer",
        phone: normalized,
        role: "operator",
        status: "active",
        authMethod: "phone" as const,
        phoneVerified: true,
        password: hashSync(String(password), 10),
        permissions: ["dashboard", "map", "detection", "spraying", "analytics", "recommendations"],
        createdAt: now,
        lastLogin: now,
      }
      users.push(user)
    }

    writeUsers(users)

    const sessionData = {
      id: user.id,
      name: user.name,
      email: user.email || null,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions,
      iat: Date.now(),
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
      isNewUser: userIndex < 0,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
