// Where transcripts are kept: this device, in the browser's own database, and nowhere else.
//
// MarketFit stores no transcript and no audio. The mistake this file prevents is a page that breaks, or loses a transcript
// without saying so, when the browser's database is unavailable (a private window, storage turned off, a full disk): nothing
// here throws. A save answers whether it was kept, so the page can say plainly when a transcript lives only in the open tab.

import type { Session } from "@/lib/kompasTranscript"

export type Kept = Session & { updatedAt: number }

const DB = "mf_kompas_transcripts"
const STORE = "sessions"

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return }
      const request = indexedDB.open(DB, 1)
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" }) }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch { resolve(null) }
  })
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  const db = await open()
  if (!db) return { ok: false }
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, mode)
      const request = work(tx.objectStore(STORE))
      tx.oncomplete = () => { db.close(); resolve({ ok: true, value: request.result }) }
      tx.onerror = () => { db.close(); resolve({ ok: false }) }
      tx.onabort = () => { db.close(); resolve({ ok: false }) }
    } catch { db.close(); resolve({ ok: false }) }
  })
}

/** Every kept transcript, newest first. Empty when the database cannot be read. */
export async function listSessions(): Promise<Kept[]> {
  const all = await run<Kept[]>("readonly", store => store.getAll())
  if (!all.ok) return []
  return all.value.filter(s => s && s.v === 1 && Array.isArray(s.segments)).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Keep a transcript. Answers whether it was kept. */
export async function saveSession(session: Session, now: number): Promise<boolean> {
  return (await run("readwrite", store => store.put({ ...session, updatedAt: now }))).ok
}

export async function deleteSession(id: string): Promise<boolean> {
  return (await run("readwrite", store => store.delete(id))).ok
}

// ── the person's own voice print ─────────────────────────────────────────────
// Kept beside the transcripts, in the same database on this device, under a name no transcript can have. It is a short
// list of numbers that describes how the person's voice sounds (src/lib/kompasVoice.ts); the recording it was worked out
// from is not kept. Only the person's own is ever stored: other people's voices are told apart while a transcript is open
// and are gone when it is closed.
const VOICE_ID = "__my_voice__"

export async function loadVoice(): Promise<{ print: unknown; savedAt: number } | null> {
  const got = await run<{ print?: unknown; savedAt?: number } | undefined>("readonly", store => store.get(VOICE_ID))
  return got.ok && got.value && got.value.print && typeof got.value.savedAt === "number" ? { print: got.value.print, savedAt: got.value.savedAt } : null
}

export async function saveVoice(print: unknown, now: number): Promise<boolean> {
  return (await run("readwrite", store => store.put({ id: VOICE_ID, print, savedAt: now }))).ok
}

export async function forgetVoice(): Promise<boolean> {
  return (await run("readwrite", store => store.delete(VOICE_ID))).ok
}

