import { NextResponse } from "next/server"
import { generateOtp, normalizePhone } from "@/app/lib/otpStore"
import { readUsers } from "@/app/lib/usersStore"

export async function POST(req: Request) {
  try {
    const { phone, name } = await req.json()
    const normalized = normalizePhone(phone)

    if (!normalized) {
      return NextResponse.json(
        { success: false, message: "Enter a valid 10-digit mobile number" },
        { status: 400 }
      )
    }

    const users = readUsers()
    const isNewUser = !users.some((u: any) => u.phone === normalized)

    if (isNewUser && !String(name || "").trim()) {
      return NextResponse.json(
        { success: false, message: "Enter your name to create an account" },
        { status: 400 }
      )
    }

    const otp = generateOtp(normalized, String(name || "").trim() || undefined)

    // Demo mode: the OTP is returned in the response instead of being sent
    // over SMS. Never do this in a production build with real users.
    return NextResponse.json({
      success: true,
      isNewUser,
      demoOtp: otp,
      message: isNewUser ? "OTP sent — verify to create your account" : "OTP sent",
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
