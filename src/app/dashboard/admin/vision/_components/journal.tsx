import { JOURNAL_UPDATED, PLAN_JOURNAL, journalFor } from '@/lib/plan-vision-journal'

export default function VisionJournal({ area }: { area?: string }) {
  const entries = area ? journalFor(area) : PLAN_JOURNAL
  return <section aria-labelledby="vision-journal-title" style={{ margin: '28px 0', color: 'var(--text)' }}>
    <h2 id="vision-journal-title" style={{ fontSize: 23, marginBottom: 8 }}>Decisions &amp; delivery journal</h2>
    <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>Ideas, approvals, prompt changes, commits and pending work. Approval, deployment and verification are tracked separately. Updated {JOURNAL_UPDATED.replace('T', ' ').replace('Z', ' UTC')}. Updated during active development; external conversations are not automatically imported.</p>
    <div style={{ display: 'grid', gap: 12 }}>
      {entries.map(entry => <details key={entry.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: 16 }}>
        <summary style={{ cursor: 'pointer', lineHeight: 1.6 }}><strong>{entry.title}</strong><br /><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{entry.area} · Approval: {entry.approval} · Delivery: {entry.delivery}</span></summary>
        <p>{entry.detail}</p>
        <p><strong>Evidence:</strong> {entry.evidence}</p>
        <p><strong>Next:</strong> {entry.next}</p>
        {entry.commit && <p><strong>Commit:</strong> <a href={`https://github.com/eshwarjay0-delS/job-dashboard/commit/${entry.commit}`} target="_blank" rel="noopener noreferrer">{entry.commit.slice(0, 7)}</a></p>}
        <small style={{ color: 'var(--text-muted)' }}>Recorded {entry.updated.replace('T', ' ').replace('Z', ' UTC')}</small>
      </details>)}
    </div>
  </section>
}
