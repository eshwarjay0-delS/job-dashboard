'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
type Snapshot = { id: string; revision: number; history: { q: string; a: string }[]; ready: boolean; hasResume: boolean; hasJd: boolean; documentCount: number; pending: boolean }
export default function SourceEditor({ session, onSaved, onAuthLost }: { session: Snapshot; onSaved: (s: Snapshot) => void; onAuthLost: () => void }) {
  const [role, setRole] = useState<'resume' | 'jd' | 'support'>('resume')
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [base, setBase] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const stale = base !== null && base !== session.revision
  const limit = role === 'resume' ? 60000 : 8000
  async function importFile(file: File) {
    if (busy || stale) return
    if (!/\.(docx|pdf|txt)$/i.test(file.name) || !file.size || file.size > 4 * 1024 * 1024 || file.name.length > 100) {
      setMessage('Choose a nonempty DOCX, PDF or TXT file no larger than 4 MiB with a name of at most 100 characters.'); return
    }
    const revision = base ?? session.revision
    setBusy(true); setMessage('')
    try {
      const query = new URLSearchParams({ id: session.id, revision: String(revision), role, name: file.name })
      const response = await fetch(`/api/kompas/shared/upload?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file })
      const data = await response.json()
      if (!alive.current) return
      if (!response.ok) {
        if (response.status === 401) { onAuthLost(); return }
        setMessage(data.error || 'File could not be imported. Your draft was kept.')
      } else { setText(data.text); setName(data.name); setBase(data.revision); setMessage('File imported into the draft. Review the text, then save to update both channels.') }
    } catch { if (alive.current) setMessage('Upload interrupted. Your existing sources and draft were kept.') }
    finally { if (alive.current) setBusy(false) }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy || stale || !text.trim() || text.length > limit) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/kompas/shared', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.id, revision: base ?? session.revision, role, text, ...(name.trim() ? { name: name.trim() } : {}) }) })
      const data = await response.json()
      if (!alive.current) return
      if (!response.ok) {
        if (response.status === 401) { onAuthLost(); return }
        setMessage(data.error || 'Source could not be saved. Refresh the conversation before retrying.')
      } else {
        onSaved(data); setText(''); setName(''); setBase(null)
        setMessage('Source saved. The next answer will use the updated evidence.')
      }
    } catch { if (alive.current) setMessage('Connection interrupted. Refresh the conversation before retrying; the save may have completed.') }
    finally { if (alive.current) setBusy(false) }
  }
  return <details style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, margin: '16px 0' }}>
    <summary>Update resume, job description or supporting notes</summary>
    <p>Paste the complete replacement resume or job description, or add supporting notes. Changed evidence resets the active answer history on both channels and cancels any answer in progress. Previously stored revisions are retained.</p>
    <form onSubmit={save}>
      <label htmlFor="source-role">Source type</label>{' '}
      <select id="source-role" value={role} disabled={busy} onChange={e => { setRole(e.target.value as typeof role); setBase(b => b ?? session.revision) }}>
        <option value="resume">Replace resume</option><option value="jd">Replace job description</option><option value="support">Add supporting notes</option>
      </select>
      {role === 'support' && <p><label htmlFor="source-name">Notes name (optional)</label>{' '}<input id="source-name" value={name} maxLength={100} disabled={busy} onChange={e => { setName(e.target.value); setBase(b => b ?? session.revision) }} /></p>}
      <p><label htmlFor="source-file">Import a file into the draft (replaces draft text)</label>{' '}
        <input id="source-file" type="file" accept=".docx,.pdf,.txt" disabled={busy || stale} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file) }} />
      </p>
      <p>Web uploads: up to 4 MiB. Text PDFs: at most 12 pages. Review the extracted text before saving; scanned PDFs need conversion first.</p>
      <p><label htmlFor="source-text">Complete source text</label></p>
      <textarea id="source-text" value={text} rows={8} disabled={busy} onChange={e => { setText(e.target.value); setBase(b => b ?? session.revision) }} style={{ width: '100%', padding: 12, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8 }} />
      <p>{text.length.toLocaleString()} / {limit.toLocaleString()} characters. Supporting notes share an 8,000-character budget including names, up to 10 documents. Imported files use these same text limits.</p>
      {stale && <p role="alert">The conversation changed while you were editing. Your draft is kept. Review the current conversation, then <button type="button" disabled={busy} onClick={() => setBase(session.revision)}>Use current revision</button>.</p>}
      <button type="submit" disabled={busy || stale || !text.trim() || text.length > limit}>{busy ? 'Saving…' : 'Save source and reset answer context'}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </details>
}
