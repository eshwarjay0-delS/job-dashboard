import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { isAuthDisabled } from "@/lib/authDisabled"
import { capSessionPayloadForSyntheticOwner, rejectIfSyntheticOwnerLimited, syntheticReadPageSize } from "@/lib/syntheticOwnerGuards"
import { createServiceClient } from "@/lib/supabase/service"
import { checkRateLimit } from "@/lib/rateLimit"
import {
  catalogTag,
  checkCatalogFullReadCap,
  checkCatalogPollCap,
  deltaSinceFloor,
  invalidateCatalogTag,
  isCatalogPollDisabled,
  rememberedCatalogTag,
  rememberCatalogTag,
} from "@/lib/kompasCatalogPoll"
import {
  catalogMarks,
  deltaRows,
  isFreeSessionStoreConfigured,
  loadCatalog,
  mergeSessionOperations,
  pageRows,
  shouldUseFreeSessionStore,
} from "@/lib/kompasFreeSessionStore"

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
let useLiteMerge = true
function isMissingFunction(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code || ""
  return code === "PGRST202" || code === "42883"
}
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: HEADERS })

const authDisabledFlag = () => (isAuthDisabled() ? { authDisabled: true as const } : {})

function capRecords(
  req: NextRequest,
  user: { id: string; email: string | null; synthetic?: true },
  records: { id: string; session: Record<string, unknown> | null; deleted: boolean; revision: number; updatedAt: string }[],
) {
  return records.map(r => ({
    ...r,
    session: r.deleted ? null : capSessionPayloadForSyntheticOwner(req, user, r.session),
  }))
}

async function getFromFreeStore(
  req: NextRequest,
  user: { id: string; email: string | null; synthetic?: true },
) {
  if (!isFreeSessionStoreConfigured()) {
    return json({ ok: false, error: "Could not read the account's Kompas sessions. Local sessions were preserved." }, 503)
  }
  const pageSize = syntheticReadPageSize(req, user, 100)
  const cursor = req.nextUrl.searchParams.get("after") || ""
  if (cursor && !ID_RE.test(cursor)) return json({ ok: false, error: "Invalid sync cursor." }, 400)
  const catalog = await loadCatalog(user.id)
  const marks = catalogMarks(catalog.rows)
  if (!cursor) {
    const inm = req.headers.get("if-none-match") || ""
    if (inm) {
      if (isCatalogPollDisabled()) {
        return new NextResponse(null, { status: 429, headers: { ...HEADERS, "Retry-After": "3600", "X-Kompas-Poll": "disabled" } })
      }
      const cap = checkCatalogPollCap(user.id)
      if (!cap.ok) {
        return new NextResponse(null, {
          status: 429,
          headers: { ...HEADERS, "Retry-After": String(cap.retryAfterSec || 60), "X-Kompas-Poll": "throttled" },
        })
      }
      const cached = rememberedCatalogTag(user.id)
      if (cached && cached === inm) {
        return new NextResponse(null, { status: 304, headers: { ...HEADERS, ETag: cached } })
      }
      const tag = catalogTag(user.id, marks)
      rememberCatalogTag(user.id, tag)
      if (inm === tag) return new NextResponse(null, { status: 304, headers: { ...HEADERS, ETag: tag } })
      const floor = deltaSinceFloor(req.nextUrl.searchParams.get("since"))
      if (floor && marks.length < pageSize) {
        const changed = deltaRows(catalog.rows, floor, pageSize)
        if (changed) {
          return NextResponse.json({
            ok: true, userId: user.id, email: user.email, delta: true, nextCursor: null,
            ...authDisabledFlag(),
            records: capRecords(req, user, changed),
          }, { status: 200, headers: { ...HEADERS, ETag: tag } })
        }
      }
    } else {
      const full = checkCatalogFullReadCap(user.id)
      if (!full.ok) {
        return new NextResponse(null, {
          status: 429,
          headers: { ...HEADERS, "Retry-After": String(full.retryAfterSec || 60), "X-Kompas-Poll": "full-read-throttled" },
        })
      }
    }
  }
  const page = pageRows(catalog.rows, cursor, pageSize)
  const etag = !cursor ? catalogTag(user.id, marks) : ""
  if (etag) rememberCatalogTag(user.id, etag)
  return NextResponse.json({
    ok: true, userId: user.id, email: user.email,
    ...authDisabledFlag(),
    nextCursor: page.nextCursor,
    records: capRecords(req, user, page.records),
  }, { status: 200, headers: etag ? { ...HEADERS, ETag: etag } : HEADERS })
}

