"use client"
import type { Mail } from "@/app/dashboard/_suite/sample"

export type DigestRadar = {
  threadId: string; account: string; to: string; subject: string
  snippet: string; daysWaiting: number; jobTitle: string; vendor: string
}

// Poke-style morning briefing, in-app: what needs him, what's waiting on them,
// what's new — computed from the already-loaded mail, no extra fetch.
export function DigestBriefing({ needs, theirs, mails, radar, onOpen }: {
  needs: Mail[]; theirs: Mail[]; mails: Mail[]
  radar: DigestRadar[]; onOpen: (id: string) => void
}) {
  const dayAgo = Date.now() - 864e5
  const newToday = mails.filter(m => m.unread && (m.ts || 0) > dayAgo)
  const topNeeds = [...needs].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 3)
  const waitingLong = theirs
    .map(m => ({ m, days: radar.find(r => r.threadId === m.id)?.daysWaiting ?? 0 }))
    .filter(x => x.days >= 7)
    .sort((a, b) => b.days - a.days)
    .slice(0, 3)

  if (!topNeeds.length && !waitingLong.length && !newToday.length) return null

  const ago = (ts?: number) => {
    if (!ts) return ""
    const h = Math.floor((Date.now() - ts) / 36e5)
    if (h < 1) return "just now"
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <section aria-label="Today's briefing" className="mf-digest">
      <div className="mf-digest-head">
        <h2>Today&rsquo;s briefing</h2>
        <p>
          {topNeeds.length > 0 && <><strong>{topNeeds.length}{needs.length > 3 ? ` of ${needs.length}` : ""}</strong> need your reply</>}
          {topNeeds.length > 0 && (waitingLong.length > 0 || newToday.length > 0) && " · "}
          {waitingLong.length > 0 && <><strong>{waitingLong.length}</strong> waiting 7+ days</>}
          {(topNeeds.length > 0 || waitingLong.length > 0) && newToday.length > 0 && " · "}
          {newToday.length > 0 && <><strong>{newToday.length}</strong> new today</>}
        </p>
      </div>
      <div className="mf-digest-cols">
        {topNeeds.length > 0 && (
          <div className="mf-digest-col">
            <h3>Needs your reply</h3>
            {topNeeds.map(m => (
              <button key={m.id} className="mf-digest-item" onClick={() => onOpen(m.id)}>
                <span className="mf-digest-from">{m.from || m.fromEmail}</span>
                <span className="mf-digest-subj">{m.subject}</span>
                <span className="mf-digest-meta">{ago(m.ts)}{m.role ? ` · ${m.role}` : ""}</span>
              </button>
            ))}
          </div>
        )}
        {waitingLong.length > 0 && (
          <div className="mf-digest-col">
            <h3>Waiting on them</h3>
            {waitingLong.map(({ m, days }) => (
              <button key={m.id} className="mf-digest-item" onClick={() => onOpen(m.id)}>
                <span className="mf-digest-from">{m.from || m.fromEmail}</span>
                <span className="mf-digest-subj">{m.subject}</span>
                <span className="mf-digest-meta">{days}d waiting{m.role ? ` · ${m.role}` : ""}</span>
              </button>
            ))}
          </div>
        )}
        {newToday.length > 0 && (
          <div className="mf-digest-col">
            <h3>New today</h3>
            {newToday.slice(0, 3).map(m => (
              <button key={m.id} className="mf-digest-item" onClick={() => onOpen(m.id)}>
                <span className="mf-digest-from">{m.from || m.fromEmail}</span>
                <span className="mf-digest-subj">{m.subject}</span>
                <span className="mf-digest-meta">{ago(m.ts)}</span>
              </button>
            ))}
            {newToday.length > 3 && <p className="mf-digest-more">+{newToday.length - 3} more unread today</p>}
          </div>
        )}
      </div>
    </section>
  )
}
