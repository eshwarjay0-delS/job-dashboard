"use client"

import { useState, useEffect } from "react"
import { Lock, BarChart3, Users, Megaphone, Settings as SettingsIcon, X, FileText, Check, Zap, AlertCircle } from "lucide-react"

// ── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0b1220",
  card:   "#111827",
  card2:  "#141f30",
  border: "rgba(255,255,255,.07)",
  text:   "#f0f4ff",
  muted:  "#8892a8",
  hint:   "#4b5568",
  accent: "#3b82f6",
  teal:   "#14b8a6",
  green:  "#60a5fa",
  amber:  "#f59e0b",
  red:    "#ef4444",
  purple: "#8b5cf6",
}

// ── Gate ─────────────────────────────────────────────────────────────────────
// Credentials are validated SERVER-SIDE only (POST /api/admin/auth), which reads
// ADMIN_USERNAME / ADMIN_PASSWORD from env (local-dev fallback lives in the route)
// and sets a real httpOnly signed cookie. GET /api/admin/config re-verifies that
// cookie server-side on every load — the client never trusts its own state alone.

// ── Dummy data (candidates only — no real candidate store yet) ──────────────────
const MOCK_CANDIDATES = [
  { id: "c1", name: "Eshwar J.", email: "eshwarjay0@gmail.com", visaType: "H1B", stage: "Active", resumes: 3, applications: 18, lastActive: "Today" },
  { id: "c2", name: "Priya R.", email: "priya.r@example.com", visaType: "OPT", stage: "Active", resumes: 2, applications: 11, lastActive: "Yesterday" },
  { id: "c3", name: "Ahmed K.", email: "ahmed.k@example.com", visaType: "GC", stage: "Inactive", resumes: 1, applications: 4, lastActive: "1 week ago" },
  { id: "c4", name: "Mei L.", email: "mei.l@example.com", visaType: "CPT", stage: "Active", resumes: 2, applications: 7, lastActive: "Today" },
]

type Candidate = typeof MOCK_CANDIDATES[0]
interface PostLink { id: string; url: string; label: string; date: string; enabled: boolean }

// ── Stat card ─────────────────────────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "18px 20px",
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
    </div>
  )
}

