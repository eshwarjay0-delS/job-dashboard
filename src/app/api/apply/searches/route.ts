import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { authenticatedUserId, signInRequired } from '@/lib/authBoundary'
import { blob } from '@/lib/storage'

export type SavedSearch = {
  id: string
  query: string
  location: string
  type: string
  remote: boolean
  createdAt: number
  lastRunAt: number
  lastCount: number
}

const prefix = (uid: string) => `apply-searches/${uid}/`

function validSearch(s: unknown): s is SavedSearch {
  if (!s || typeof s !== 'object') return false
  const { id, query } = s as Record<string, unknown>
  return typeof id === 'string' && id.length > 0 && typeof query === 'string' && query.length > 0
}

// Saved job searches: the user saves a hunt, re-runs it with one tap,
// and sees how many results are new since the last run.
export async function GET(req: NextRequest) {
  const id = await authenticatedUserId(req)
  if (!id) return signInRequired()
  try {
    const keys = (await blob.list(prefix(id))).filter(k => k.endsWith('.json')).sort().reverse().slice(0, 30)
    const searches = await Promise.all(keys.map(async k => JSON.parse(await blob.getText(k) || 'null')))
    return NextResponse.json({ searches: searches.filter(validSearch) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Saved searches unavailable.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const id = await authenticatedUserId(req)
  if (!id) return signInRequired()
  const b = await req.json().catch(() => null)
  if (!b) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  // Delete a saved search
  if (b.delete && typeof b.delete === 'string') {
    try {
      await blob.delete(`${prefix(id)}${b.delete}.json`)
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
    }
  }

  // Update last-run stats after a search
  if (b.touch && typeof b.touch === 'string') {
    try {
      const key = `${prefix(id)}${b.touch}.json`
      const raw = await blob.getText(key)
      if (!raw) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
      const s = JSON.parse(raw)
      s.lastRunAt = Date.now()
      if (typeof b.count === 'number') s.lastCount = b.count
      await blob.put(key, JSON.stringify(s))
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: 'Could not update.' }, { status: 500 })
    }
  }

  // Save a new search
  const query = String(b.query || '').slice(0, 200).trim()
  if (!query) return NextResponse.json({ error: 'Query is required.' }, { status: 400 })
  const search: SavedSearch = {
    id: randomUUID(),
    query,
    location: String(b.location || '').slice(0, 160),
    type: String(b.type || 'All contracts').slice(0, 40),
    remote: !!b.remote,
    createdAt: Date.now(),
    lastRunAt: Date.now(),
    lastCount: typeof b.count === 'number' ? b.count : 0,
  }
  try {
    await blob.put(`${prefix(id)}${search.id}.json`, JSON.stringify(search))
    return NextResponse.json({ ok: true, search })
  } catch {
    return NextResponse.json({ error: 'Could not save search.' }, { status: 500 })
  }
}
