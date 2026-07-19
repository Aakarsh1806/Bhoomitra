import { cookies } from "next/headers"
import { readUsers, type UserRecord } from "@/app/lib/usersStore"

export type Session = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  role?: string
  permissions?: string[]
  isGuest?: boolean
  iat?: number
}

// Statuses that mean "this account may not access the app".
const BLOCKED_STATUSES = new Set(["blocked", "inactive", "suspended"])

export function isBlockedStatus(status?: string) {
  return BLOCKED_STATUSES.has(String(status || "").toLowerCase())
}

/** Decode the (unsigned, demo-grade) base64 session token from the cookie. */
export function getSession(): Session | null {
  try {
    const token = cookies().get("auth_token")?.value
    if (!token) return null
    const parsed = JSON.parse(Buffer.from(token, "base64").toString("utf-8"))
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null
    return parsed as Session
  } catch {
    return null
  }
}

/**
 * Resolve the live user record behind the current session. Re-reads the users
 * file so that role/status changes (e.g. an admin blocking someone) take effect
 * on the next request, not just at next login. Guests have no stored record.
 */
export function getCurrentUser(): { session: Session; user: UserRecord | null; blocked: boolean } | null {
  const session = getSession()
  if (!session) return null
  if (session.isGuest) return { session, user: null, blocked: false }

  const user = readUsers().find((u) => u.id === session.id) || null
  // If the account was deleted, treat it as blocked (session no longer valid).
  const blocked = !user || isBlockedStatus(user.status)
  return { session, user, blocked }
}

export function isAdmin(session: Session | null | undefined) {
  return session?.role === "admin"
}
