import { NextRequest, NextResponse } from 'next/server'
import { authenticatedUser } from '@/lib/authBoundary'
import { sharedKompasStore, type SharedKompasSession } from '@/lib/kompas-session-store'
import { kompasTransition } from '@/lib/whatsapp-kompas'
import { sharedKompasTurn } from '@/lib/kompas-shared-turn'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id)
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const view = (s: SharedKompasSession) => ({ id: s.id, revision: s.revision, history: s.history,
  ready: Boolean(s.sources.resume && s.sources.jd), hasResume: Boolean(s.sources.resume), hasJd: Boolean(s.sources.jd),
  documentCount: s.sources.documents.length, pending: Boolean(s.pending && s.pending.expiresAt > Date.now()) })
export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return reply({ error: 'Sign in with the MarketFit account linked to your WhatsApp.' }, 401)
  const id = request.nextUrl.searchParams.get('id')
  if (id === null) {
    try { return reply({ sessions: await sharedKompasStore().list(user.id) }) }
    catch { return reply({ error: 'Sessions unavailable. Please retry.' }, 503) }
  }
  if (!validId(id)) return reply({ error: 'Invalid session link.' }, 400)
  try {
    const session = await sharedKompasStore().read(user.id, id)
    if (session) {
      try { await sharedKompasStore().remember(user.id, id) } catch { /* Retry discovery on the next owned visit. */ }
    }
    return session ? reply(view(session)) : reply({ error: 'Session not found for this account.' }, 404)
  } catch { return reply({ error: 'Session unavailable. Please retry.' }, 503) }
}
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return reply({ error: 'Sign in with the MarketFit account linked to your WhatsApp.' }, 401)
  let input: { id?: unknown; revision?: unknown; requestId?: unknown; question?: unknown }
  try {
    const raw = await request.text()
    if (raw.length > 10000) return reply({ error: 'Question is too long.' }, 413)
    input = JSON.parse(raw)
    if (!input || typeof input !== 'object') throw new Error('Invalid input')
  } catch { return reply({ error: 'Invalid question request.' }, 400) }
  if (!validId(input.id) || typeof input.revision !== 'number' || !Number.isSafeInteger(input.revision) || input.revision < 0 ||
      typeof input.requestId !== 'string' || !input.requestId.trim() || input.requestId.length > 256 ||
      typeof input.question !== 'string' || !input.question.trim() || input.question.length > 4000)
    return reply({ error: 'Provide a question and the current session revision.' }, 400)
  try {
    const session = await sharedKompasStore().read(user.id, input.id)
    if (!session) return reply({ error: 'Session not found for this account.' }, 404)
    if (!session.sources.resume || !session.sources.jd) return reply({ error: 'Send your resume and job description in WhatsApp first.' }, 409)
    const result = await sharedKompasTurn(user.id, input.id, input.revision, input.requestId, input.question.trim())
    if (result.status === 'conflict') return reply({ error: 'The session changed or an answer is in progress. Refresh before retrying.' }, 409)
    if (result.status !== 'answered' || !result.session) return reply({ error: 'The answer could not be completed. Please retry.' }, 503)
    return reply(view(result.session))
  } catch { return reply({ error: 'The answer could not be completed. Please refresh before retrying.' }, 503) }
}

/** Explicit evidence updates; ordinary text is never guessed to be a resume or JD. */
export async function PATCH(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return reply({ error: 'Sign in with the MarketFit account linked to your WhatsApp.' }, 401)
  let input: { id?: unknown; revision?: unknown; role?: unknown; name?: unknown; text?: unknown }
  try {
    const raw = await request.text()
    if (raw.length > 400000) return reply({ error: 'Source request is too large.' }, 413)
    input = JSON.parse(raw)
    if (!input || typeof input !== 'object') throw new Error('Invalid input')
  } catch { return reply({ error: 'Invalid source request.' }, 400) }
  if (!validId(input.id) || typeof input.revision !== 'number' || !Number.isSafeInteger(input.revision) || input.revision < 0 ||
      !['resume', 'jd', 'support'].includes(String(input.role)) || typeof input.role !== 'string' ||
      typeof input.text !== 'string' || !input.text.trim() ||
      (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100)))
    return reply({ error: 'Provide a source type, readable text and the current revision.' }, 400)
  const role = input.role as 'resume' | 'jd' | 'support'
  const name = typeof input.name === 'string' ? input.name.trim().replace(/[\\/]/g, '_') : role === 'support' ? 'Web notes' : role === 'resume' ? 'Pasted resume' : 'Pasted job description'
  try {
    const store = sharedKompasStore()
    const session = await store.read(user.id, input.id)
    if (!session) return reply({ error: 'Session not found for this account.' }, 404)
    if (session.revision !== input.revision) return reply({ error: 'The conversation changed. Review the latest revision before saving your draft.' }, 409)
    const change = kompasTransition(session.sources, { kind: 'document', role, name, text: input.text })
    if (change.action !== 'setup' || !change.state) return reply({ error: change.prompt || 'Source cannot be used.' }, 422)
    if (JSON.stringify(change.state) === JSON.stringify(session.sources)) return reply(view(session))
    const next = { ...session, revision: session.revision + 1, sources: change.state, history: [], ledger: undefined, pending: undefined }
    if (!await store.commit(user.id, session.revision, next)) return reply({ error: 'The conversation changed. Review the latest revision before saving your draft.' }, 409)
    return reply(view(next))
  } catch { return reply({ error: 'Source could not be saved. Refresh before retrying.' }, 503) }
}
