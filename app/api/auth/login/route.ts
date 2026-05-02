import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { compareSync, hashSync } from "bcryptjs"
import { isPasswordHash, readUsers, writeUsers } from "@/app/lib/usersStore"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    const users = readUsers()
    const userIndex = users.findIndex((u: any) => u.email === email)
    const user = userIndex >= 0 ? users[userIndex] : null

    if (!user || !user.password) {
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 })
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
