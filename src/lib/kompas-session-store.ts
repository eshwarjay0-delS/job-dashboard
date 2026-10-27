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
  return { read, create, commit }
}
