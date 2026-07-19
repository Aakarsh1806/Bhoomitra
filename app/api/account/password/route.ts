import { NextResponse } from "next/server"
import { compareSync, hashSync } from "bcryptjs"
import { isPasswordHash, readUsers, writeUsers } from "@/app/lib/usersStore"
import { getCurrentUser } from "@/app/lib/session"

/** Change the signed-in user's own password. */
export async function POST(req: Request) {
  const current = getCurrentUser()
  if (!current || current.blocked || current.session.isGuest || !current.user) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const { currentPassword, newPassword } = await req.json()

    if (!newPassword || String(newPassword).length < 6) {
      return NextResponse.json(
        { success: false, message: "New password must be at least 6 characters." },
        { status: 400 }
      )
    }

    const users = readUsers()
    const index = users.findIndex((u) => u.id === current.session.id)
    if (index === -1) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
    }

    const existing = users[index]

    // Phone-only accounts have no password to change.
    if (!existing.password) {
      return NextResponse.json(
        { success: false, message: "This account signs in by phone OTP and has no password." },
        { status: 400 }
      )
    }

    const matches = isPasswordHash(existing.password)
      ? compareSync(String(currentPassword || ""), existing.password)
      : existing.password === currentPassword

    if (!matches) {
      return NextResponse.json({ success: false, message: "Current password is incorrect." }, { status: 401 })
    }

    users[index] = { ...existing, password: hashSync(String(newPassword), 10) }
    writeUsers(users)

    return NextResponse.json({ success: true, message: "Password updated successfully." })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}
