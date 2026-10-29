import { NextRequest } from 'next/server'
import { answerForVerifiedUser } from './kompasAnswerService'
import { sharedKompasStore, type SharedKompasSession } from './kompas-session-store'

function spokenKey(text: string): string {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** A different question must not be delivered as a copy of the previous answer. The same question may repeat. */
export function repeatsEarlierAnswer(history: Array<{ q?: string; a?: string }>, question: string, text: string): boolean {
  const last = Array.isArray(history) ? history[history.length - 1] : undefined
  if (!last) return false
  const prevQ = spokenKey(String(last.q || ''))
  const nextQ = spokenKey(question)
  if (!prevQ || !nextQ || prevQ === nextQ) return false
  const prevA = spokenKey(String(last.a || ''))
  const nextA = spokenKey(text)
  return prevA.length >= 80 && prevA === nextA
}

/** One shared engine for verified desktop and messaging adapters. This function never sends externally. */
export async function sharedKompasTurn(
  owner: string,
  id: string,
  expectedRevision: number,
  requestId: string,
  question: string,
  deps = { store: sharedKompasStore(), answer: answerForVerifiedUser, now: () => Date.now() },
): Promise<{ status: 'answered' | 'conflict' | 'unavailable' | 'repeated'; session?: SharedKompasSession; text?: string }> {
  if (!owner.trim() || !requestId.trim() || requestId.length > 256 || !question.trim() || question.length > 4000) throw new Error('Invalid turn')
  const session = await deps.store.read(owner, id)
  if (!session || session.revision !== expectedRevision) return { status: 'conflict' }
  if (!session.sources.resume || !session.sources.jd) throw new Error('Resume and job description required')
  if (session.pending && session.pending.expiresAt > deps.now()) return { status: 'conflict' }
  // The expected revision prevents a replay from creating another provider call.
  const claimed: SharedKompasSession = { ...session, revision: session.revision + 1,
    pending: { requestId, question, expiresAt: deps.now() + 120_000 } }
  if (!await deps.store.commit(owner, expectedRevision, claimed)) return { status: 'conflict' }
  try {
    const request = new NextRequest('http://kompas.internal/api/kompas/answer', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, stream: false, history: session.history, ledger: session.ledger,
        config: { resume: session.sources.resume, jd: session.sources.jd,
          documents: session.sources.documents.map(d => `${d.name}:\n${d.text}`).join('\n\n') } }),
    })
    const response = await deps.answer(request, { id: owner })
    const result = await response.json()
    if (!response.ok || result.unavailable || typeof result.text !== 'string' || !result.text.trim()) throw new Error('Answer unavailable')
    if (repeatsEarlierAnswer(session.history, question, result.text)) {
      await deps.store.commit(owner, claimed.revision, { ...claimed, revision: claimed.revision + 1, pending: undefined })
      return { status: 'repeated' }
    }
    const next: SharedKompasSession = { ...claimed, revision: claimed.revision + 1, pending: undefined,
      history: [...session.history, { q: question, a: result.text }].slice(-40), ledger: result.ledger }
    // A source update or cancellation wins over an old answer. Never deliver a stale result.
    if (!await deps.store.commit(owner, claimed.revision, next)) return { status: 'conflict' }
    return { status: 'answered', session: next, text: result.text }
  } catch {
    await deps.store.commit(owner, claimed.revision, { ...claimed, revision: claimed.revision + 1, pending: undefined })
    return { status: 'unavailable' }
  }
}
