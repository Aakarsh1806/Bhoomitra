import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCurrentUser } from "@/app/lib/session"

export async function GET() {
  try {
    const current = getCurrentUser()

    if (!current) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
    }

    // Account was blocked or deleted while the session was still active —
    // invalidate the cookies so the user is bounced back to login.
    if (current.blocked) {
      cookies().delete("auth_token")
      cookies().delete("dashboard_unlocked")
      return NextResponse.json(
        { success: false, message: "Your access has been revoked. Contact an administrator.", blocked: true },
        { status: 403 }
      )
    }

    const { session, user } = current

    return NextResponse.json({
      success: true,
      user: {
        id: session.id,
        name: user?.name ?? session.name,
        email: user?.email ?? session.email ?? null,
        phone: user?.phone ?? session.phone ?? null,
        location: user?.location ?? null,
        role: user?.role ?? session.role,
        permissions: user?.permissions ?? session.permissions ?? [],
        status: user?.status ?? "active",
        language: user?.language ?? null,
        authMethod: user?.authMethod ?? (session.email ? "email" : "phone"),
        createdAt: user?.createdAt ?? null,
        lastLogin: user?.lastLogin ?? null,
        isGuest: Boolean(session.isGuest),
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Invalid session" }, { status: 401 })
  }
}
