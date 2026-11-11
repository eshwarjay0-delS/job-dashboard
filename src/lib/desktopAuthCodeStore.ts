import { createHash } from "node:crypto"
import type { AuthCodeNote, AuthCodeRecord, AuthCodeStore } from "@/lib/desktopAuthCode"
import { AUTH_CODE_KIND, hashAuthCode } from "@/lib/desktopAuthCode"
import { createServiceClient } from "@/lib/supabase/service"

// Pending codes live in the existing service-role handoff table. The raw code
// stays only until it is claimed or it expires (two minutes). A claimed or
// failed exchange writes a second row so the website can tell the truth.

function claimedHash(codeHash: string) {
  return createHash("sha256").update("claimed:" + codeHash).digest("hex")
}

function rowToRecord(row: { ticket_hash: string; user_id: string; payload: unknown; expires_at: string }): AuthCodeRecord | null {
  const payload = row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : null
  if (!payload || payload.kind !== AUTH_CODE_KIND) return null
  if (typeof payload.code !== "string" || typeof payload.nonce !== "string") return null
  return {
    code: payload.code,
    codeHash: row.ticket_hash,
    nonce: payload.nonce,
    userId: row.user_id,
    email: typeof payload.email === "string" ? payload.email : null,
    expiresAt: Date.parse(row.expires_at),
  }
}

export function supabaseAuthCodeStore(): AuthCodeStore {
  return {
    async put(record) {
      try {
        const db = createServiceClient()
        const { error } = await db.from("kompas_desktop_handoffs").insert({
          ticket_hash: record.codeHash,
          user_id: record.userId,
          payload: {
            kind: AUTH_CODE_KIND,
            nonce: record.nonce,
            email: record.email,
            code: record.code,
            userId: record.userId,
          },
          expires_at: new Date(record.expiresAt).toISOString(),
        })
        return error ? "unavailable" : "ok"
      } catch {
        return "unavailable"
      }
    },
    async findByNonce(nonce) {
      try {
        const db = createServiceClient()
        const { data, error } = await db.from("kompas_desktop_handoffs")
          .select("ticket_hash,user_id,payload,expires_at")
          .contains("payload", { kind: AUTH_CODE_KIND, nonce })
          .limit(1)
        if (error) return "unavailable"
        const row = Array.isArray(data) ? data[0] : null
        return row ? rowToRecord(row) : null
      } catch {
        return "unavailable"
      }
    },
    async findByHash(codeHash) {
      try {
        const db = createServiceClient()
        const { data, error } = await db.from("kompas_desktop_handoffs")
          .select("ticket_hash,user_id,payload,expires_at")
          .eq("ticket_hash", codeHash)
          .maybeSingle()
        if (error) return "unavailable"
        return data ? rowToRecord(data) : null
      } catch {
        return "unavailable"
      }
    },
    async claim(codeHash, nonce, now) {
      try {
        const db = createServiceClient()
        const { data, error } = await db.rpc("claim_kompas_desktop_handoff", { p_ticket_hash: codeHash })
        if (error) return { ok: false, reason: "unavailable" }
        if (!data || typeof data !== "object") {
          const noted = await this.noteOf(codeHash)
          if (noted && noted !== "unavailable") return { ok: false, reason: "used" }
          return { ok: false, reason: "missing" }
        }
        const payload = data as Record<string, unknown>
        if (payload.kind !== AUTH_CODE_KIND || typeof payload.code !== "string" || typeof payload.nonce !== "string") {
          return { ok: false, reason: "missing" }
        }
        const record: AuthCodeRecord = {
          code: payload.code,
          codeHash,
          nonce: payload.nonce,
          userId: typeof payload.userId === "string" ? payload.userId : "",
          email: typeof payload.email === "string" ? payload.email : null,
          expiresAt: now + 1,
        }
        if (payload.nonce !== nonce) return { ok: false, reason: "nonce_mismatch" }
        return { ok: true, record }
      } catch {
        return { ok: false, reason: "unavailable" }
      }
    },
    async note(codeHash, note, userId) {
      try {
        if (!userId) return
        const db = createServiceClient()
        await db.from("kompas_desktop_handoffs").insert({
          ticket_hash: claimedHash(codeHash),
          user_id: userId,
          payload: { kind: "desktop-auth-claimed", ok: note.ok, message: note.message || "", codeHash },
          expires_at: new Date(Date.now() + 120_000).toISOString(),
        })
      } catch { /* status falls back to waiting, never a false success */ }
    },
    async noteOf(codeHash) {
      try {
        const db = createServiceClient()
        const { data, error } = await db.from("kompas_desktop_handoffs")
          .select("payload")
          .eq("ticket_hash", claimedHash(codeHash))
          .maybeSingle()
        if (error) return "unavailable"
        const payload = data?.payload
        if (!payload || typeof payload !== "object") return null
        const record = payload as Record<string, unknown>
        if (record.kind !== "desktop-auth-claimed") return null
        return { ok: record.ok === true, message: typeof record.message === "string" ? record.message : undefined }
      } catch {
        return "unavailable"
      }
    },
  }
}

// The claim RPC deletes the row and returns only the payload, which does not
// include user_id. The mint uses the email stored in that payload. Keep the
// hash helper exported for tests that build the same digest the route stores.
export function authCodeHash(code: string) {
  return hashAuthCode(code)
}
