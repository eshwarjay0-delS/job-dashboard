"use client"
import { useEffect, useState } from 'react'

interface Receipt {
  id: string
  jobTitle?: string
  company?: string
  portalUrl: string
  atsPlatform?: string
  submittedAt: string
  status: string
}

export function ApplyReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/apply/receipts')
      .then(r => r.json())
      .then(d => { if (d.ok) setReceipts(d.receipts || []) })
      .catch(() => {})
  }, [])

  if (!receipts.length) return null

  return (
    <details className="mf-apply-history" open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Submission receipts ({receipts.length})</summary>
      {receipts.map(r => (
        <div key={r.id} className="mf-pipeline-row">
          <div className="mf-pipeline-info">
            <strong>{r.jobTitle || 'Application'}</strong>
            <span>{r.company}{r.atsPlatform ? ` · ${r.atsPlatform}` : ''}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {new Date(r.submittedAt).toLocaleDateString()} · {r.status}
          </span>
          {r.portalUrl && (
            <a href={r.portalUrl} target="_blank" rel="noopener noreferrer" className="mf-pipeline-open">
              Portal →
            </a>
          )}
        </div>
      ))}
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
        Proof of every application you marked as submitted.
      </p>
    </details>
  )
}