async function postToFreeStore(
  user: { id: string; email: string | null; synthetic?: true },
  validated: { id: string; patch: Record<string, unknown>; deleted: boolean }[],
) {
  if (!isFreeSessionStoreConfigured()) {
    return json({ ok: false, error: "Could not save sessions to the account. Updates remain queued locally." }, 503)
  }
  const records = await mergeSessionOperations(user.id, validated)
  invalidateCatalogTag(user.id)
  return json({ ok: true, userId: user.id, ...authDisabledFlag(), records })
}

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
  const pageSize = syntheticReadPageSize(req, user, 100)
  try {
    if (shouldUseFreeSessionStore()) return await getFromFreeStore(req, user)
    const db = createServiceClient()
    // Cursor pagination follows the owner/session primary key; no arbitrary
    // 300-session cutoff and no shifting offset when another device updates.
    const cursor = req.nextUrl.searchParams.get("after") || ""
    if (cursor && !ID_RE.test(cursor)) return json({ ok: false, error: "Invalid sync cursor." }, 400)
    // Origin-transfer cut + hobby pack: timed polls send If-None-Match and get 304 when unchanged.
    // KOMPAS_POLL_DISABLED and a per-user cap apply only to those conditional polls; a full read
    // (first load, focus) still goes through. A short in-memory tag memo avoids repeat hashing.
    if (!cursor) {
      const inm = req.headers.get("if-none-match") || ""
      if (inm) {
        if (isCatalogPollDisabled()) {
          return new NextResponse(null, { status: 429, headers: { ...HEADERS, "Retry-After": "3600", "X-Kompas-Poll": "disabled" } })
        }
        const cap = checkCatalogPollCap(user.id)
        if (!cap.ok) {
          return new NextResponse(null, {
            status: 429,
            headers: { ...HEADERS, "Retry-After": String(cap.retryAfterSec || 60), "X-Kompas-Poll": "throttled" },
          })
        }
        const cached = rememberedCatalogTag(user.id)
        if (cached && cached === inm) {
          return new NextResponse(null, { status: 304, headers: { ...HEADERS, ETag: cached } })
        }
        const { data: marks, error: markError } = await db.from("kompas_account_sessions")
          .select("session_id,revision,updated_at,deleted_at")
          .eq("user_id", user.id).order("session_id", { ascending: true }).limit(pageSize)
        if (!markError && marks) {
          const tag = catalogTag(user.id, marks)
          rememberCatalogTag(user.id, tag)
          if (inm === tag) return new NextResponse(null, { status: 304, headers: { ...HEADERS, ETag: tag } })
          // Supabase egress cut (11 Nov 2026): a client that already holds the catalog asks only for
          // rows changed since its last read, instead of downloading every session payload again.
          const floor = deltaSinceFloor(req.nextUrl.searchParams.get("since"))
          if (floor && marks.length < pageSize) {
            const { data: changed, error: changedError } = await db.from("kompas_account_sessions")
              .select("session_id,payload,deleted_at,updated_at,revision")
              .eq("user_id", user.id).gte("updated_at", floor)
              .order("updated_at", { ascending: true }).limit(pageSize)
            if (!changedError && changed && changed.length < pageSize) {
              return NextResponse.json({
                ok: true, userId: user.id, email: user.email, delta: true, nextCursor: null,
                records: changed.map(r => ({
                  id: r.session_id, session: r.deleted_at ? null : capSessionPayloadForSyntheticOwner(req, user, r.payload),
                  deleted: !!r.deleted_at, revision: r.revision, updatedAt: r.updated_at,
                })),
              }, { status: 200, headers: { ...HEADERS, ETag: tag } })
            }
          }
        }
      } else {
        // Clients from before the conditional poll (a desktop window left open for days) pulled the whole
        // catalog every 12 s. Bound those unconditional full reads per user.
        const full = checkCatalogFullReadCap(user.id)
        if (!full.ok) {
          return new NextResponse(null, {
            status: 429,
            headers: { ...HEADERS, "Retry-After": String(full.retryAfterSec || 60), "X-Kompas-Poll": "full-read-throttled" },
          })
        }
      }
    }
    let query = db.from("kompas_account_sessions")
      .select("session_id,payload,deleted_at,updated_at,revision")
      .eq("user_id", user.id).order("session_id", { ascending: true }).limit(pageSize)
    if (cursor) query = query.gt("session_id", cursor)
    const { data, error } = await query
    if (error) throw error
    const etag = !cursor && data ? catalogTag(user.id, data) : ""
    if (etag) rememberCatalogTag(user.id, etag)
    return NextResponse.json({
      ok: true, userId: user.id, email: user.email,
      nextCursor: (data || []).length === pageSize ? data![data!.length - 1].session_id : null,
      records: (data || []).map(r => ({
        id: r.session_id, session: r.deleted_at ? null : capSessionPayloadForSyntheticOwner(req, user, r.payload),
        deleted: !!r.deleted_at, revision: r.revision, updatedAt: r.updated_at,
      })),
    }, { status: 200, headers: etag ? { ...HEADERS, ETag: etag } : HEADERS })
  } catch {
    return json({ ok: false, error: "Could not read the account's Kompas sessions. Local sessions were preserved." }, 503)
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return json({ ok: false, error: "Sign in to sync your sessions." }, 401)
  const ownerLimit = rejectIfSyntheticOwnerLimited(req, "account-sessions", user)
  if (ownerLimit) return ownerLimit
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
    if (shouldUseFreeSessionStore()) return await postToFreeStore(user, validated)
    const db = createServiceClient()
    const records = []
    for (const o of validated) {
      const args = { p_user_id: user.id, p_session_id: o.id, p_patch: o.patch, p_delete: o.deleted }
      // The _lite RPC returns the same record without the session payload, so a save no longer
      // downloads the whole session back out of Supabase. Older databases fall back to the original.
      let { data, error } = useLiteMerge
        ? await db.rpc("merge_kompas_account_session_lite", args)
        : { data: null, error: { code: "PGRST202" } as { code?: string } }
      if (error && isMissingFunction(error)) {
        useLiteMerge = false
        ;({ data, error } = await db.rpc("merge_kompas_account_session", args))
        if (data && typeof data === "object") data = { ...(data as Record<string, unknown>), session: undefined }
      }
      if (error) throw error
      records.push(data)
    }
    invalidateCatalogTag(user.id)
    return json({ ok: true, userId: user.id, records })
  } catch {
    return json({ ok: false, error: "Could not save sessions to the account. Updates remain queued locally." }, 503)
  }
}
