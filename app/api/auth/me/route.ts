import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const token = cookies().get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
    }

    const sessionData = JSON.parse(Buffer.from(token, "base64").toString("utf-8"))
    
    // In a real app, you might want to fetch the latest data from users.json here
    return NextResponse.json({ 
        success: true, 
        user: { 
          id: sessionData.id, 
          name: sessionData.name, 
          email: sessionData.email, 
          role: sessionData.role,
          permissions: sessionData.permissions
        } 
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Invalid session" }, { status: 401 })
  }
}
