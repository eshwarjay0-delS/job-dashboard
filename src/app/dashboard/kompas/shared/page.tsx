'use client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
type Entry = { id: string; addedAt: string }
export default function SharedSessions() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const current = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    current.current?.abort()
    const controller = new AbortController()
    current.current = controller
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/kompas/shared', { cache: 'no-store', signal: controller.signal })
      const data = await response.json()
      if (controller.signal.aborted) return
      if (!response.ok) { setEntries([]); setError(data.error || 'Unable to load sessions.'); return }
      setEntries(data.sessions)
    } catch { if (!controller.signal.aborted) { setEntries([]); setError('Connection interrupted. Please retry.') } }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }, [])
  useEffect(() => {
    const initial = setTimeout(() => { void refresh() }, 0)
    return () => { clearTimeout(initial); current.current?.abort() }
  }, [refresh])
  return <section style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
    <a href="/dashboard/kompas">Back to Kompas workspace</a>
    <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}>Your shared Kompas chats</h1>
    <p>Continue a WhatsApp conversation using the same resume, job description and answer history. Browser-local Kompas sessions are separate and do not appear here.</p>
    <button type="button" onClick={() => void refresh()} disabled={loading}>Refresh sessions</button>
    {loading && <p role="status">Loading sessions…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && entries.length === 0 && <p>No shared chats found. Send “kompas” to MFit on your linked WhatsApp number to start one.</p>}
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {entries.map(entry => <li key={entry.id} style={{ padding: 20, marginTop: 12, border: '1px solid var(--border)', borderRadius: 12 }}>
        <Link href={`/dashboard/kompas/shared/${entry.id}`}>Chat {entry.id.slice(0, 8)}</Link>
        <p>Added <time dateTime={entry.addedAt}>{new Date(entry.addedAt).toLocaleString()}</time></p>
      </li>)}
    </ul>
    <p>This list keeps your latest 100 added chats. Older links still work. To add an existing chat, open its link or send “kompas” again while it is active in WhatsApp. Sending “revert” keeps your history.</p>
  </section>
}
