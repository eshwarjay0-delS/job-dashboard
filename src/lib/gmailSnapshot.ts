// Saved Gmail rows on the free Blob store, used only while Supabase answers
// 402 / restricted / exceed_egress_quota. A working database read always wins.
import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import type { GoogleWorkspaceAccount } from "@/lib/googleWorkspace"

export const MAX_SNAPSHOT_BODY_BYTES = 4 * 1024 * 1024
export const MAX_THREADS_PER_PART = 200
export const MAX_SNAPSHOT_PARTS = 40

const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ID_RE = /^[A-Za-z0-9_-]{1,200}$/

export type GmailThreadRow = {
  user_id: string
  account_id: string
  thread_id: string
  account_email: string
  latest_ts: number
  data: Record<string, unknown>
  updated_at: string | null
}

export type GmailSyncRow = {
  user_id: string
  account_id: string
  last_sync_at: string | null
  days_synced: number
}

type ManifestAccount = {
  id: string
  email: string
  updated_at: string | null
}

type ManifestPart = {
  threads: number
  counts: Record<string, number>
  pathname: string
  access: "private" | "public"
}

export type GmailSnapshotManifest = {
  userId: string
  total: number
  snapshotAt: string
  counts: Record<string, number>
  parts: Record<string, ManifestPart>
  sync: GmailSyncRow[]
  accounts: ManifestAccount[]
}

export type SnapshotBackend = {
  put(path: string, body: string, access: "private" | "public"): Promise<void>
  get(path: string, access: "private" | "public"): Promise<string | null>
}

export type GmailAccountLoad = {
  accounts: GoogleWorkspaceAccount[]
  source: "supabase" | "snapshot"
  snapshotAt: string | null
  notice: string | null
}

type AuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string }

type CacheEntry = {
  snapshotAt: string
  partsKey: string
  threads: GmailThreadRow[]
}

let testBackend: SnapshotBackend | null = null
let clock: () => string = () => new Date().toISOString()
let privateSupported: boolean | null = null
const memory = new Map<string, CacheEntry>()
const writeLocks = new Map<string, Promise<void>>()

export function setGmailSnapshotBackendForTests(backend: SnapshotBackend | null): void {
  testBackend = backend
  privateSupported = null
}

export function setGmailSnapshotClockForTests(next: (() => string) | null): void {
  clock = next || (() => new Date().toISOString())
}

export function resetGmailSnapshotForTests(): void {
  testBackend = null
  clock = () => new Date().toISOString()
  privateSupported = null
  memory.clear()
  writeLocks.clear()
}

export function snapshotBodyTooLarge(byteLength: number): boolean {
  return !Number.isFinite(byteLength) || byteLength > MAX_SNAPSHOT_BODY_BYTES
}

export function savedMailNotice(snapshotAt: string): string {
  return `Showing your saved mail from ${formatSnapshotTime(snapshotAt)}. Live sync resumes when the database is back.`
}

export function isGmailQuotaError(error: unknown): boolean {
  if (error == null) return false
  const obj = (typeof error === "object" ? error : { message: String(error) }) as Record<string, unknown>
  const status = Number(obj.status ?? obj.statusCode)
  if (status === 402) return true
  const code = [obj.code, obj.error_code].map(v => (typeof v === "string" ? v.toLowerCase() : "")).join(" ")
  if (code === "restricted" || code.includes("exceed_egress_quota") || code === "restricted ") return true
  if (String(obj.code || "").toLowerCase() === "restricted") return true
  if (String(obj.code || "").toLowerCase() === "exceed_egress_quota") return true
  const text = [obj.message, obj.msg, obj.details, obj.hint, error instanceof Error ? error.message : ""]
    .map(v => (typeof v === "string" ? v : ""))
    .join(" ")
    .toLowerCase()
  return /restrict|exceed_egress|egress quota|service for this project is restricted/.test(text)
}

/** Constant-time secret check. Missing configuration is 503; any other miss is 401. */
export function authorizeSnapshotImport(
  header: string | null,
  env: NodeJS.Dict<string | undefined> = process.env,
): AuthResult {
  const secret = String(env.GMAIL_SNAPSHOT_IMPORT_SECRET || "")
  if (!secret) return { ok: false, status: 503, error: "Snapshot import is not configured." }
  const given = header ?? ""
  const a = createHash("sha256").update(given).digest()
  const b = createHash("sha256").update(secret).digest()
  if (!timingSafeEqual(a, b)) return { ok: false, status: 401, error: "Unauthorized." }
  return { ok: true }
}

