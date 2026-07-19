import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { compareSync, hashSync } from "bcryptjs"
import { isPasswordHash, readUsers, writeUsers } from "@/app/lib/usersStore"
import { isBlockedStatus } from "@/app/lib/session"
import { normalizePhone } from "@/app/lib/otpStore"

export async function POST(req: Request) {
  try {
    const { email, phone, password } = await req.json()
    const users = readUsers()
    const normalizedPhone = phone ? normalizePhone(phone) : null
    const userIndex = users.findIndex((u: any) =>
      email ? u.email === email : normalizedPhone && u.phone === normalizedPhone
    )
    const user = userIndex >= 0 ? users[userIndex] : null

    if (!user || !user.password) {
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 })
    }

    if (isBlockedStatus(user.status)) {
      return NextResponse.json(
        { success: false, message: "This account has been blocked. Contact an administrator." },
        { status: 403 }
      )
    }

    let isValidPassword = false

    if (isPasswordHash(user.password)) {
      isValidPassword = compareSync(password, user.password)
    } else {
      isValidPassword = user.password === password
      if (isValidPassword) {
        users[userIndex] = {
          ...user,
          password: hashSync(password, 10),
        }
      }
    }

    if (isValidPassword) {
      users[userIndex] = {
        ...users[userIndex],
        lastLogin: new Date().toISOString(),
      }
      writeUsers(users)

      // Create a simplified session token (in a real app, use JWT)
      const sessionData = {
        id: users[userIndex].id,
        name: users[userIndex].name,
        email: users[userIndex].email,
        phone: users[userIndex].phone,
        role: users[userIndex].role,
        permissions: users[userIndex].permissions,
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
        user: { 
          id: users[userIndex].id,
          name: users[userIndex].name,
          email: users[userIndex].email,
          role: users[userIndex].role,
        } 
      })
    }

    return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
