"use client"

// One place that says, for every account, whether it is really connected, exactly what access it
// carries, and which actions run on their own versus wait for Approve. MarketFit owns that boundary;
// a connected account only carries out what is listed here. A row never reports Connected on the
// strength of a button press — only on what the server or the provider actually confirms.

import { useEffect, useState } from "react"
import Link from "next/link"
import { connectGmail } from "@/lib/google-auth"
import { useAnswered } from "../_suite/ui"
import { mails } from "../_suite/sample"
import PageIntro from "../_components/page-intro"

type Status = "checking" | "connected" | "not_connected"
type Policy = "runs" | "approve" | "exception"
type Access = { action: string; policy: Policy; note: string }
type Row = {
  id: "gmail" | "calendar" | "whatsapp" | "linkedin"
  name: string
  scope: string
  status: Status
  detail: string
  access: Access[]
  connect?: () => void
  unavailable?: string
}

const POLICY_LABEL: Record<Policy, string> = {
  runs: "Runs",
  approve: "Waits for Approve",
  exception: "Runs · exception",
}

export default function ConnectionsClient({ whatsappWired }: { whatsappWired: boolean }) {
  const [gmail, setGmail] = useState<{ status: Status; detail: string }>({ status: "checking", detail: "Checking with the server…" })
  const [note, setNote] = useState<Record<string, string>>({})
  const [answered] = useAnswered()
  const waiting = mails.filter(m => m.needsReply && !answered.includes(m.id)).length

  useEffect(() => {
    let live = true
    fetch("/api/gmail-sync", { cache: "no-store" })
      .then(r => r.json())
      .then((d: { connected?: boolean; reason?: string; via?: string }) => {
        if (!live) return
        if (d.connected) setGmail({ status: "connected", detail: d.via === "refresh_token" ? "Connected with a saved Google grant." : "Connected through your Google sign-in." })
        else setGmail({
          status: "not_connected",
          detail: d.reason === "not_logged_in" ? "You are not signed in, so no Google access exists yet." : "No Gmail access has been granted.",
        })
      })
      .catch(() => { if (live) setGmail({ status: "not_connected", detail: "The server could not confirm Gmail access." }) })
    return () => { live = false }
  }, [])

  const say = (id: string, text: string) => setNote(n => ({ ...n, [id]: text }))

  const rows: Row[] = [
    {
      id: "gmail",
      name: "Gmail",
      scope: "Job mail",
      status: gmail.status,
      detail: gmail.detail,
      access: [
        { action: "Read job mail", policy: "runs", note: "Read-only Gmail permission. The only access MarketFit asks Google for." },
        { action: "Label threads", policy: "runs", note: "Not granted. Labelling needs a Gmail permission MarketFit does not request." },
        { action: "Draft replies", policy: "runs", note: "Drafted inside MarketFit. Nothing is written to your Gmail." },
        { action: "Send a reply", policy: "approve", note: "Not granted. MarketFit cannot send from Gmail today." },
      ],
      connect: () => { say("gmail", "Opening Google to ask for read-only mail access…"); void connectGmail("/dashboard/connections") },
    },
    {
      id: "calendar",
      name: "Calendar",
      scope: "Interview invites only",
      status: "not_connected",
      detail: "MarketFit does not request calendar access yet.",
      access: [
        { action: "Read interview invites", policy: "runs", note: "Not granted." },
        { action: "Hold a time as a draft", policy: "runs", note: "Not granted." },
        { action: "Accept or decline an invite", policy: "approve", note: "Not granted. Replies to the organiser, so it would always wait." },
      ],
      unavailable: "Calendar connection is not built yet, so nothing was connected. The Interview Calendar screen shows sample data until it is.",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      scope: "Resume in and out",
      status: whatsappWired ? "connected" : "not_connected",
      detail: whatsappWired
        ? "The resume bot's credentials are set on this server."
        : "The resume bot is not configured on this server.",
      access: [
        { action: "Receive a job description and resume you send", policy: "runs", note: "Only from numbers on the bot's allowlist, when one is set." },
        { action: "Tailor the resume", policy: "runs", note: "The same tailoring engine as the Resume screen." },
        { action: "Send the tailored resume back", policy: "exception", note: "Goes straight back to the number that asked, with no Approve step. It only ever answers your own message." },
      ],
      unavailable: whatsappWired ? undefined : "The WhatsApp bot is set up on the server with Meta's credentials, not from this page, so nothing was connected.",
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      scope: "Saved searches",
      status: "not_connected",
      detail: "MarketFit has no LinkedIn access.",
      access: [
        { action: "Read saved searches", policy: "runs", note: "Not granted." },
        { action: "Apply or message a recruiter", policy: "approve", note: "Not granted. Would always wait for Approve." },
      ],
      unavailable: "LinkedIn connection is not built yet, so nothing was connected.",
    },
  ]

  const linked = [gmail.status === "connected" && "Gmail", whatsappWired && "WhatsApp"].filter(Boolean) as string[]
  const linkedLine = gmail.status === "checking"
    ? (whatsappWired ? "WhatsApp is linked. Checking Gmail now." : "Checking Gmail now. Nothing else is linked.")
    : linked.length
      ? `Only ${linked.join(" and ")} ${linked.length === 1 ? "is" : "are"} linked. Nothing else is.`
      : "Nothing is linked yet."

  return (
    <div style={{ maxWidth: 1000 }}>
      <PageIntro page="/dashboard/connections" action={{ label: "See what is linked", href: "#accounts" }} sample={linkedLine} />

      {/* ── The rule ─────────────────────────────────────────────── */}
      <section style={{
        marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "0.8px solid var(--border-strong)",
        borderBottom: "0.8px solid var(--border-strong)",
      }}>
        <div style={{ padding: "20px 24px 20px 0", borderRight: "0.8px solid var(--border-strong)" }}>
          <div className="ink-label">Goes ahead</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 6 }}>
            Reads, labels and drafts.
          </div>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
            Nothing leaves your hands, so these run without asking.
          </p>
        </div>
        <div style={{ padding: "20px 0 20px 24px" }}>
          <div className="ink-label">Waits for Approve</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 6 }}>
            Anything that sends, deletes or pays.
          </div>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
            {waiting === 0
              ? "Nothing is waiting right now."
              : <>{waiting} {waiting === 1 ? "reply is" : "replies are"} waiting now (sample). Approving one in <Link href="/dashboard/mail" style={{ color: "var(--text)", textDecoration: "underline", textUnderlineOffset: 3 }}>Mail</Link>, Follow-ups or Today clears it everywhere.</>}
          </p>
        </div>
      </section>

      {/* ── Accounts ─────────────────────────────────────────────── */}
      <div id="accounts" style={{ marginTop: 8, scrollMarginTop: 24 }}>
        {rows.map((r, i) => (
          <section key={r.id} aria-labelledby={`conn-${r.id}`} style={{
            display: "grid", gridTemplateColumns: "48px minmax(160px, 220px) minmax(0, 1fr)", gap: 20, padding: "26px 0",
            borderBottom: "0.8px solid var(--border-strong)",
          }}>
            <div aria-hidden style={{ fontFamily: "var(--font-num)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--surface-3)", lineHeight: 1 }}>
              {String(i + 1).padStart(2, "0")}
            </div>

            <div>
              <h2 id={`conn-${r.id}`} style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{r.name}</h2>
              <div className="ink-label" style={{ marginTop: 4 }}>{r.scope}</div>
              <StatusMark status={r.status} />
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "8px 0 0", lineHeight: 1.55 }}>{r.detail}</p>
              {r.status !== "connected" && r.status !== "checking" && (
                <button type="button" className="btn-outline" style={{ marginTop: 12, minHeight: 44, padding: "0 18px", fontSize: 15 }}
                  onClick={() => r.connect ? r.connect() : say(r.id, r.unavailable ?? "")}>
                  Connect
                </button>
              )}
              {note[r.id] && (
                <p role="status" style={{ fontSize: 12.5, color: "var(--text)", margin: "10px 0 0", lineHeight: 1.55, paddingLeft: 10, borderLeft: "2px solid var(--spot)" }}>
                  {note[r.id]}
                </p>
              )}
            </div>

            <div>
              <div className="ink-label" style={{ marginBottom: 6 }}>Access</div>
              {r.access.map(a => (
                <div key={a.action} style={{
                  display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "baseline",
                  padding: "9px 0", borderTop: "1px solid var(--border)",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 550, color: "var(--text)" }}>{a.action}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>{a.note}</div>
                  </div>
                  <PolicyTag policy={a.policy} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function StatusMark({ status }: { status: Status }) {
  const label = status === "connected" ? "Connected" : status === "checking" ? "Checking" : "Not connected"
  const dot = status === "connected" ? "var(--success)" : status === "checking" ? "var(--text-soft)" : "transparent"
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12,
      fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase",
      color: status === "connected" ? "var(--text)" : "var(--text-muted)",
    }}>
      <span style={{ width: 7, height: 7, background: dot, border: status === "not_connected" ? "1px solid var(--text-soft)" : "none" }} />
      {label}
    </div>
  )
}

function PolicyTag({ policy }: { policy: Policy }) {
  const solid = policy === "approve"
  return (
    <span style={{
      fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", whiteSpace: "nowrap",
      padding: "2px 7px",
      background: solid ? "var(--accent)" : "transparent",
      color: solid ? "var(--bg)" : policy === "exception" ? "var(--spot)" : "var(--text-muted)",
      border: `0.8px solid ${solid ? "var(--accent)" : policy === "exception" ? "var(--spot)" : "var(--border-strong)"}`,
    }}>{POLICY_LABEL[policy]}</span>
  )
}