export function createMemorySnapshotBackend(): SnapshotBackend {
  const files = new Map<string, string>()
  return {
    async put(path, body) {
      files.set(path, body)
    },
    async get(path) {
      return files.has(path) ? files.get(path)! : null
    },
  }
}

export async function acceptSnapshotPart(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const parsed = parsePart(body)
  if (!parsed.ok) return { status: parsed.status, body: { ok: false, error: parsed.error } }
  try {
    await withLock(parsed.value.userId, async () => {
      const manifest = (await readManifest(parsed.value.userId)) || emptyManifest(parsed.value.userId, parsed.value.total)
      const pathname = await writePart(parsed.value.userId, parsed.value.part, {
        userId: parsed.value.userId,
        part: parsed.value.part,
        threads: parsed.value.threads,
        sync: parsed.value.part === 0 ? parsed.value.sync : [],
      })
      manifest.total = parsed.value.total
      manifest.snapshotAt = clock()
      manifest.parts[String(parsed.value.part)] = {
        threads: parsed.value.threads.length,
        counts: countEmails(parsed.value.threads),
        pathname,
        access: pathname === partPath(parsed.value.userId, parsed.value.part) ? "private" : "public",
      }
      if (parsed.value.part === 0) manifest.sync = parsed.value.sync
      manifest.accounts = mergeAccounts(manifest.accounts, parsed.value.threads)
      manifest.counts = sumCounts(manifest.parts)
      await writeManifest(manifest)
      memory.delete(parsed.value.userId)
    })
  } catch (error) {
    if (error instanceof Error && error.message === "SNAPSHOT_PRIVATE_UNAVAILABLE") {
      return { status: 503, body: { ok: false, error: "Snapshot store could not keep this part private." } }
    }
    console.error("gmail snapshot import failed")
    return { status: 503, body: { ok: false, error: "Snapshot store is unavailable." } }
  }
  const manifest = await readManifest(parsed.value.userId)
  return {
    status: 200,
    body: {
      ok: true,
      part: parsed.value.part,
      total: parsed.value.total,
      threads: parsed.value.threads.length,
      snapshotAt: manifest?.snapshotAt || clock(),
    },
  }
}

export async function resolveGmailAccounts(
  userId: string,
  live: () => Promise<GoogleWorkspaceAccount[]>,
): Promise<GmailAccountLoad> {
  try {
    const accounts = await live()
    return { accounts, source: "supabase", snapshotAt: null, notice: null }
  } catch (error) {
    if (!isGmailQuotaError(error)) throw error
    return snapshotAccountLoad(userId)
  }
}

export async function loadWorkspaceAccounts(userId: string): Promise<GmailAccountLoad> {
  const { listGoogleWorkspaceAccounts } = await import("@/lib/googleWorkspace")
  return resolveGmailAccounts(userId, () => listGoogleWorkspaceAccounts(userId))
}

export async function snapshotThreads(
  userId: string,
  opts: { days?: number; account?: string; offset?: number; limit?: number } = {},
): Promise<{ threads: Record<string, unknown>[]; total: number; snapshotAt: string | null; notice: string | null }> {
  if (!USER_ID_RE.test(userId)) return { threads: [], total: 0, snapshotAt: null, notice: null }
  const loaded = await loadThreads(userId)
  if (!loaded) {
    return { threads: [], total: 0, snapshotAt: null, notice: "Live sync resumes when the database is back." }
  }
  const account = opts.account?.trim().toLowerCase() || ""
  const days = Math.min(Math.max(Number(opts.days) || 30, 1), 90)
  const cutoff = Date.now() - days * 86_400_000
  const matched = loaded.threads.filter(row => {
    if (row.user_id !== userId) return false
    if (!(row.latest_ts > cutoff)) return false
    if (account && row.account_email.toLowerCase() !== account) return false
    return true
  })
  const offset = Math.max(Number(opts.offset) || 0, 0)
  const page = opts.limit == null ? matched : matched.slice(offset, offset + Math.max(1, opts.limit))
  return {
    threads: page.map(threadView).filter((row): row is Record<string, unknown> => !!row),
    total: matched.length,
    snapshotAt: loaded.snapshotAt,
    notice: savedMailNotice(loaded.snapshotAt),
  }
}

