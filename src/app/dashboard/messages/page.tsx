"use client"

import { useState, useEffect } from "react"

const P = {
  surface: "#ffffff",
  text:    "#1a2035",
  muted:   "#6b7a99",
  hint:    "#9aa4bc",
  border:  "#e4e8ef",
  bg:      "#f4f6f9",
}

interface Message {
  id: string
  contactName: string
  contactTitle: string
  contactCompany: string
  subject: string
  body: string
  direction: "inbound" | "outbound"
  status: "draft" | "sent" | "received" | "replied"
  timestamp: string
  gmailThreadId?: string
  template?: string
}

type TemplateKey = "cold_outreach" | "follow_up" | "thank_you" | "referral_ask" | "reconnect"

const TEMPLATES: Record<TemplateKey, { label: string; subject: string; body: string }> = {
  cold_outreach: {
    label: "Cold Outreach",
    subject: "Exploring {role} opportunities at {company}",
    body: `Hi {name},\n\nI came across your profile and noticed your team at {company} is doing exciting work in {domain}. I'm a {role} professional with {years} years of experience and I'd love to learn more about your team's direction.\n\nWould you be open to a 15-minute chat this week? I've attached my resume for reference.\n\nBest regards,`,
  },
  follow_up: {
    label: "Follow-Up",
    subject: "Following up — {role} at {company}",
    body: `Hi {name},\n\nI wanted to follow up on my previous message about the {role} position at {company}. I remain very interested in the opportunity and believe my background in {domain} would be a strong fit.\n\nHappy to share any additional information or set up a call at your convenience.\n\nBest,`,
  },
  thank_you: {
    label: "Post-Interview Thank You",
    subject: "Thank you — {role} interview",
    body: `Hi {name},\n\nThank you for taking the time to speak with me today about the {role} position. I really enjoyed learning about {company}'s approach to {domain} and hearing about the team's current projects.\n\nOur conversation reinforced my enthusiasm for this opportunity. I look forward to next steps.\n\nBest regards,`,
  },
  referral_ask: {
    label: "Referral Request",
    subject: "Referral request — {role} at {company}",
    body: `Hi {name},\n\nI hope you're doing well! I noticed that {company} has an open {role} position, and I'd love to apply. Would you be comfortable referring me or sharing any insights about the team?\n\nI've been working in {domain} for {years} years and think it could be a great fit.\n\nNo pressure at all — I appreciate any help you can offer!\n\nThanks so much,`,
  },
  reconnect: {
    label: "Reconnect",
    subject: "Catching up!",
    body: `Hi {name},\n\nIt's been a while since we last spoke! I hope all is going well at {company}.\n\nI've been focusing on {domain} work and recently started exploring new opportunities. I'd love to catch up and hear what you've been up to. Are you free for a quick coffee chat?\n\nLooking forward to reconnecting!`,
  },
}

