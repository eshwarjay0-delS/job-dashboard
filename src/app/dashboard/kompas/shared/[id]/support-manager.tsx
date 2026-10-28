'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
type Snapshot = { id: string; revision: number; history: { q: string; a: string }[]; ready: boolean; hasResume: boolean; hasJd: boolean; documentCount: number; pending: boolean; supportingDocuments?: { index: number; name: string; characters: number }[] }
export default function SupportManager({ session, onSaved, onAuthLost }: { session: Snapshot; onSaved: (s: Snapshot) => void; onAuthLost: () => void }) {
  const [target, setTarget] = useState<{ index: number; revision: number; name: string; operation: 'replace' | 'remove' } | null>(null)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const stale = target !== null && target.revision !== session.revision
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!target || busy || stale || (target.operation === 'replace' && (!text.trim() || text.length > 8000 || !name.trim()))) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/kompas/shared', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: session.id, revision: target.revision, role: 'support', operation: target.operation, index: target.index, ...(target.operation === 'replace' ? { name, text } : {}) }) })
      const data = await response.json()
      if (!alive.current) return
      if (!response.ok) {
        if (response.status === 401) { onAuthLost(); return }
        setMessage(data.error || 'Unable to update this document. Refresh and select it again.')
      } else { onSaved(data); setTarget(null); setText(''); setName(''); setMessage('Supporting evidence updated for future answers.') }
    } catch { if (alive.current) setMessage('Connection interrupted. Refresh before retrying; the update may have completed.') }
    finally { if (alive.current) setBusy(false) }
  }
  return <details style={{ margin: '16px 0', padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
    <summary>Manage supporting documents ({session.documentCount})</summary>
    <p>Replace a document with complete corrected text, or remove it from active evidence. Either change resets active answer history and cancels pending answers. Older stored revisions remain; this is not permanent deletion.</p>
    <ul>{(session.supportingDocuments || []).map(doc => <li key={doc.index} style={{ margin: '12px 0', overflowWrap: 'anywhere' }}>
      {doc.name} · {doc.characters.toLocaleString()} characters{' '}
      {(['replace', 'remove'] as const).map(operation => <button key={operation} type="button" disabled={busy || target !== null} onClick={() => { setTarget({ index: doc.index, revision: session.revision, name: doc.name, operation }); setName(doc.name); setText(''); setMessage('') }}>{operation === 'replace' ? 'Replace' : 'Remove'}</button>)}
    </li>)}</ul>
    {!session.documentCount && <p>No supporting documents yet.</p>}
    {target && <form onSubmit={save}>
      <p>{target.operation === 'remove' ? 'Remove from active evidence' : 'Replace'}: <strong>{target.name}</strong></p>
      {target.operation === 'replace' && <>
        <label htmlFor="support-name">Document name</label>{' '}<input id="support-name" value={name} maxLength={100} disabled={busy} onChange={e => setName(e.target.value)} />
        <p><label htmlFor="support-replacement">Complete replacement text</label></p>
        <textarea id="support-replacement" value={text} rows={7} disabled={busy} onChange={e => setText(e.target.value)} style={{ width: '100%', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: 12 }} />
        <p>{text.length.toLocaleString()} characters. All supporting documents together must fit 8,000 characters including names.</p>
      </>}
      {stale && <p role="alert">The conversation changed. Cancel and select the document again from the current list. Your draft stays here until you cancel.</p>}
      <button type="submit" disabled={busy || stale || (target.operation === 'replace' && (!text.trim() || text.length > 8000 || !name.trim()))}>{busy ? 'Saving…' : target.operation === 'remove' ? 'Confirm removal and reset context' : 'Save replacement and reset context'}</button>{' '}
      <button type="button" disabled={busy} onClick={() => { setTarget(null); setText(''); setName('') }}>Cancel</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </details>
}