export async function findSnapshotThread(
  userId: string,
  threadId: string,
  account?: string,
): Promise<Record<string, unknown> | null> {
  if (!USER_ID_RE.test(userId) || !ID_RE.test(threadId)) return null
  const loaded = await loadThreads(userId)
  if (!loaded) return null
  const want = account?.trim().toLowerCase() || ""
  const row = loaded.threads.find(item =>
    item.user_id === userId &&
    item.thread_id === threadId &&
    (!want || item.account_email.toLowerCase() === want),
  )
  return row ? threadView(row) : null
}

function formatSnapshotTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
}

function emptyManifest(userId: string, total: number): GmailSnapshotManifest {
  return { userId, total, snapshotAt: clock(), counts: {}, parts: {}, sync: [], accounts: [] }
}

function manifestPath(userId: string): string {
  return `gmail-snapshot/${userId}/manifest.json`
}

function partPath(userId: string, part: number): string {
  return `gmail-snapshot/${userId}/part-${part}.json`
}

function sealedPath(userId: string, name: string): string {
  const secret = String(process.env.GMAIL_SNAPSHOT_IMPORT_SECRET || "gmail-snapshot")
  const mac = createHmac("sha256", secret).update(`${userId}:${name}`).digest("hex")
  return `gmail-snapshot/${mac}.json`
}

async function snapshotAccountLoad(userId: string): Promise<GmailAccountLoad> {
  const manifest = USER_ID_RE.test(userId) ? await readManifest(userId) : null
  if (!manifest || manifest.userId !== userId) {
    return { accounts: [], source: "snapshot", snapshotAt: null, notice: "Live sync resumes when the database is back." }
  }
  return {
    accounts: accountsFromManifest(manifest),
    source: "snapshot",
    snapshotAt: manifest.snapshotAt,
    notice: savedMailNotice(manifest.snapshotAt),
  }
}

function accountsFromManifest(manifest: GmailSnapshotManifest): GoogleWorkspaceAccount[] {
  const syncById = new Map(manifest.sync.filter(row => row.user_id === manifest.userId).map(row => [row.account_id, row]))
  const rows = manifest.accounts.filter(row => row.id && row.email).slice().sort((a, b) => a.email.localeCompare(b.email) || a.id.localeCompare(b.id))
  let primary = 0
  let best = Number.NEGATIVE_INFINITY
  rows.forEach((row, index) => {
    const raw = syncById.get(row.id)?.last_sync_at
    const ts = raw ? Date.parse(raw) : Number.NEGATIVE_INFINITY
    if (ts > best) {
      best = ts
      primary = index
    }
  })
  return rows.map((row, index) => ({
    id: row.id,
    google_email: row.email,
    granted_scopes: [],
    gmail_enabled: true,
    calendar_enabled: false,
    is_primary: index === primary,
    last_gmail_sync_at: syncById.get(row.id)?.last_sync_at ?? null,
    last_calendar_sync_at: null,
    connected_at: row.updated_at || manifest.snapshotAt,
    updated_at: row.updated_at || manifest.snapshotAt,
  }))
}

async function loadThreads(userId: string): Promise<{ snapshotAt: string; threads: GmailThreadRow[] } | null> {
  const manifest = await readManifest(userId)
  if (!manifest || manifest.userId !== userId) return null
  const partsKey = Object.keys(manifest.parts).sort().join(",")
  const hit = memory.get(userId)
  if (hit && hit.snapshotAt === manifest.snapshotAt && hit.partsKey === partsKey) {
    return { snapshotAt: hit.snapshotAt, threads: hit.threads }
  }
  const threads: GmailThreadRow[] = []
  const seen = new Map<string, GmailThreadRow>()
  const partNos = Object.keys(manifest.parts).map(Number).filter(n => Number.isInteger(n)).sort((a, b) => a - b)
  for (const part of partNos) {
    const meta = manifest.parts[String(part)]
    const text = await backendGet(meta.pathname, meta.access)
    if (!text) continue
    const parsed = JSON.parse(text) as { threads?: GmailThreadRow[] }
    for (const row of parsed.threads || []) {
      if (row.user_id !== userId) continue
      const key = `${row.account_id}\0${row.thread_id}`
      const prev = seen.get(key)
      if (!prev || row.latest_ts >= prev.latest_ts) seen.set(key, row)
    }
  }
  threads.push(...seen.values())
  threads.sort((a, b) => b.latest_ts - a.latest_ts || a.account_id.localeCompare(b.account_id) || a.thread_id.localeCompare(b.thread_id))
  memory.set(userId, { snapshotAt: manifest.snapshotAt, partsKey, threads })
  return { snapshotAt: manifest.snapshotAt, threads }
}

