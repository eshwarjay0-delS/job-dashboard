// Account-scoped Kompas session catalog on a free Vercel Blob store (Hobby, $0).
// Used when owner mode is on (the default), so login-off traffic never
// touches the egress-restricted Supabase project. Same record shape as
// /api/kompas/account-sessions and public/kompas/account-sync.js.
import { isAuthDisabled } from "./authDisabled.ts"

export type SessionRow = {
  session_id: string
  payload: Record<string, unknown>
  deleted_at: string | null
  updated_at: string
  revision: number
}

export type Catalog = {
  version: 1
  userId: string
  rows: SessionRow[]
}

export type ArtifactRecord = {
  payload: Record<string, unknown>
  captured_at: number
  updated_at: string
}

export type FreeStoreBackend = {
  readCatalog(userId: string): Promise<Catalog | null>
  writeCatalog(userId: string, catalog: Catalog): Promise<void>
  readArtifact(userId: string, sessionId: string, key: string): Promise<ArtifactRecord | null>
  writeArtifact(userId: string, sessionId: string, key: string, record: ArtifactRecord): Promise<void>
}

export type SessionRecord = {
  id: string
  session: Record<string, unknown> | null
  deleted: boolean
  revision: number
  updatedAt: string
}

const CATALOG_VERSION = 1 as const
const ID_RE = /^[A-Za-z0-9:_-]{1,128}$/

let testBackend: FreeStoreBackend | null = null
let clock: () => string = () => new Date().toISOString()
const writeLocks = new Map<string, Promise<void>>()

export function setFreeSessionStoreForTests(backend: FreeStoreBackend | null): void {
  testBackend = backend
}

export function setFreeStoreClockForTests(next: (() => string) | null): void {
  clock = next || (() => new Date().toISOString())
}

export function resetFreeSessionStoreForTests(): void {
  testBackend = null
  clock = () => new Date().toISOString()
  writeLocks.clear()
}

export function createMemoryFreeStore(): FreeStoreBackend {
  const catalogs = new Map<string, Catalog>()
  const artifacts = new Map<string, ArtifactRecord>()
  return {
    async readCatalog(userId) {
      const catalog = catalogs.get(userId)
      return catalog ? structuredClone(catalog) : null
    },
    async writeCatalog(userId, catalog) {
      catalogs.set(userId, structuredClone(catalog))
    },
    async readArtifact(userId, sessionId, key) {
      const record = artifacts.get(artifactMapKey(userId, sessionId, key))
      return record ? structuredClone(record) : null
    },
    async writeArtifact(userId, sessionId, key, record) {
      artifacts.set(artifactMapKey(userId, sessionId, key), structuredClone(record))
    },
  }
}

/** True when login-off should use the free store instead of Supabase. */
export function shouldUseFreeSessionStore(env: NodeJS.Dict<string | undefined> = process.env): boolean {
  return isAuthDisabled(env)
}

export function isFreeSessionStoreConfigured(env: NodeJS.Dict<string | undefined> = process.env): boolean {
  if (testBackend) return true
  return Boolean(
    String(env.BLOB_READ_WRITE_TOKEN || "").trim() ||
    String(env.BLOB_STORE_ID || "").trim() ||
    String(env.KOMPAS_BLOB_STORE_ID || "").trim(),
  )
}

function artifactMapKey(userId: string, sessionId: string, key: string): string {
  return userId + "\0" + sessionId + "\0" + key
}

function catalogPath(userId: string): string {
  return `kompas/account/${userId}/catalog.json`
}

function artifactPath(userId: string, sessionId: string, key: string): string {
  return `kompas/account/${userId}/artifacts/${encodeURIComponent(sessionId)}/${encodeURIComponent(key)}.json`
}

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text()
}

