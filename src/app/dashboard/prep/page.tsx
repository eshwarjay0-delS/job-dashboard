"use client"

import { useState } from "react"
import Link from "next/link"
import { Mic, Check, MessageSquare } from "lucide-react"
import { Card, Meta } from "../_suite/ui"
import PageIntro from "../_components/page-intro"
import { interviews, prepQuestions, onsiteChecklist, fmtHour, WEEK_DAYS, WEEK_DATES } from "../_suite/sample"

// Kompas is a full page served by MarketFit itself (next.config.js), not a Next route, so it is
// reached with a plain link: client-side navigation would look for a React page that is not there.
const KOMPAS_PATH = "/dashboard/kompas"

export default function PrepPage() {
  const next = interviews.filter(i => i.day >= 2).sort((a, b) => a.day - b.day || a.start - b.start)[0]!
  const [open, setOpen] = useState<string | null>(prepQuestions[0]!.id)
  const [checks, setChecks] = useState(onsiteChecklist)

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <PageIntro page="/dashboard/prep" action={{ label: "Practice the questions", href: "#questions" }}
        sample="The interview and questions here are made-up examples." />

      <Card style={{ padding: "20px 20px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
        <Meta>During the call</Meta>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4 }}>Kompas</div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 620 }}>
          Kompas listens to the interviewer and shows a short answer while you talk. It opens full screen here in MarketFit.
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
          <a href={KOMPAS_PATH} className="btn-accent"
            style={{ minHeight: 40, padding: "0 18px", fontSize: 14.5, textDecoration: "none" }}>
            <Mic size={15} /> Open Kompas
          </a>
        </div>
      </Card>

      <Card>
        <Meta>Next interview</Meta>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>{next.company}</div>
        <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          {next.role} · {WEEK_DAYS[next.day]} {WEEK_DATES[next.day]} · {fmtHour(next.start)} – {fmtHour(next.end)} · {next.kind} · {next.with}
        </div>
      </Card>

      <Card id="questions" style={{ scrollMarginTop: 24 }}>
        <Meta>Likely questions</Meta>
        <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--text-muted)" }}>
          Tap a question to see a tip. Say the first sentence of your answer out loud.
        </p>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 10 }}>
          {prepQuestions.map((q, i) => (
            <div key={q.id} style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
              <button type="button" onClick={() => setOpen(open === q.id ? null : q.id)} aria-expanded={open === q.id}
                style={{ width: "100%", display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", font: "inherit" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-soft)", width: 96, flexShrink: 0, paddingTop: 2, textTransform: "uppercase", letterSpacing: ".06em" }}>{q.kind}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: "var(--text)" }}>{q.q}</span>
              </button>
              {open === q.id && (
                <div style={{ margin: "0 0 12px 108px", padding: "10px 12px", borderRadius: "var(--radius-lg)", background: "var(--surface-2)", fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>
                  {q.tip}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {next.kind === "Onsite" && (
        <Card>
          <Meta>Before you leave</Meta>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {checks.map(c => (
              <button key={c.id} type="button" role="checkbox" aria-checked={c.done}
                onClick={() => setChecks(xs => xs.map(x => x.id === c.id ? { ...x, done: !x.done } : x))}
                style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", cursor: "pointer", padding: 0, font: "inherit", textAlign: "left" }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1.5px solid ${c.done ? "var(--accent)" : "var(--border-strong)"}`, background: c.done ? "var(--accent)" : "transparent",
                }}>{c.done && <Check size={12} color="#fff" />}</span>
                <span style={{ fontSize: 13.5, color: c.done ? "var(--text-soft)" : "var(--text)", textDecoration: c.done ? "line-through" : "none" }}>{c.label}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text-muted)", padding: "0 4px" }}>
        <MessageSquare size={15} />
        Want to rehearse first? <Link href="/dashboard/mock-interview" style={{ color: "var(--text)", fontWeight: 600 }}>Run a mock interview</Link>
      </div>
    </div>
  )
}