function threadView(row: GmailThreadRow): Record<string, unknown> | null {
  const data = row.data
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const messages = (data as { messages?: unknown }).messages
  if (!Array.isArray(messages) || messages.length === 0) return null
  return { ...data, threadId: row.thread_id, accountEmail: row.account_email }
}

function countEmails(threads: GmailThreadRow[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of threads) {
    const key = row.account_email.toLowerCase()
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

function sumCounts(parts: Record<string, ManifestPart>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const part of Object.values(parts)) {
    for (const [email, count] of Object.entries(part.counts)) counts[email] = (counts[email] || 0) + count
  }
  return counts
}

function mergeAccounts(existing: ManifestAccount[], threads: GmailThreadRow[]): ManifestAccount[] {
  const byId = new Map(existing.map(row => [row.id, { ...row }]))
  for (const row of threads) {
    const prev = byId.get(row.account_id)
    const updated = row.updated_at && (!prev?.updated_at || row.updated_at > prev.updated_at) ? row.updated_at : prev?.updated_at || row.updated_at
    byId.set(row.account_id, { id: row.account_id, email: row.account_email || prev?.email || "", updated_at: updated })
  }
  return [...byId.values()].filter(row => row.email)
}

async function readManifest(userId: string): Promise<GmailSnapshotManifest | null> {
  const text = await backendGet(manifestPath(userId), "private")
    || await backendGet(sealedPath(userId, "manifest"), "public")
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as GmailSnapshotManifest
    if (!parsed || parsed.userId !== userId || !parsed.parts || typeof parsed.parts !== "object") return null
    return parsed
  } catch {
    return null
  }
}

async function writeManifest(manifest: GmailSnapshotManifest): Promise<void> {
  await backendPut(manifest.userId, manifestPath(manifest.userId), JSON.stringify({
    userId: manifest.userId,
    total: manifest.total,
    snapshotAt: manifest.snapshotAt,
    counts: manifest.counts,
    parts: manifest.parts,
    sync: manifest.sync,
    accounts: manifest.accounts,
  }), "manifest")
}

async function writePart(userId: string, part: number, payload: unknown): Promise<string> {
  return backendPut(userId, partPath(userId, part), JSON.stringify(payload), `part-${part}`)
}

async function backendPut(userId: string, logicalPath: string, text: string, name: string): Promise<string> {
  if (testBackend) {
    await testBackend.put(logicalPath, text, "private")
    return logicalPath
  }
  const { put } = await import("@vercel/blob")
  if (privateSupported !== false) {
    try {
      await put(logicalPath, text, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 0,
      })
      privateSupported = true
      return logicalPath
    } catch (error) {
      if (!privateUnsupported(error)) throw error
      privateSupported = false
    }
  }
  const hidden = sealedPath(userId, name)
  await put(hidden, text, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  })
  return hidden
}

async function backendGet(path: string, access: "private" | "public"): Promise<string | null> {
  if (testBackend) return testBackend.get(path, access)
  const { get } = await import("@vercel/blob")
  try {
    const result = await get(path, { access, useCache: false })
    if (!result || result.statusCode !== 200 || !result.stream) return null
    return await new Response(result.stream).text()
  } catch {
    return null
  }
}

function privateUnsupported(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return /private access is not|access [:"]?private|unknown access|invalid access/i.test(text)
}

async function withLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(userId) || Promise.resolve()
  let release: () => void = () => {}
  const current = new Promise<void>(resolve => { release = resolve })
  writeLocks.set(userId, previous.then(() => current, () => current))
  await previous.catch(() => undefined)
  try {
    return await fn()
  } finally {
    release()
    if (writeLocks.get(userId) === current) writeLocks.delete(userId)
  }
}

type ParsedPart = {
  userId: string
  part: number
  total: number
  sync: GmailSyncRow[]
  threads: GmailThreadRow[]
}