function createBlobBackend(): FreeStoreBackend {
  return {
    async readCatalog(userId) {
      const { get } = await import("@vercel/blob")
      const result = await get(catalogPath(userId), { access: "private", useCache: false })
      if (!result || result.statusCode !== 200 || !result.stream) return null
      const parsed = JSON.parse(await streamToText(result.stream)) as Catalog
      if (!parsed || parsed.version !== CATALOG_VERSION || parsed.userId !== userId || !Array.isArray(parsed.rows)) {
        return null
      }
      return parsed
    },
    async writeCatalog(userId, catalog) {
      const { put } = await import("@vercel/blob")
      await put(catalogPath(userId), JSON.stringify(catalog), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 0,
      })
    },
    async readArtifact(userId, sessionId, key) {
      const { get } = await import("@vercel/blob")
      const result = await get(artifactPath(userId, sessionId, key), { access: "private", useCache: false })
      if (!result || result.statusCode !== 200 || !result.stream) return null
      const parsed = JSON.parse(await streamToText(result.stream)) as ArtifactRecord
      if (!parsed || typeof parsed.captured_at !== "number" || !parsed.payload || typeof parsed.payload !== "object") {
        return null
      }
      return parsed
    },
    async writeArtifact(userId, sessionId, key, record) {
      const { put } = await import("@vercel/blob")
      await put(artifactPath(userId, sessionId, key), JSON.stringify(record), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 0,
      })
    },
  }
}

function backend(): FreeStoreBackend {
  if (testBackend) return testBackend
  return createBlobBackend()
}

async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
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

function emptyCatalog(userId: string): Catalog {
  return { version: CATALOG_VERSION, userId, rows: [] }
}

export async function loadCatalog(userId: string): Promise<Catalog> {
  const catalog = await backend().readCatalog(userId)
  if (!catalog) return emptyCatalog(userId)
  return catalog
}

export async function replaceCatalog(userId: string, rows: SessionRow[]): Promise<Catalog> {
  const catalog: Catalog = { version: CATALOG_VERSION, userId, rows: [...rows].sort((a, b) => a.session_id < b.session_id ? -1 : a.session_id > b.session_id ? 1 : 0) }
  await backend().writeCatalog(userId, catalog)
  return catalog
}

function toRecord(row: SessionRow): SessionRecord {
  return {
    id: row.session_id,
    session: row.deleted_at ? null : { ...row.payload, id: row.session_id },
    deleted: !!row.deleted_at,
    revision: row.revision,
    updatedAt: row.updated_at,
  }
}

export function pageRows(rows: SessionRow[], cursor: string, pageSize: number): { records: SessionRecord[]; nextCursor: string | null } {
  const sorted = [...rows].sort((a, b) => a.session_id < b.session_id ? -1 : a.session_id > b.session_id ? 1 : 0)
  const start = cursor ? sorted.findIndex(r => r.session_id > cursor) : 0
  const slice = (start < 0 ? [] : sorted.slice(start, start + pageSize))
  return {
    records: slice.map(toRecord),
    nextCursor: slice.length === pageSize ? slice[slice.length - 1].session_id : null,
  }
}

export function deltaRows(rows: SessionRow[], floorIso: string, pageSize: number): SessionRecord[] | null {
  const floor = Date.parse(floorIso)
  if (!Number.isFinite(floor)) return null
  const changed = rows
    .filter(r => Date.parse(r.updated_at) >= floor)
    .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at) || (a.session_id < b.session_id ? -1 : 1))
  if (changed.length >= pageSize) return null
  return changed.map(toRecord)
}

export function catalogMarks(rows: SessionRow[]): { session_id: string; revision: number; updated_at: string; deleted_at: string | null }[] {
  return [...rows]
    .sort((a, b) => a.session_id < b.session_id ? -1 : a.session_id > b.session_id ? 1 : 0)
    .map(r => ({ session_id: r.session_id, revision: r.revision, updated_at: r.updated_at, deleted_at: r.deleted_at }))
}

function logLength(payload: Record<string, unknown>): number {
  return Array.isArray(payload.log) ? payload.log.length : 0
}

function unionTranscripts(previous: unknown, incoming: unknown): Record<string, unknown>[] {
  const items: { value: Record<string, unknown>; ord: number }[] = []
  const push = (list: unknown, offset: number) => {
    if (!Array.isArray(list)) return
    list.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return
      const key = (item as { key?: unknown }).key
      if (typeof key !== "string" || key.length < 1 || key.length > 200) return
      items.push({ value: item as Record<string, unknown>, ord: index + offset })
    })
  }
  push(previous, 0)
  push(incoming, 1_000_000)
  items.sort((a, b) => {
    const ka = String(a.value.key)
    const kb = String(b.value.key)
    if (ka !== kb) return ka < kb ? -1 : 1
    return b.ord - a.ord
  })
  const seen = new Set<string>()
  const kept: { value: Record<string, unknown>; ord: number }[] = []
  for (const item of items) {
    const key = String(item.value.key)
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(item)
  }
  kept.sort((a, b) => a.ord - b.ord)
  return kept.map(item => item.value)
}

