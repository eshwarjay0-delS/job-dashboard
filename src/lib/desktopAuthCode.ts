import { createHash, randomBytes } from "node:crypto"
import {
  AUTH_EXPIRED,
  AUTH_NONCE,
  AUTH_UNAVAILABLE,
  AUTH_USED,
} from "./kompasAuthSession.ts"

const INVALID_CODE = "That sign-in code is not valid. Return to Kompas and try again."

// Website → desktop sign-in. The browser mints a 2-minute single-use code
// bound to the nonce the desktop put on the sign-in URL. The desktop sends
// that pair to the exchange route (deep link, or a poll while its sign-in
// window is open) and receives its own session. The code is not a refresh
// token and is not Chrome's refresh token.

export const CODE_TTL_MS = 120_000
export const CODE_RE = /^[A-Za-z0-9_-]{43}$/
export const NONCE_RE = /^[A-Za-z0-9_-]{20,128}$/
export const AUTH_CODE_KIND = "desktop-auth-code"

export type AuthCodeRecord = {
  code: string
  codeHash: string
  nonce: string
  userId: string
  email: string | null
  expiresAt: number
}

export type AuthCodeNote = { ok: boolean; message?: string }

export type AuthCodeStore = {
  put(record: AuthCodeRecord): Promise<"ok" | "unavailable">
  findByNonce(nonce: string): Promise<AuthCodeRecord | null | "unavailable">
  findByHash(codeHash: string): Promise<AuthCodeRecord | null | "unavailable">
  claim(codeHash: string, nonce: string, now: number): Promise<
    | { ok: true; record: AuthCodeRecord }
    | { ok: false; reason: "missing" | "expired" | "nonce_mismatch" | "used" | "unavailable" }
  >
  note(codeHash: string, note: AuthCodeNote, userId?: string): Promise<void>
  noteOf(codeHash: string): Promise<AuthCodeNote | null | "unavailable">
}

export function hashAuthCode(code: string) {
  return createHash("sha256").update(code).digest("hex")
}

export function createMemoryAuthCodeStore(): AuthCodeStore {
  const rows = new Map<string, AuthCodeRecord>()
  const notes = new Map<string, AuthCodeNote>()
  return {
    async put(record) {
      rows.set(record.codeHash, record)
      return "ok"
    },
    async findByNonce(nonce) {
      for (const row of rows.values()) if (row.nonce === nonce) return row
      return null
    },
    async findByHash(codeHash) {
      return rows.get(codeHash) ?? null
    },
    async claim(codeHash, nonce, now) {
      if (notes.has(codeHash)) return { ok: false, reason: "used" }
      const row = rows.get(codeHash)
      if (!row) return { ok: false, reason: "missing" }
      rows.delete(codeHash)
      if (row.expiresAt <= now) return { ok: false, reason: "expired" }
      if (row.nonce !== nonce) return { ok: false, reason: "nonce_mismatch" }
      return { ok: true, record: row }
    },
    async note(codeHash, note) {
      notes.set(codeHash, note)
    },
    async noteOf(codeHash) {
      return notes.get(codeHash) ?? null
    },
  }
}

export function mintDesktopAuthCode(input: { nonce: string; userId: string; email: string | null; now: number }):
  | { ok: true; code: string; record: AuthCodeRecord }
  | { ok: false; status: number; error: string; message: string } {
  if (!NONCE_RE.test(input.nonce)) {
    return { ok: false, status: 400, error: "invalid_nonce", message: AUTH_NONCE }
  }
  if (!input.userId) {
    return { ok: false, status: 401, error: "auth_required", message: "Sign in on the website, then return to Kompas." }
  }
  const code = randomBytes(32).toString("base64url")
  const record: AuthCodeRecord = {
    code,
    codeHash: hashAuthCode(code),
    nonce: input.nonce,
    userId: input.userId,
    email: input.email,
    expiresAt: input.now + CODE_TTL_MS,
  }
  return { ok: true, code, record }
}

export async function createDesktopAuthCode(
  store: AuthCodeStore,
  input: { nonce: string; userId: string; email: string | null; now?: number },
) {
  const now = input.now ?? Date.now()
  const minted = mintDesktopAuthCode({ ...input, now })
  if (!minted.ok) return { status: minted.status, body: { ok: false as const, error: minted.error, message: minted.message } }
  const saved = await store.put(minted.record)
  if (saved !== "ok") {
    return { status: 503, body: { ok: false as const, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE } }
  }
  return {
    status: 200,
    body: { ok: true as const, code: minted.code, expiresInSeconds: Math.floor(CODE_TTL_MS / 1000) },
  }
}

