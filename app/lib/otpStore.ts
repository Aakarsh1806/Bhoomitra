// Demo-mode OTP store. No real SMS is sent — the OTP is returned directly
// to the caller so the UI can display it. This keeps phone signup working
// fully offline for the hackathon demo instead of depending on a paid SMS
// provider and live internet at pitch time. Swap generateOtp's response
// (stop returning otp to the client) for a real SMS integration later.

type OtpEntry = {
  otp: string
  name?: string
  expiresAt: number
  attempts: number
}

const globalMemory = global as any

const OTP_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

const otpStore: Map<string, OtpEntry> = globalMemory.otpStore || new Map()
if (!globalMemory.otpStore) globalMemory.otpStore = otpStore

export function normalizePhone(raw: string): string | null {
  const digits = String(raw || "").replace(/[^\d]/g, "")
  // Accept a 10-digit Indian mobile number, optionally prefixed with 91.
  const tenDigit = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits
  if (!/^[6-9]\d{9}$/.test(tenDigit)) return null
  return `+91${tenDigit}`
}

export function generateOtp(phone: string, name?: string) {
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  otpStore.set(phone, {
    otp,
    name,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  })
  return otp
}

export type VerifyResult =
  | { ok: true; name?: string }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "mismatch" }

export function verifyOtp(phone: string, code: string): VerifyResult {
  const entry = otpStore.get(phone)
  if (!entry) return { ok: false, reason: "not_found" }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone)
    return { ok: false, reason: "expired" }
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone)
    return { ok: false, reason: "too_many_attempts" }
  }

  if (entry.otp !== String(code).trim()) {
    entry.attempts += 1
    return { ok: false, reason: "mismatch" }
  }

  otpStore.delete(phone)
  return { ok: true, name: entry.name }
}