const SEED_MESSAGES: Message[] = [
  {
    id: "m1", contactName: "Sarah Chen", contactTitle: "Technical Recruiter", contactCompany: "Palo Alto Networks",
    subject: "Cloud Security Engineer role — interested in chatting?",
    body: "Hi Eshwar, I came across your profile and think you'd be a strong fit for our Cloud Security team. Are you open to a quick call this week?",
    direction: "inbound", status: "received", timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "m2", contactName: "James Park", contactTitle: "Technical Recruiter", contactCompany: "Stripe",
    subject: "Following up — Staff Security Engineer",
    body: "Hi James, just circling back on the Staff Security Engineer role we discussed. I'm still very interested and wanted to check on next steps.",
    direction: "outbound", status: "sent", timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "m3", contactName: "Alex Torres", contactTitle: "Engineering Manager", contactCompany: "CrowdStrike",
    subject: "DevSecOps Engineer — re: our conference chat",
    body: "Hi Alex, great meeting you at the security conference! I'd love to learn more about your DevSecOps team. I've attached my resume. Free for a 15-min call?",
    direction: "outbound", status: "replied", timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "m4", contactName: "Priya Sharma", contactTitle: "Senior Data Engineer", contactCompany: "Databricks",
    subject: "Re: Data Engineering referral request",
    body: "Thanks Priya! I'd really appreciate if you could pass along my resume for the Data Engineer opening. Here's my latest version attached.",
    direction: "outbound", status: "sent", timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "m5", contactName: "Nexus AI", contactTitle: "Draft", contactCompany: "",
    subject: "Cold outreach — Senior Cloud Security Engineer at CrowdStrike",
    body: "Hi Alex,\n\nI came across your profile and noticed your team at CrowdStrike is doing exciting work in cloud security. I'd love to learn more about your team's direction.\n\nWould you be open to a 15-minute chat?",
    direction: "outbound", status: "draft", timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
]

const STATUS_META = {
  draft:    { label: "Draft",     color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
  sent:     { label: "Sent",      color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  received: { label: "Received",  color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  replied:  { label: "Replied ✓", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
}

function timeAgo(iso: string) {
  const hrs = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (hrs < 1) return "just now"
  if (hrs < 24) return `${hrs}h ago`
  const d = Math.floor(hrs / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2)
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES)
  const [selectedId, setSelectedId] = useState<string>(SEED_MESSAGES[0].id)
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound" | "draft">("all")
  const [showCompose, setShowCompose] = useState(false)
  const [template, setTemplate] = useState<TemplateKey | "">("")
  const [composing, setComposing] = useState({ to: "", subject: "", body: "" })
  const [aiReply, setAiReply] = useState<string | null>(null)
  const [loadingReply, setLoadingReply] = useState(false)

  useEffect(() => {
    try {
      const stored: Message[] = JSON.parse(localStorage.getItem("jd_messages") || "[]")
      if (stored.length) setMessages(stored)
    } catch {}
  }, [])

  function persist(next: Message[]) {
    setMessages(next)
    localStorage.setItem("jd_messages", JSON.stringify(next))
  }

  function applyTemplate(key: TemplateKey) {
    const t = TEMPLATES[key]
    setComposing({ to: "", subject: t.subject, body: t.body })
    setTemplate(key)
  }

  function sendMessage() {
    const m: Message = {
      id: `m-${Date.now()}`,
      contactName: composing.to || "Contact",
      contactTitle: "",
      contactCompany: "",
      subject: composing.subject,
      body: composing.body,
      direction: "outbound",
      status: "sent",
      timestamp: new Date().toISOString(),
    }
    persist([m, ...messages])
    setShowCompose(false)
    setComposing({ to: "", subject: "", body: "" })
    setTemplate("")
  }

  function saveDraft() {
    const m: Message = {
      id: `m-${Date.now()}`,
      contactName: composing.to || "Contact",
      contactTitle: "Draft",
      contactCompany: "",
      subject: composing.subject || "(no subject)",
      body: composing.body,
      direction: "outbound",
      status: "draft",
      timestamp: new Date().toISOString(),
    }
    persist([m, ...messages])
    setShowCompose(false)
    setComposing({ to: "", subject: "", body: "" })
  }

  async function generateAIReply(msg: Message) {
    setLoadingReply(true)
    setAiReply(null)
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "message",
          instruction: `Write a professional, warm 3-4 sentence reply to this recruiter message. Don't start with "I" or "Thank you for reaching out." Be enthusiastic but direct. Message to reply to: "${msg.body}"`,
          current: "",
          claudeKey,
        }),
      })
      const data = await res.json()
      if (data.text) setAiReply(data.text)
    } catch {
      setAiReply("Great to hear from you! I'd love to learn more about this opportunity. Could we set up a 15-minute call this week?")
    }
    setLoadingReply(false)
  }

  const selected = messages.find(m => m.id === selectedId) || messages[0]
  const filtered = messages.filter(m => {
    if (filter === "all") return true
    if (filter === "draft") return m.status === "draft"
    return m.direction === filter
  })

  const unread = messages.filter(m => m.status === "received").length
  const drafts = messages.filter(m => m.status === "draft").length

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", gap: 0, background: P.bg, borderRadius: 16, overflow: "hidden", border: `1px solid ${P.border}` }}>

      {/* ── Left pane ── */}
      <div style={{ width: 300, flexShrink: 0, background: P.surface, borderRight: `1px solid ${P.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${P.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: P.text }}>Messages</h1>
              <p style={{ fontSize: 11.5, color: P.muted }}>{unread > 0 ? `${unread} unread · ` : ""}{drafts} draft{drafts !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={() => { setShowCompose(true); setAiReply(null) }} style={{ padding: "7px 12px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>✏️ Compose</button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["all","inbound","outbound","draft"] as const).map(k => (
              <button key={k} onClick={() => setFilter(k)} style={{ flex: 1, padding: "5px 0", borderRadius: 7, border: "none", background: filter === k ? "#eff6ff" : "transparent", color: filter === k ? "var(--accent)" : P.muted, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const }}>
                {k === "all" ? "All" : k === "inbound" ? "Inbox" : k === "outbound" ? "Sent" : "Drafts"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map(m => {
            const isActive = m.id === selectedId
            const isUnread = m.status === "received"
            return (
              <button key={m.id} onClick={() => { setSelectedId(m.id); setShowCompose(false); setAiReply(null) }}
                style={{ width: "100%", textAlign: "left", padding: "12px 16px", background: isActive ? "#eff6ff" : "transparent", border: "none", borderBottom: `1px solid ${P.border}`, borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: isUnread ? "var(--accent)" : "#e4e8ef", display: "flex", alignItems: "center", justifyContent: "center", color: isUnread ? "#fff" : P.muted, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials(m.contactName)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <p style={{ fontSize: 13, fontWeight: isUnread ? 800 : 600, color: P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{m.contactName}</p>
                      <span style={{ fontSize: 10.5, color: P.hint, flexShrink: 0 }}>{timeAgo(m.timestamp)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: isUnread ? P.text : P.muted, fontWeight: isUnread ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.subject}</p>
                    {m.status === "draft" && <span style={{ fontSize: 10.5, color: "#d97706", fontWeight: 700 }}>Draft</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right pane ── */}
      {showCompose ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: P.surface }}>
          <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: P.text }}>New Message</p>
            <button onClick={() => setShowCompose(false)} style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 12, cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ padding: "10px 24px", borderBottom: `1px solid ${P.border}`, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: P.hint }}>TEMPLATE:</p>
            {(Object.keys(TEMPLATES) as TemplateKey[]).map(k => (
              <button key={k} onClick={() => applyTemplate(k)} style={{ padding: "3px 10px", borderRadius: 20, border: `1.5px solid ${template === k ? "var(--accent)" : P.border}`, background: template === k ? "#eff6ff" : "transparent", color: template === k ? "var(--accent)" : P.muted, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                {TEMPLATES[k].label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: "18px 24px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 4 }}>TO</label>
              <input value={composing.to} onChange={e => setComposing(p => ({ ...p, to: e.target.value }))} placeholder="Recruiter name or email"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 9, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: "none", boxSizing: "border-box" as const }}/>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 4 }}>SUBJECT</label>
              <input value={composing.subject} onChange={e => setComposing(p => ({ ...p, subject: e.target.value }))} placeholder="Subject line"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 9, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: "none", boxSizing: "border-box" as const }}/>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 4 }}>MESSAGE</label>
              <textarea value={composing.body} onChange={e => setComposing(p => ({ ...p, body: e.target.value }))} placeholder="Write your message. Use {name}, {company}, {role}, {domain} as placeholders." rows={12}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, lineHeight: 1.6, resize: "vertical" as const, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" }}/>
            </div>
          </div>

          <div style={{ padding: "14px 24px", borderTop: `1px solid ${P.border}`, display: "flex", gap: 10 }}>
            <button onClick={sendMessage} style={{ padding: "9px 24px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Send ↗</button>
            <button onClick={saveDraft} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save Draft</button>
          </div>
        </div>
      ) : selected ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: P.surface }}>
          <div style={{ padding: "18px 28px 14px", borderBottom: `1px solid ${P.border}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: P.text, marginBottom: 4 }}>{selected.subject}</h2>
                <p style={{ fontSize: 13, color: P.muted }}>
                  {selected.direction === "inbound" ? `From: ${selected.contactName}` : `To: ${selected.contactName}`}
                  {selected.contactCompany && ` · ${selected.contactCompany}`}
                  {selected.contactTitle && selected.contactTitle !== "Draft" && ` · ${selected.contactTitle}`}
                </p>
                <p style={{ fontSize: 11.5, color: P.hint, marginTop: 2 }}>{timeAgo(selected.timestamp)}</p>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: STATUS_META[selected.status].bg, color: STATUS_META[selected.status].color, border: `1px solid ${STATUS_META[selected.status].border}`, flexShrink: 0 }}>
                {STATUS_META[selected.status].label}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            <div style={{ background: selected.direction === "inbound" ? "#f8fbff" : P.bg, border: `1px solid ${P.border}`, borderRadius: 14, padding: "18px 22px", marginBottom: 20, whiteSpace: "pre-wrap", fontSize: 14, color: P.text, lineHeight: 1.7 }}>
              {selected.body}
            </div>

            {selected.direction === "inbound" && (
              <div style={{ background: "#f8fbff", border: "1.5px solid #bfdbfe", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 16 }}>✨</span>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1558a0" }}>AI-Suggested Reply</p>
                  <button onClick={() => generateAIReply(selected)} disabled={loadingReply}
                    style={{ marginLeft: "auto", padding: "4px 11px", borderRadius: 7, background: "#1558a0", color: "#fff", fontSize: 11.5, fontWeight: 700, border: "none", cursor: loadingReply ? "default" : "pointer", opacity: loadingReply ? 0.7 : 1 }}>
                    {loadingReply ? "Drafting…" : aiReply ? "↻ Regenerate" : "Generate Reply"}
                  </button>
                </div>
                {aiReply ? (
                  <>
                    <textarea defaultValue={aiReply} rows={4}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #bfdbfe", fontSize: 13, color: P.text, lineHeight: 1.6, resize: "none" as const, outline: "none", background: "#fff", boxSizing: "border-box" as const, fontFamily: "inherit" }}/>
                    <button style={{ marginTop: 8, padding: "7px 16px", borderRadius: 8, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}
                      onClick={() => persist(messages.map(m => m.id === selected.id ? { ...m, status: "replied" as const } : m))}>
                      Send Reply ↗
                    </button>
                  </>
                ) : (
                  <p style={{ fontSize: 12.5, color: P.muted }}>Click "Generate Reply" to get an AI-drafted response tailored to this message.</p>
                )}
              </div>
            )}
          </div>

          <div style={{ padding: "12px 28px", borderTop: `1px solid ${P.border}`, display: "flex", gap: 8, alignItems: "center" }}>
            {selected.status === "draft" && (
              <button onClick={() => persist(messages.map(m => m.id === selected.id ? { ...m, status: "sent" as const } : m))}
                style={{ padding: "7px 18px", borderRadius: 8, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
                Send ↗
              </button>
            )}
            <button onClick={() => {
              const next = messages.filter(m => m.id !== selected.id)
              persist(next)
              if (next.length) setSelectedId(next[0].id)
            }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", color: "#dc2626", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Delete
            </button>
            {selected.gmailThreadId && (
              <a href={`https://mail.google.com/mail/u/0/#inbox/${selected.gmailThreadId}`} target="_blank" rel="noopener noreferrer"
                style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
                Open in Gmail ↗
              </a>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: P.bg }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: P.text }}>No message selected</p>
            <p style={{ fontSize: 13, color: P.muted, marginTop: 4 }}>Pick a thread or compose a new message.</p>
          </div>
        </div>
      )}
    </div>
  )
}