export async function pollDesktopAuthCode(store: AuthCodeStore, nonce: string, now = Date.now()) {
  if (!NONCE_RE.test(nonce)) {
    return { status: 400, body: { ok: false as const, error: "invalid_nonce", message: AUTH_NONCE, status: "error" as const } }
  }
  const row = await store.findByNonce(nonce)
  if (row === "unavailable") {
    return { status: 503, body: { ok: false as const, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE, status: "error" as const } }
  }
  if (!row) return { status: 200, body: { ok: true as const, status: "pending" as const } }
  if (row.expiresAt <= now) {
    return { status: 200, body: { ok: false as const, status: "expired" as const, message: AUTH_EXPIRED } }
  }
  return { status: 200, body: { ok: true as const, status: "ready" as const, code: row.code } }
}

export async function desktopAuthCodeStatus(store: AuthCodeStore, code: string, now = Date.now()) {
  if (!CODE_RE.test(code)) {
    return { status: 400, body: { ok: false as const, status: "error" as const, message: INVALID_CODE } }
  }
  const codeHash = hashAuthCode(code)
  const pending = await store.findByHash(codeHash)
  if (pending === "unavailable") {
    return { status: 503, body: { ok: false as const, status: "error" as const, message: AUTH_UNAVAILABLE } }
  }
  if (pending && pending.expiresAt > now) {
    return { status: 200, body: { ok: true as const, status: "waiting" as const, message: "Return to Kompas." } }
  }
  const note = await store.noteOf(codeHash)
  if (note === "unavailable") {
    return { status: 503, body: { ok: false as const, status: "error" as const, message: AUTH_UNAVAILABLE } }
  }
  if (note?.ok) return { status: 200, body: { ok: true as const, status: "claimed" as const, message: "Kompas has the sign-in. You can close this tab." } }
  if (note && note.ok === false) {
    return { status: 200, body: { ok: false as const, status: "error" as const, message: note.message || AUTH_UNAVAILABLE } }
  }
  if (pending) return { status: 200, body: { ok: false as const, status: "expired" as const, message: AUTH_EXPIRED } }
  return { status: 200, body: { ok: true as const, status: "waiting" as const, message: "Return to Kompas." } }
}

export type MintedDesktopSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  userId: string
}

export async function exchangeDesktopAuthCode(
  store: AuthCodeStore,
  input: { code: string; nonce: string; now?: number },
  mint: (record: AuthCodeRecord) => Promise<{ session: MintedDesktopSession | null; unavailable?: boolean; message?: string }>,
) {
  const now = input.now ?? Date.now()
  if (!CODE_RE.test(input.code) || !NONCE_RE.test(input.nonce)) {
    return { status: 400, body: { ok: false as const, error: "invalid_code", message: AUTH_NONCE } }
  }
  const codeHash = hashAuthCode(input.code)
  const claimed = await store.claim(codeHash, input.nonce, now)
  if (!claimed.ok) {
    if (claimed.reason === "unavailable") {
      return { status: 503, body: { ok: false as const, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE } }
    }
    if (claimed.reason === "nonce_mismatch") {
      return { status: 401, body: { ok: false as const, error: "nonce_mismatch", message: AUTH_NONCE } }
    }
    if (claimed.reason === "expired") {
      return { status: 410, body: { ok: false as const, error: "expired", message: AUTH_EXPIRED } }
    }
    const message = claimed.reason === "used" ? AUTH_USED : AUTH_EXPIRED
    return { status: 410, body: { ok: false as const, error: claimed.reason, message } }
  }
  let minted: { session: MintedDesktopSession | null; unavailable?: boolean; message?: string }
  try {
    minted = await mint(claimed.record)
  } catch {
    minted = { session: null, unavailable: true, message: AUTH_UNAVAILABLE }
  }
  if (!minted.session) {
    const message = minted.message || AUTH_UNAVAILABLE
    await store.note(codeHash, { ok: false, message }, claimed.record.userId)
    const status = minted.unavailable ? 503 : 401
    return {
      status,
      body: { ok: false as const, error: minted.unavailable ? "sign_in_unavailable" : "invalid_grant", message },
    }
  }
  await store.note(codeHash, { ok: true }, claimed.record.userId)
  return {
    status: 200,
    body: {
      ok: true as const,
      access_token: minted.session.accessToken,
      refresh_token: minted.session.refreshToken,
      expires_at: minted.session.expiresAt,
      session: "desktop" as const,
      user_id: minted.session.userId || claimed.record.userId,
    },
  }
}
