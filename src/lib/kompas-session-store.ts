import { createHash, randomUUID } from 'node:crypto'
import { blob } from '@/lib/storage'
import type { WhatsAppKompas } from './whatsapp-kompas'

export type SharedKompasSession = {
  id: string
  owner: string
  revision: number
  sources: WhatsAppKompas
  history: { q: string; a: string }[]
  ledger?: unknown
  pending?: { requestId: string; question: string; expiresAt: number }
}
type Store = Pick<typeof blob, 'getText' | 'putIfAbsent'>
const account = (id: string) => {
  if (!id.trim()) throw new Error('Verified account required')
  return createHash('sha256').update(id).digest('hex')
}
const validId = (id: string) => /^[a-f0-9-]{36}$/.test(id)
const prefix = (owner: string, id: string) => {
  if (!validId(id)) throw new Error('Invalid session')
  return `kompas/shared/${account(owner)}/${id}/`
}
/** Immutable revisions make the conditional write the commit point; no expiring lock or mutable head. */
export function sharedKompasStore(storage: Store = blob) {
  async function read(owner: string, id: string): Promise<SharedKompasSession | null> {
    const base = prefix(owner, id)
    // All committed revisions are contiguous, starting at zero. Listing the R2
    // bucket required ListObjectsV2 permission that was never needed for reads and
    // broke live WhatsApp Kompas even when message receipts and creates succeeded.
    // Probe only exact keys with GetObject: O(log revisions), safe for long sessions.
    const get = (revision: number) => storage.getText(base + String(revision).padStart(10, '0') + '.json')
    const first = await get(0)
    if (first === null) return null
    const MAX = 9_999_999_998
    let low = 0, high = 1
    while (high <= MAX && await get(high) !== null) {
      low = high
      if (high >= Math.floor(MAX / 2)) { high = MAX + 1; break }
      high *= 2
    }
    if (high > MAX) high = MAX + 1
    while (high - low > 1) {
      const mid = low + Math.floor((high - low) / 2)
      if (await get(mid) !== null) low = mid
      else high = mid
    }
    const raw = low === 0 ? first : await get(low)
    if (raw === null) throw new Error('Session revision unavailable')
    const value = JSON.parse(raw) as SharedKompasSession
    if (value.owner !== owner || value.id !== id || value.revision !== low) throw new Error('Session ownership or revision mismatch')
    return value
  }
  async function create(owner: string): Promise<SharedKompasSession> {
    const id = randomUUID()
    const value: SharedKompasSession = { id, owner, revision: 0, sources: { mode: 'kompas', documents: [] }, history: [] }
    if (!await storage.putIfAbsent(prefix(owner, id) + '0000000000.json', JSON.stringify(value))) throw new Error('Session creation conflict')
    return value
  }
  async function commit(owner: string, expected: number, next: SharedKompasSession): Promise<boolean> {
    if (next.owner !== owner || next.revision !== expected + 1 || !Number.isSafeInteger(expected) || expected < 0 || expected >= 9999999999) throw new Error('Invalid session revision')
    const current = await read(owner, next.id)
    if (!current || current.revision !== expected) return false
    return storage.putIfAbsent(prefix(owner, next.id) + String(next.revision).padStart(10, '0') + '.json', JSON.stringify(next))
  }
  type Catalog = { owner: string; revision: number; sessions: { id: string; addedAt: string }[] }
  const catalogKey = (owner: string, revision: number) => `kompas/catalog/${account(owner)}/${String(revision).padStart(10, '0')}.json`
  async function catalog(owner: string): Promise<Catalog> {
    const get = (n: number) => storage.getText(catalogKey(owner, n))
    const first = await get(0)
    if (first === null) return { owner, revision: -1, sessions: [] }
    let low = 0, high = 1
    const max = 9999999999
    while (high < max && await get(high) !== null) { low = high; high = Math.min(max, high * 2) }
    while (high - low > 1) {
      const mid = low + Math.floor((high - low) / 2)
      if (await get(mid) !== null) low = mid
      else high = mid
    }
    const value = JSON.parse(low === 0 ? first : (await get(low)) || 'null') as Catalog
    if (!value || value.owner !== owner || value.revision !== low || !Array.isArray(value.sessions) ||
        value.sessions.length > 100 || value.sessions.some(s => !s || !validId(s.id) || typeof s.addedAt !== 'string' || !Number.isFinite(Date.parse(s.addedAt))) ||
        new Set(value.sessions.map(s => s.id)).size !== value.sessions.length) throw new Error('Invalid session catalog')
    return value
  }
  /** Discovery metadata only. Registration never authorizes access to a session. */
  async function remember(owner: string, id: string): Promise<boolean> {
    if (!await read(owner, id)) return false
    for (let attempt = 0; attempt < 12; attempt++) {
      const current = await catalog(owner)
      if (current.sessions.some(s => s.id === id)) return true
      const revision = current.revision + 1
      if (revision >= 9999999999) throw new Error('Session catalog exhausted')
      const next: Catalog = { owner, revision, sessions: [{ id, addedAt: new Date().toISOString() }, ...current.sessions].slice(0, 100) }
      if (await storage.putIfAbsent(catalogKey(owner, revision), JSON.stringify(next))) return true
    }
    return false
  }
  async function list(owner: string) { return (await catalog(owner)).sessions.map(({ id, addedAt }) => ({ id, addedAt })) }
  return { read, create, commit, remember, list }
}
