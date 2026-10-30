import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { createServiceClient } from "@/lib/supabase/service"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEADERS = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" }
const ID_RE = /^[A-Za-z0-9:_-]{1,128}$/
const FIELDS = new Set([
  "id", "createdAt", "type", "jobLink", "company", "role", "jd", "resume", "documents",
  "docIds", "resumeId", "model", "language", "length", "tone", "mode", "instructions",
  "autoAnswer", "autoMode", "saveTranscript", "interviewer", "difficulty", "dossierSize",
  "runAt", "pausedAt", "endedAt", "endedBy", "runDeviceId", "lastActiveAt", "transcripts", "bibleSyncedAt",
  "prep", "note", "book", "site", "identity", "savedAt", "startedAt",
])
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: HEADERS })

function safePatch(id: string, patch: unknown): Record<string, unknown> | null {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null
  const data = patch as Record<string, unknown>
  if (Object.keys(data).some(k => !FIELDS.has(k))) return null
  if (data.id !== undefined && data.id !== id) return null
  if (JSON.stringify(data).length > 3_800_000) return null
  if (data.transcripts !== undefined &&
    (!Array.isArray(data.transcripts) || data.transcripts.length > 40 ||
      data.transcripts.some(v => !v || typeof v !== "object" || typeof v.key !== "string" || v.key.length > 200))) return null
  for (const k of ["resume", "jd", "documents", "instructions"]) {
    if (data[k] !== undefined && (typeof data[k] !== "string" || data[k].length > 3_700_000)) return null
  }
  // Tokens, refresh credentials, raw audio and arbitrary browser state are
  // never accepted as account-shared session fields.
  return { ...data, id }
}

export async function GET(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return json({ ok: false, error: "Sign in to sync your sessions." }, 401)
  try {
    const db = createServiceClient()
    // Cursor pagination follows the owner/session primary key; no arbitrary
    // 300-session cutoff and no shifting offset when another device updates.
    const cursor = req.nextUrl.searchParams.get("after") || ""
    if (cursor && !ID_RE.test(cursor)) return json({ ok: false, error: "Invalid sync cursor." }, 400)
    let query = db.from("kompas_account_sessions")
      .select("session_id,payload,deleted_at,updated_at,revision")
      .eq("user_id", user.id).order("session_id", { ascending: true }).limit(100)
    if (cursor) query = query.gt("session_id", cursor)
    const { data, error } = await query
    if (error) throw error
    return json({
      ok: true, userId: user.id, email: user.email,
      nextCursor: (data || []).length === 100 ? data![data!.length - 1].session_id : null,
      records: (data || []).map(r => ({
        id: r.session_id, session: r.deleted_at ? null : r.payload,
        deleted: !!r.deleted_at, revision: r.revision, updatedAt: r.updated_at,
      })),
    })
  } catch {
    return json({ ok: false, error: "Could not read the account's Kompas sessions. Local sessions were preserved." }, 503)
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return json({ ok: false, error: "Sign in to sync your sessions." }, 401)
  const limit = checkRateLimit("kompas-sessions:" + user.id, { max: 180, windowMs: 60_000 })
  if (!limit.ok) return json({ ok: false, error: "Too many session updates." }, 429)
  if (Number(req.headers.get("content-length") || 0) > 4_000_000) return json({ ok: false, error: "Session update too large." }, 413)
  const raw = await req.text().catch(() => "")
  if (Buffer.byteLength(raw, "utf8") > 4_000_000) return json({ ok: false, error: "Session update too large." }, 413)
  let body: unknown
  try { body = JSON.parse(raw) } catch { return json({ ok: false, error: "Invalid JSON." }, 400) }
  const ops = body && typeof body === "object" ? (body as Record<string, unknown>).operations : null
  if (!Array.isArray(ops) || ops.length < 1 || ops.length > 12) return json({ ok: false, error: "Invalid session operations." }, 400)
  const validated: { id: string; patch: Record<string, unknown>; deleted: boolean }[] = []
  for (const operation of ops) {
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) return json({ ok: false, error: "Invalid operation." }, 400)
    const o = operation as Record<string, unknown>
    if (typeof o.id !== "string" || !ID_RE.test(o.id) || typeof o.deleted !== "boolean") return json({ ok: false, error: "Invalid session identifier." }, 400)
    const patch = o.deleted ? {} : safePatch(o.id, o.patch)
    if (!patch) return json({ ok: false, error: "Invalid session fields." }, 400)
    validated.push({ id: o.id, patch, deleted: o.deleted })
  }
  if (new Set(validated.map(x => x.id)).size !== validated.length) return json({ ok: false, error: "Duplicate session operation." }, 400)
  try {
    const db = createServiceClient()
    const records = []
    for (const o of validated) {
      const { data, error } = await db.rpc("merge_kompas_account_session", {
        p_user_id: user.id, p_session_id: o.id, p_patch: o.patch, p_delete: o.deleted,
      })
      if (error) throw error
      records.push(data)
    }
    return json({ ok: true, userId: user.id, records })
  } catch {
    return json({ ok: false, error: "Could not save sessions to the account. Updates remain queued locally." }, 503)
  }
}
