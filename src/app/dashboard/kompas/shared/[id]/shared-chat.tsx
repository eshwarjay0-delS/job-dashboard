'use client'
import Link from 'next/link'
import SourceEditor from './source-editor'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
type Snapshot = { id: string; revision: number; history: { q: string; a: string }[]; ready: boolean; hasResume: boolean; hasJd: boolean; documentCount: number; pending: boolean }
export default function SharedChat({ id }: { id: string }) {
  const [session, setSession] = useState<Snapshot | null>(null)
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  const authLost = useRef(false)
  const accept = useCallback((next: Snapshot) => {
    if (alive.current && !authLost.current) setSession(old => !old || next.revision >= old.revision ? next : old)
  }, [])
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/kompas/shared?id=${encodeURIComponent(id)}`, { cache: 'no-store', signal })
      const data = await response.json()
      if (!alive.current || signal?.aborted) return
      if (!response.ok) {
        if (response.status === 401) authLost.current = true
        setSession(null)
        setError(data.error || 'Unable to load this session.')
        return
      }
      accept(data)
    } catch { if (alive.current && !signal?.aborted) setError('Connection interrupted. Refresh to try again.') }
  }, [id, accept])
  useEffect(() => {
    alive.current = true
    let controller = new AbortController()
    const initial = setTimeout(() => { void refresh(controller.signal) }, 0)
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || authLost.current) return
      controller.abort()
      controller = new AbortController()
      void refresh(controller.signal)
    }, 5000)
    return () => { alive.current = false; controller.abort(); clearTimeout(initial); clearInterval(timer) }
  }, [refresh])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!session?.ready || session.pending || busy || !question.trim()) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/kompas/shared', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, revision: session.revision, requestId: crypto.randomUUID(), question }) })
      const data = await response.json()
      if (!alive.current) return
      if (!response.ok) {
        if (response.status === 401) { authLost.current = true; setSession(null) }
        setError(data.error || 'Unable to answer. Refresh before retrying.')
        await refresh()
      } else { accept(data); setQuestion('') }
    } catch { if (alive.current) setError('Connection interrupted. Refresh before retrying; your question may have completed.') }
    finally { if (alive.current) setBusy(false) }
  }
  return <section style={{ maxWidth: 880, margin: '0 auto' }}>
    <Link href="/dashboard/kompas/shared">All shared chats</Link>
    <p style={{ color: 'var(--muted)' }}>KOMPAS · SHARED CHAT</p>
    <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.15 }}>Continue your WhatsApp conversation</h1>
    <p>The same resume, job description and conversation are used here. Updates appear every five seconds while this page is visible.</p>
    <button type="button" onClick={() => { setError(''); void refresh() }}>Refresh conversation</button>
    {error && <p role="alert" style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>{error}</p>}
    {!session && !error && <p role="status">Loading your conversation…</p>}
    {session && <>
      <p>Resume: {session.hasResume ? 'received' : 'needed'} · Job description: {session.hasJd ? 'received' : 'needed'} · Supporting documents: {session.documentCount}</p>
      {!session.ready && <p>Add the missing resume or job description below, or send it in WhatsApp.</p>}
      <SourceEditor session={session} onSaved={accept} onAuthLost={() => { authLost.current = true; setSession(null); setError('Sign in again to edit sources.') }} />
      <div aria-label="Conversation history">
        {session.history.length === 0 && <p>No answers yet. Ask your first question once your sources are ready.</p>}
        {session.history.map((turn, index) => <article key={index} style={{ margin: '24px 0', padding: 20, border: '1px solid var(--border)', borderRadius: 16 }}>
          <h2 style={{ fontSize: 20, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{turn.q}</h2>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 }}>{turn.a}</div>
        </article>)}
      </div>
      <form onSubmit={submit}>
        <label htmlFor="shared-question">Your question</label>
        <textarea id="shared-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={4000} rows={4} disabled={busy} style={{ width: '100%', padding: 14, border: '1px solid var(--border)', borderRadius: 12, margin: '8px 0', background: 'var(--bg)', color: 'var(--text)' }} />
        <button type="submit" disabled={!session.ready || session.pending || busy || !question.trim()}>{busy || session.pending ? 'Answer in progress…' : 'Ask Kompas'}</button>
      </form>
      <p style={{ color: 'var(--muted)' }}>To return WhatsApp to resume tailoring, send “revert” there. This conversation stays available here. The latest 40 turns are shown.</p>
    </>}
  </section>
}
