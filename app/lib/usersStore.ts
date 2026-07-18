import fs from "fs"
import path from "path"

export type UserRecord = {
  id: string
  name: string
  email?: string
  password?: string
  role?: string
  status?: string
  lastLogin?: string
  phone?: string
  authMethod?: "password" | "phone" | "google"
  phoneVerified?: boolean
  location?: string
  permissions?: string[]
  createdAt?: string
  [key: string]: any
}

const primaryUsersPath = path.join(process.cwd(), "data/users.json")
const legacyUsersPath = path.join(process.cwd(), "app/data/users.json")

function ensurePrimaryDir() {
  const usersDir = path.dirname(primaryUsersPath)
  if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir, { recursive: true })
  }
}

function readUsersFile(filePath: string): UserRecord[] {
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, "utf-8")
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

export function readUsers(): UserRecord[] {
  try {
    const primary = readUsersFile(primaryUsersPath)
    if (primary.length > 0 || fs.existsSync(primaryUsersPath)) return primary

    const legacy = readUsersFile(legacyUsersPath)
    if (legacy.length > 0) {
      writeUsers(legacy)
    }
    return legacy
  } catch {
    return []
  }
}

export function writeUsers(users: UserRecord[]) {
  ensurePrimaryDir()
  fs.writeFileSync(primaryUsersPath, JSON.stringify(users, null, 2))
}

export function isPasswordHash(value?: string) {
  if (!value) return false
  return /^\$2[aby]\$\d{2}\$/.test(value)
}

export function sanitizeUser(user: UserRecord) {
  const { password, ...safeUser } = user
  return safeUser
}
