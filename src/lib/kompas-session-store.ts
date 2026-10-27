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
type Store = Pick<typeof blob, 'list' | 'getText' | 'putIfAbsent'>
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
    const keys = (await storage.list(base)).filter(k => /^\d{10}\.json$/.test(k.slice(base.length))).sort()
    if (!keys.length) return null
    const raw = await storage.getText(keys[keys.length - 1])
    if (!raw) throw new Error('Session revision unavailable')
    const value = JSON.parse(raw) as SharedKompasSession
    if (value.owner !== owner || value.id !== id) throw new Error('Session ownership mismatch')
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