function parsePart(body: unknown): { ok: true; value: ParsedPart } | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Snapshot part must be a JSON object." }
  }
  const record = body as Record<string, unknown>
  const userId = typeof record.user_id === "string" ? record.user_id.trim() : ""
  if (!USER_ID_RE.test(userId)) return { ok: false, status: 400, error: "user_id must be the account id." }
  const part = record.part
  const total = record.total
  if (!Number.isInteger(part) || (part as number) < 0) return { ok: false, status: 400, error: "part must be a whole number." }
  if (!Number.isInteger(total) || (total as number) < 1 || (total as number) > MAX_SNAPSHOT_PARTS) {
    return { ok: false, status: 400, error: "total is out of range." }
  }
  if ((part as number) >= (total as number)) return { ok: false, status: 400, error: "part must be less than total." }
  const syncInput = record.sync == null ? [] : record.sync
  if (!Array.isArray(syncInput)) return { ok: false, status: 400, error: "sync must be a list." }
  if ((part as number) !== 0 && syncInput.length > 0) return { ok: false, status: 400, error: "sync is only accepted on part 0." }
  const threadInput = record.threads
  if (!Array.isArray(threadInput)) return { ok: false, status: 400, error: "threads must be a list." }
  if (threadInput.length > MAX_THREADS_PER_PART) return { ok: false, status: 400, error: "Too many threads in one part." }
  const sync: GmailSyncRow[] = []
  for (const row of syncInput) {
    const parsed = parseSync(row, userId)
    if (!parsed.ok) return parsed
    sync.push(parsed.value)
  }
  const threads: GmailThreadRow[] = []
  for (const row of threadInput) {
    const parsed = parseThread(row, userId)
    if (!parsed.ok) return parsed
    threads.push(parsed.value)
  }
  return { ok: true, value: { userId, part: part as number, total: total as number, sync, threads } }
}

function parseSync(row: unknown, userId: string): { ok: true; value: GmailSyncRow } | { ok: false; status: number; error: string } {
  if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, status: 400, error: "A sync row is not an object." }
  const record = row as Record<string, unknown>
  if (record.user_id != null && record.user_id !== userId) return { ok: false, status: 400, error: "A sync row is for a different user." }
  const accountId = typeof record.account_id === "string" ? record.account_id.trim() : ""
  if (!ID_RE.test(accountId)) return { ok: false, status: 400, error: "A sync row is missing account_id." }
  const days = Number(record.days_synced)
  if (!Number.isFinite(days) || days < 0 || days > 3650) return { ok: false, status: 400, error: "A sync row has a bad days_synced." }
  const last = record.last_sync_at
  if (last != null && typeof last !== "string") return { ok: false, status: 400, error: "A sync row has a bad last_sync_at." }
  return { ok: true, value: { user_id: userId, account_id: accountId, last_sync_at: typeof last === "string" ? last : null, days_synced: days } }
}

function parseThread(row: unknown, userId: string): { ok: true; value: GmailThreadRow } | { ok: false; status: number; error: string } {
  if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, status: 400, error: "A thread row is not an object." }
  const record = row as Record<string, unknown>
  if (record.user_id != null && record.user_id !== userId) return { ok: false, status: 400, error: "A thread row is for a different user." }
  const accountId = typeof record.account_id === "string" ? record.account_id.trim() : ""
  const threadId = typeof record.thread_id === "string" ? record.thread_id.trim() : ""
  const email = typeof record.account_email === "string" ? record.account_email.trim() : ""
  if (!ID_RE.test(accountId) || !ID_RE.test(threadId)) return { ok: false, status: 400, error: "A thread row is missing its id." }
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || email.length > 320) return { ok: false, status: 400, error: "A thread row is missing account_email." }
  const latest = Number(record.latest_ts)
  if (!Number.isFinite(latest)) return { ok: false, status: 400, error: "A thread row is missing latest_ts." }
  let data = record.data
  if (typeof data === "string") {
    try { data = JSON.parse(data) } catch { return { ok: false, status: 400, error: "A thread row has unreadable data." } }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, status: 400, error: "A thread row is missing data." }
  const updated = record.updated_at
  if (updated != null && typeof updated !== "string") return { ok: false, status: 400, error: "A thread row has a bad updated_at." }
  return {
    ok: true,
    value: {
      user_id: userId,
      account_id: accountId,
      thread_id: threadId,
      account_email: email,
      latest_ts: latest,
      data: data as Record<string, unknown>,
      updated_at: typeof updated === "string" ? updated : null,
    },
  }
}
