import { getSession } from "@/app/lib/session"

/**
 * Farm-scoping seam for the multi-tenant future (Layer 2).
 *
 * Every persisted number — spray/irrigation volumes, costs, saved water — is
 * stamped with a farmId from day one so that when real per-farm isolation
 * lands, none of the analytics needs re-plumbing. Today the app is effectively
 * single-farm, so this resolves to the current session's id (the eventual farm
 * owner, including guest ids) and falls back to a stable default off-request.
 */
export const DEFAULT_FARM_ID = "default-farm"

export function getCurrentFarmId(): string {
  try {
    const session = getSession()
    return session?.id || DEFAULT_FARM_ID
  } catch {
    // getSession reads request cookies; outside a request context it throws.
    return DEFAULT_FARM_ID
  }
}
