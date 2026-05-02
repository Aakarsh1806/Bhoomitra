import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"
import { isPasswordHash, readUsers, sanitizeUser, writeUsers } from "@/app/lib/usersStore"

export async function GET() {
  const users = readUsers()
  // Strip passwords for security
  const safeUsers = users.map((u: any) => sanitizeUser(u))
  return NextResponse.json(safeUsers)
}

export async function POST(req: Request) {
  try {
    const newUser = await req.json()
    const users = readUsers()

    if (!newUser?.password || typeof newUser.password !== "string") {
      return NextResponse.json({ success: false, message: "Password is required" }, { status: 400 })
    }
    
    // Check if user already exists
    if (users.find((u: any) => String(u.email).toLowerCase() === String(newUser.email).toLowerCase())) {
      return NextResponse.json({ success: false, message: "User already exists" }, { status: 400 })
    }

    const userWithId = {
      ...newUser,
      password: isPasswordHash(newUser.password) ? newUser.password : hashSync(newUser.password, 10),
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString().split('T')[0],
      status: "active"
    }

    users.push(userWithId)
    writeUsers(users)

    const safeUser = sanitizeUser(userWithId)
    return NextResponse.json(safeUser)
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
    try {
      const updatedUser = await req.json()
      const users = readUsers()
      const index = users.findIndex((u: any) => u.id === updatedUser.id)
  
      if (index === -1) {
        return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
      }
  
      // Update user, preserve password if not provided
      const nextPassword = updatedUser.password
        ? (isPasswordHash(updatedUser.password) ? updatedUser.password : hashSync(updatedUser.password, 10))
        : users[index].password

      users[index] = { 
        ...users[index], 
        ...updatedUser,
        password: nextPassword,
      }
      
      writeUsers(users)
      const safeUser = sanitizeUser(users[index])
      return NextResponse.json(safeUser)
    } catch (error) {
      return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
      const { searchParams } = new URL(req.url)
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ success: false }, { status: 400 })

      let users = readUsers()
      users = users.filter((u: any) => u.id !== id)
      writeUsers(users)
      
      return NextResponse.json({ success: true })
    } catch (error) {
      return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
    }
}