// ── Login wall ────────────────────────────────────────────────────────────────
function LoginWall({ onAuth }: { onAuth: () => void }) {
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [err, setErr]   = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr("")
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass }),
      })
      if (res.ok) {
        // Real session lives in the httpOnly cookie the server just set —
        // nothing to store client-side. onAuth() just flips local UI state.
        onAuth()
      } else {
        setErr("Invalid credentials")
      }
    } catch {
      setErr("Couldn't reach the server — try again")
    }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "60vh",
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: "40px 36px", width: "100%", maxWidth: 380,
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: C.purple }}><Lock size={30}/></div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Admin Panel</h2>
          <p style={{ fontSize: 13, color: C.muted, margin: "6px 0 0" }}>Staffing operations — restricted access</p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            placeholder="Username"
            value={user}
            onChange={e => setUser(e.target.value)}
            style={{
              padding: "11px 14px", borderRadius: 10, background: "#0d1929",
              border: `1px solid ${C.border}`, color: C.text, fontSize: 14, outline: "none",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            style={{
              padding: "11px 14px", borderRadius: 10, background: "#0d1929",
              border: `1px solid ${C.border}`, color: C.text, fontSize: 14, outline: "none",
            }}
          />
          {err && <div style={{ fontSize: 12, color: C.red, textAlign: "center" }}>{err}</div>}
          <button
            type="submit"
            style={{
              padding: "12px", borderRadius: 10, background: C.accent,
              color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
              boxShadow: `0 4px 16px ${C.accent}44`,
            }}
          >Sign In →</button>
        </form>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
// Posts persist server-side via /api/admin/config (a real shared JSON store,
// cookie-authenticated) — every admin session now reads/writes the same data,
// unlike the old localStorage version which was invisible to anyone but the
// browser/device that wrote it. Not yet consumed by any candidate-facing page
// (no "Contract Board → Posts" tab exists) — that's a separate follow-up.
function AdminContent() {
  const [tab, setTab] = useState<"overview" | "candidates" | "posts" | "settings">("overview")
  const [posts, setPosts] = useState<PostLink[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [newUrl, setNewUrl]   = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [candidates] = useState<Candidate[]>(MOCK_CANDIDATES)

  useEffect(() => {
    fetch("/api/admin/config")
      .then(r => r.ok ? r.json() : { config: { postLinks: [] } })
      .then(d => setPosts(d.config?.postLinks ?? []))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false))
  }, [])

  async function savePosts(next: PostLink[]) {
    setPosts(next) // optimistic
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postLinks: next }),
      })
      if (res.ok) {
        const d = await res.json()
        setPosts(d.config?.postLinks ?? next)
      }
    } catch {}
  }

  function addPost() {
    if (!newUrl.trim()) return
    const p: PostLink = {
      id: `p${Date.now()}`, url: newUrl.trim(), label: newLabel.trim() || "Untitled Post",
      date: new Date().toISOString().slice(0, 10), enabled: true,
    }
    savePosts([p, ...posts])
    setNewUrl(""); setNewLabel("")
  }

  function togglePost(id: string) {
    savePosts(posts.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))
  }
  function removePost(id: string) {
    savePosts(posts.filter(p => p.id !== id))
  }

  const TABS = [
    { id: "overview",    label: "Overview",      Icon: BarChart3 },
    { id: "candidates",  label: "Candidates",    Icon: Users },
    { id: "posts",       label: "Posts Manager", Icon: Megaphone },
    { id: "settings",    label: "Settings",      Icon: SettingsIcon },
  ] as const

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
          }}><SettingsIcon size={17}/></div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Admin Panel</h1>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
              Staffing operations · Candidate management · Post feed control
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
              background: "rgba(239,68,68,.15)", color: C.red, border: "1px solid rgba(239,68,68,.25)",
              textTransform: "uppercase",
            }}>Restricted</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 24,
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 4,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: tab === t.id ? C.purple : "transparent",
              color: tab === t.id ? "#fff" : C.muted,
              transition: "all .15s",
            }}
          ><t.Icon size={14}/> {t.label}</button>
        ))}
      </div>

      {/* Content */}
      {tab === "overview" && (
        <div>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            <Stat label="Active Candidates" value={candidates.filter(c => c.stage === "Active").length} color={C.green} />
            <Stat label="Total Applications" value={candidates.reduce((a,c) => a + c.applications, 0)} color={C.accent} />
            <Stat label="Active Posts" value={posts.filter(p => p.enabled).length} color={C.amber} />
            <Stat label="Resumes Generated" value={candidates.reduce((a,c) => a + c.resumes, 0)} color={C.teal} />
          </div>

          {/* Recent activity */}
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 14px" }}>Recent Activity</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { Icon: FileText,   msg: "Eshwar J. generated OT Security resume", time: "2m ago" },
                { Icon: Check,      msg: "Priya R. submitted application to TCS (W2 DevOps)", time: "14m ago" },
                { Icon: Megaphone,  msg: "New recruiter post added: Infosys DevOps C2C", time: "1h ago" },
                { Icon: Zap,        msg: "Mei L. autofilled Greenhouse application", time: "2h ago" },
                { Icon: AlertCircle, msg: "Ahmed K. account marked inactive (7 days idle)", time: "1d ago" },
              ].map((a,i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,.03)",
                }}>
                  <span style={{ flexShrink: 0, color: C.muted, display: "flex" }}><a.Icon size={15}/></span>
                  <span style={{ fontSize: 13, color: "#cbd5e1", flex: 1 }}>{a.msg}</span>
                  <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "candidates" && (
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>
              Candidates ({candidates.length})
            </h3>
            <button style={{
              padding: "8px 16px", borderRadius: 8, background: C.accent,
              color: "#fff", fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer",
            }}>+ Add Candidate</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {candidates.map(c => (
              <div key={c.id} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: "16px 18px",
                display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto auto",
                alignItems: "center", gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{c.email}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                  background: c.visaType === "H1B" ? "rgba(59,130,246,.15)" :
                               c.visaType === "OPT" ? "rgba(20,184,166,.15)" :
                               c.visaType === "GC"  ? "rgba(34,197,94,.15)"  : "rgba(245,158,11,.15)",
                  color: c.visaType === "H1B" ? "#60a5fa" :
                         c.visaType === "OPT" ? "#2dd4bf" :
                         c.visaType === "GC"  ? "#93c5fd" : "#fbbf24",
                  border: "1px solid rgba(255,255,255,.08)",
                }}>{c.visaType}</span>
                <span style={{
                  fontSize: 11, padding: "3px 8px", borderRadius: 6,
                  background: c.stage === "Active" ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.04)",
                  color: c.stage === "Active" ? C.green : C.muted,
                }}>{c.stage}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{c.resumes} resumes</span>
                <span style={{ fontSize: 12, color: C.muted }}>{c.applications} apps</span>
                <span style={{ fontSize: 11, color: C.hint }}>{c.lastActive}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{
                    padding: "5px 10px", borderRadius: 6, background: "rgba(59,130,246,.12)",
                    color: C.accent, border: "1px solid rgba(59,130,246,.2)",
                    cursor: "pointer", fontSize: 11, fontWeight: 600,
                  }}>Edit</button>
                  <button style={{
                    padding: "5px 10px", borderRadius: 6, background: "rgba(239,68,68,.1)",
                    color: C.red, border: "1px solid rgba(239,68,68,.2)",
                    cursor: "pointer", display: "flex", alignItems: "center",
                  }}><X size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "posts" && (
        <div>
          {/* Add new post */}
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: "20px", marginBottom: 20,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 14px" }}>
              Add Recruiter Post Link
            </h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="LinkedIn post URL"
                style={{
                  flex: 2, minWidth: 220, padding: "10px 14px", borderRadius: 10,
                  background: "#0d1929", border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 13, outline: "none",
                }}
              />
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Label (e.g. TCS Java W2)"
                style={{
                  flex: 1, minWidth: 140, padding: "10px 14px", borderRadius: 10,
                  background: "#0d1929", border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 13, outline: "none",
                }}
              />
              <button
                onClick={addPost}
                style={{
                  padding: "10px 20px", borderRadius: 10, background: C.teal,
                  color: "#fff", fontWeight: 700, fontSize: 13, border: "none",
                  cursor: "pointer",
                }}
              >+ Add</button>
            </div>
            <p style={{ fontSize: 11, color: C.hint, margin: "10px 0 0" }}>
              Saved here for every admin who logs in — not yet surfaced on the Contract Board (no "Posts" tab exists there yet).
            </p>
          </div>

          {/* Existing posts */}
          {postsLoading && (
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Loading posts…</p>
          )}
          {!postsLoading && posts.length === 0 && (
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>No posts yet — add one above.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {posts.map(p => (
              <div key={p.id} style={{
                background: C.card, border: `1px solid ${p.enabled ? C.border : "rgba(255,255,255,.03)"}`,
                borderRadius: 12, padding: "14px 18px",
                display: "flex", alignItems: "center", gap: 14,
                opacity: p.enabled ? 1 : 0.5,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{p.label}</div>
                  <div style={{
                    fontSize: 11, color: C.hint, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{p.url}</div>
                </div>
                <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{p.date}</span>
                <button
                  onClick={() => togglePost(p.id)}
                  style={{
                    padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                    background: p.enabled ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.06)",
                    color: p.enabled ? C.green : C.muted,
                  }}
                >{p.enabled ? "● Live" : "○ Off"}</button>
                <button
                  onClick={() => removePost(p.id)}
                  style={{
                    padding: "5px 10px", borderRadius: 7, background: "rgba(239,68,68,.1)",
                    color: C.red, border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                  }}
                ><X size={13}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            {
              title: "API Keys",
              desc: "Manage OpenRouter, JSearch, and other API integrations.",
              action: "Configure →",
              color: C.accent,
            },
            {
              title: "Email / SMTP",
              desc: "Configure outbound email for alerts and weekly summaries.",
              action: "Configure →",
              color: C.teal,
            },
            {
              title: "Candidate Onboarding",
              desc: "Set onboarding template: which resume template to start with, default visa filter, email prefix.",
              action: "Manage →",
              color: C.purple,
            },
            {
              title: "Export All Data",
              desc: "Download all candidate profiles, applications, and resumes as a ZIP.",
              action: "Export →",
              color: C.amber,
            },
            {
              title: "Danger Zone",
              desc: "Reset all application data. This cannot be undone.",
              action: "Reset Data",
              color: C.red,
            },
          ].map(s => (
            <div key={s.title} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "18px 20px", display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{s.desc}</div>
              </div>
              <button style={{
                padding: "8px 16px", borderRadius: 8,
                background: `${s.color}18`, color: s.color,
                border: `1px solid ${s.color}30`,
                cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}>{s.action}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  // `authed` gates rendering; `checked` avoids flashing the login form before
  // we've confirmed the real server-side cookie session. The httpOnly `mf_admin`
  // cookie set by POST /api/admin/auth can't be read from JS, so the only way
  // to know if this browser is really authenticated is to ask the server —
  // sessionStorage alone (the old gate) was spoofable via devtools.
  const [authed, setAuthed] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    fetch("/api/admin/config")
      .then(r => setAuthed(r.ok))
      .catch(() => setAuthed(false))
      .finally(() => setChecked(true))
  }, [])

  if (!checked) return null
  if (!authed) return <LoginWall onAuth={() => setAuthed(true)} />
  return <AdminContent />
}
