"use client"

// New things, where the user lives: the Patterns page and the Apply
// Needs-you tab shipped on other routes, and on a phone he never saw
// them. This strip sits on the Gmail page itself and links to both,
// with only counts that come from the app's own data. If a count cannot
// be read, its link is shown without a number — never an invented one,
// and never an invented deadline.

import { useEffect, useState } from "react"
import Link from "next/link"
import { needsYou, type PipelineJob } from "@/lib/apply-needs-you"

const STAGES = ["save", "view", "tailor", "open_portal", "submitted"] as const

export default function NewShipments() {
  const [patternCounts, setPatternCounts] = useState<{ needsYou: number; waiting: number; done: number } | null>(null)
  const [applyNeeds, setApplyNeeds] = useState<number | null>(null)

  useEffect(() => {
    let on = true
    fetch("/api/gmail/reply-patterns?view=cards", { cache: "no-store" })
      .then(r => r.json()).then(j => { if (on && j?.ok && j.counts) setPatternCounts(j.counts) }).catch(() => {})
    fetch("/api/apply/activity", { cache: "no-store" })
      .then(r => r.json()).then(j => {
        if (!on || !Array.isArray(j?.events)) return
        const byJob = new Map<string, PipelineJob>()
        for (const e of j.events) {
          if (e.kind === "search" || !e.url) continue
          const idx = STAGES.indexOf(e.kind as typeof STAGES[number])
          if (idx < 0) continue
          const cur = byJob.get(e.url)
          if (!cur || idx > STAGES.indexOf(cur.stage as typeof STAGES[number])) {
            byJob.set(e.url, { title: e.title, company: e.company, url: e.url, stage: e.kind as PipelineJob["stage"], at: e.at, location: e.location || "" })
          }
        }
        setApplyNeeds(needsYou([...byJob.values()]).length)
      }).catch(() => {})
    return () => { on = false }
  }, [])

  const patternTotal = patternCounts ? patternCounts.needsYou + patternCounts.waiting : null
  return (
    <section aria-label="New in MarketFit" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px", margin: "0 0 18px", boxShadow: "var(--shadow-card)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>New here, in plain words</div>
        <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>
          Reply patterns learn how you answer, and Apply now shows only the jobs still waiting on you.
        </div>
      </div>
      <Link href="/dashboard/mail/patterns" className="btn-accent" style={{ minHeight: 44, padding: "0 18px", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
        See reply patterns{patternTotal != null ? ` (${patternTotal} open)` : ""}
      </Link>
      <Link href="/dashboard/apply" className="btn-outline" style={{ minHeight: 44, padding: "0 18px", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
        Apply: jobs needing you{applyNeeds != null ? ` (${applyNeeds})` : ""}
      </Link>
    </section>
  )
}