export function mergeSessionRow(
  existing: SessionRow | undefined,
  operation: { id: string; patch: Record<string, unknown>; deleted: boolean },
  now = clock(),
): SessionRow {
  if (!ID_RE.test(operation.id)) throw new Error("Invalid session identifier.")
  // SQL insert creates an empty revision-1 row, then the first change bumps it.
  const row: SessionRow = existing
    ? { ...existing, payload: { ...existing.payload } }
    : { session_id: operation.id, payload: {}, deleted_at: null, updated_at: now, revision: 1 }
  if (operation.deleted) {
    if (row.deleted_at) return row
    return { ...row, payload: {}, deleted_at: now, revision: row.revision + 1, updated_at: now }
  }
  if (row.deleted_at) return row
  const patch = { ...operation.patch }
  if (row.payload.endedAt != null && String(row.payload.endedAt) !== "" &&
      (!Object.prototype.hasOwnProperty.call(patch, "endedAt") || patch.endedAt == null || String(patch.endedAt) === "")) {
    delete patch.runAt
    delete patch.pausedAt
    delete patch.endedAt
    delete patch.endedBy
  }
  const payload = applyPatch(row.payload, patch)
  if (Object.prototype.hasOwnProperty.call(patch, "transcripts")) {
    if (!Array.isArray(patch.transcripts)) throw new Error("Invalid transcript metadata")
    payload.transcripts = unionTranscripts(row.payload.transcripts, patch.transcripts)
  }
  if (JSON.stringify(payload) === JSON.stringify(row.payload)) return row
  return { ...row, payload, revision: row.revision + 1, updated_at: now }
}

function applyPatch(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const next = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (key === "id") continue
    next[key] = value
  }
  next.id = base.id || patch.id
  return next
}

export async function mergeSessionOperations(
  userId: string,
  operations: { id: string; patch: Record<string, unknown>; deleted: boolean }[],
): Promise<SessionRecord[]> {
  return withUserLock(userId, async () => {
    const catalog = await loadCatalog(userId)
    const byId = new Map(catalog.rows.map(row => [row.session_id, row]))
    const records: SessionRecord[] = []
    for (const operation of operations) {
      const next = mergeSessionRow(byId.get(operation.id), operation)
      byId.set(operation.id, next)
      records.push({
        id: next.session_id,
        session: undefined as unknown as null,
        deleted: !!next.deleted_at,
        revision: next.revision,
        updatedAt: next.updated_at,
      })
    }
    const rows = [...byId.values()].sort((a, b) => a.session_id < b.session_id ? -1 : a.session_id > b.session_id ? 1 : 0)
    await backend().writeCatalog(userId, { version: CATALOG_VERSION, userId, rows })
    return records
  })
}

export async function readArtifact(userId: string, sessionId: string, key: string): Promise<ArtifactRecord | null> {
  return backend().readArtifact(userId, sessionId, key)
}

export async function saveArtifact(
  userId: string,
  sessionId: string,
  key: string,
  payload: Record<string, unknown>,
  capturedAt: number,
): Promise<boolean> {
  if (!ID_RE.test(sessionId) || typeof key !== "string" || key.length > 220) return false
  if (key !== sessionId + ":live" && !new RegExp("^" + sessionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":tx:[0-9]+$").test(key)) {
    throw new Error("Wrong session artifact")
  }
  const catalog = await loadCatalog(userId)
  const session = catalog.rows.find(row => row.session_id === sessionId && !row.deleted_at)
  if (!session) throw new Error("Session not found")
  const existing = await backend().readArtifact(userId, sessionId, key)
  if (existing) {
    const newer = capturedAt > existing.captured_at
    const sameButLonger = capturedAt === existing.captured_at && logLength(payload) > logLength(existing.payload)
    if (!newer && !sameButLonger) return false
  }
  const record: ArtifactRecord = { payload, captured_at: capturedAt, updated_at: clock() }
  await backend().writeArtifact(userId, sessionId, key, record)
  return true
}

