import { createHash } from "node:crypto"

// The website rotates one Supabase refresh family: the cookie session behind
// POST /api/auth/refresh. Two browser tabs can present that same token, and
// the loser is rejected. A desktop that stored that same token was signed out
// by the tab that won.
//
// This exchange never reads cookies. A presented refresh token is rotated on
// its own. An empty refresh token, with a bearer, asks the provider to open
// a new session. That call does not revoke a refresh token the desktop
// already stored, and the response never says to erase one.

const ALREADY_USED = "Invalid Refresh Token: Already Used"
const USED_LIMIT = 200

export type DesktopAccount = { id: string; email: string | null }

export type DesktopCredential = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  familyId: string
}

export type DesktopAuthFailure = { message?: string; code?: string }

export type DesktopAuthPort = {
  userFromAccessToken(accessToken: string): Promise<DesktopAccount | null>
  refreshPresented(refreshToken: string): Promise<{ session: DesktopCredential | null; error: DesktopAuthFailure | null }>
  mintIndependentSession(user: DesktopAccount): Promise<{ session: DesktopCredential | null; error: DesktopAuthFailure | null }>
}

export type DesktopSessionSuccess = {
  ok: true
  access_token: string
  refresh_token: string
  expires_at: number
  session: "desktop"
}

export type DesktopSessionFailure = {
  ok: false
  error: string
  error_description: string
}

export type DesktopSessionResult = {
  status: number
  body: DesktopSessionSuccess | DesktopSessionFailure
}

export type DesktopSessionMemory = {
  used: Set<string>
  inflight: Map<string, Promise<DesktopSessionResult>>
}

const sharedMemory: DesktopSessionMemory = { used: new Set(), inflight: new Map() }
let portOverride: DesktopAuthPort | null = null

export function createDesktopSessionMemory(): DesktopSessionMemory {
  return { used: new Set(), inflight: new Map() }
}

export function resetDesktopSessionMemory() {
  sharedMemory.used.clear()
  sharedMemory.inflight.clear()
  portOverride = null
}

export function useDesktopAuthPort(port: DesktopAuthPort | null) {
  portOverride = port
}

export function desktopAuthPort(fallback: () => DesktopAuthPort): DesktopAuthPort {
  return portOverride ?? fallback()
}

export function classifyRefreshFailure(error: DesktopAuthFailure | null): { error: "already_used" | "revoked" | "invalid_grant"; error_description: string } {
  const message = (error?.message || "").trim()
  const code = (error?.code || "").trim()
  const haystack = `${code} ${message}`.toLowerCase()
  if (haystack.includes("already used") || haystack.includes("already_used") || code === "refresh_token_already_used") {
    return { error: "already_used", error_description: ALREADY_USED }
  }
  if (haystack.includes("revok")) {
    return { error: "revoked", error_description: message || "Refresh token revoked" }
  }
  return { error: "invalid_grant", error_description: message || "invalid_grant" }
}

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function remember(memory: DesktopSessionMemory, token: string) {
  const key = digest(token)
  if (memory.used.has(key)) return
  memory.used.add(key)
  if (memory.used.size <= USED_LIMIT) return
  const oldest = memory.used.values().next().value
  if (oldest) memory.used.delete(oldest)
}

function failure(status: number, error: string, error_description: string): DesktopSessionResult {
  return { status, body: { ok: false, error, error_description } }
}

function success(session: DesktopCredential): DesktopSessionResult {
  if (!session.accessToken || !session.refreshToken || !Number.isFinite(session.expiresAt)) {
    return failure(401, "invalid_grant", "Desktop session did not include a usable token pair.")
  }
  return {
    status: 200,
    body: {
      ok: true,
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      expires_at: session.expiresAt,
      session: "desktop",
    },
  }
}

function unavailable(message?: string): DesktopSessionResult {
  return failure(503, "issuer_unavailable", message || "Desktop session issuer is not configured.")
}

async function rotateOnce(refreshToken: string, port: DesktopAuthPort, memory: DesktopSessionMemory): Promise<DesktopSessionResult> {
  const refreshed = await port.refreshPresented(refreshToken)
  if (refreshed.session) {
    const result = success(refreshed.session)
    if (result.status === 200) remember(memory, refreshToken)
    return result
  }
  if (refreshed.error?.code === "issuer_unavailable") return unavailable(refreshed.error.message)
  const classified = classifyRefreshFailure(refreshed.error)
  if (classified.error === "already_used") remember(memory, refreshToken)
  return failure(401, classified.error, classified.error_description)
}

async function rotate(refreshToken: string, port: DesktopAuthPort, memory: DesktopSessionMemory): Promise<DesktopSessionResult> {
  const key = digest(refreshToken)
  // A second presentation in this process is the renewal that lost. Report
  // that without asking the provider again: a second provider refresh of an
  // already rotated token can revoke the successor as well as the loser.
  if (memory.used.has(key)) return failure(401, "already_used", ALREADY_USED)
  const existing = memory.inflight.get(key)
  if (existing) return existing
  const run = rotateOnce(refreshToken, port, memory)
  memory.inflight.set(key, run)
  try {
    return await run
  } finally {
    if (memory.inflight.get(key) === run) memory.inflight.delete(key)
  }
}

export async function readDesktopSessionRequest(request: {
  headers: { get(name: string): string | null }
  json(): Promise<unknown>
}): Promise<{ accessToken: string | null; refreshToken: string } | DesktopSessionResult> {
  const type = request.headers.get("content-type") || ""
  if (!type.toLowerCase().includes("application/json")) {
    return failure(415, "invalid_grant", "Content-Type must be application/json.")
  }
  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    return failure(400, "invalid_grant", "Request body must be JSON.")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return failure(400, "invalid_grant", "Request body must be a JSON object.")
  }
  const record = parsed as Record<string, unknown>
  if (record.refresh_token !== undefined && typeof record.refresh_token !== "string") {
    return failure(400, "invalid_grant", "refresh_token must be a string.")
  }
  const refreshToken = typeof record.refresh_token === "string" ? record.refresh_token : ""
  if (refreshToken.length > 4096) return failure(400, "invalid_grant", "refresh_token is too long.")
  const authorization = request.headers.get("authorization") || ""
  const accessToken = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1] ?? null
  if (accessToken && accessToken.length > 16384) return failure(400, "invalid_grant", "access token is too long.")
  return { accessToken, refreshToken }
}

export async function exchangeDesktopSession(
  input: { accessToken: string | null; refreshToken: string },
  port: DesktopAuthPort,
  memory: DesktopSessionMemory = sharedMemory,
): Promise<DesktopSessionResult> {
  const refreshToken = input.refreshToken.trim()
  if (refreshToken) return rotate(refreshToken, port, memory)

  // Empty refresh token: open a desktop family from the bearer. Do not rotate
  // or revoke some other refresh token the caller already kept.
  const accessToken = input.accessToken?.trim() || ""
  if (!accessToken) {
    return failure(401, "invalid_grant", "A desktop access token or refresh token is required.")
  }
  const user = await port.userFromAccessToken(accessToken)
  if (!user) return failure(401, "invalid_grant", "Invalid access token.")
  const minted = await port.mintIndependentSession(user)
  if (minted.session) return success(minted.session)
  if (minted.error?.code === "issuer_unavailable") return unavailable(minted.error.message)
  const classified = classifyRefreshFailure(minted.error)
  return failure(401, classified.error, classified.error_description)
}
