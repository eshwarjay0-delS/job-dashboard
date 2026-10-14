"use client"

// Setup as a conversation: one question at a time, phone verification first.
//
// Updated 14 Oct 2026: verify the mobile number first, then offer resume-based profile setup.
// The page holds no answers of its own. Every answer goes to /api/onboarding and the page draws what comes back, so a
// reload, or the trip to Google and back, lands on the same question.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { useRouter } from "next/navigation"

// The page's own palette, in theme tokens. It was six literal paper colours, so on the night the card stayed white with
// night-coloured fields inside it (the owner, 8 Oct 2026: "The Entrance white colors alone is cute poop").
const P = {
  surface: "var(--surface)", text: "var(--text)", muted: "var(--text-muted)",
  hint: "var(--text-soft)", border: "var(--border)", bg: "var(--surface)",
}

type Contact = { name: string; title: string; email: string; phone: string; location: string; linkedin: string }
type Domain = { id: string; label: string; branches: string[] }
type Step = "resume" | "confirm" | "phone" | "gmail" | "roles" | "done"
type State = {
  ok: boolean; step: Step; steps: Step[]; hello: string; already?: boolean
  resumeName: string; read: Contact | null; consent: "" | "yes" | "no"
  phone: { verified: boolean; required: boolean; note: string; suggested: string; whatsappNumber: string }
  gmail: { inboxes: number; canAdd: boolean }
  roles: { domains: Domain[]; domain: string; branches: string[]; suggested: { domain: string; branches: string[] } | null }
}

function normalizeUsPhone(input: string) {
  const raw = input.trim()
  // The same rule as the server (src/lib/phoneVerify.ts): "+1 (314) 255-9156" is an international number once its spaces,
  // brackets, dots and dashes are gone; written with a +, it is that number or it is refused.
  const compact = raw.replace(/[\s().-]/g, "")
  if (compact.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null
  const digits = raw.replace(/\D/g, "")
  if (/^[2-9]\d{9}$/.test(digits)) return `+1${digits}`
  if (/^1[2-9]\d{9}$/.test(digits)) return `+${digits}`
  return null
}

const bubble: CSSProperties = { maxWidth: "min(560px, 88%)", padding: "12px 16px", borderRadius: 16, fontSize: 15.5, lineHeight: 1.55, overflowWrap: "anywhere" }
const primary: CSSProperties = { minHeight: 46, padding: "0 20px", borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }
const plain: CSSProperties = { minHeight: 46, padding: "0 18px", borderRadius: 12, border: `1px solid ${P.border}`, background: P.surface, color: P.text, fontSize: 15, fontWeight: 600, cursor: "pointer" }
const field: CSSProperties = { minHeight: 46, padding: "0 14px", borderRadius: 12, border: `1px solid ${P.border}`, background: P.bg, color: P.text, fontSize: 16, minWidth: 0, flex: "1 1 180px" }

function Bot({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "flex-start" }}><div style={{ ...bubble, background: P.surface, border: `1px solid ${P.border}`, color: P.text, borderBottomLeftRadius: 6 }}>{…837 tokens truncated…heck your connection and try again."); return false }
    finally { setBusy(false) }
  }

  async function sendResume(file: File | undefined | null) {
    if (!file) return
    if (!/\.(docx|pdf)$/i.test(file.name)) { setNote("Send your resume as a Word file (.docx) or a PDF."); return }
    setBusy(true); setNote("")
    try {
      const fd = new FormData(); fd.append("file", file)
      const r = await fetch("/api/onboarding/resume", { method: "POST", body: fd })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setNote(j.error || "The file could not be sent. Try again.")
      else if (!j.read) setNote(j.readable ? "I kept your file, but could not find your name or contact details in it. You can send another file, or carry on and fill your profile in yourself." : "I kept your file, but could not read any words in it (it may be a scan). Send a Word file, or carry on and fill your profile in yourself.")
      await load()
    } catch { setNote("The file could not be sent. Check your connection and try again.") }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = "" }
  }

  async function textCode() {
    const number = normalizeUsPhone(phone)
    if (!number) { setNote("Enter a US mobile number, or a number from another country starting with + and its country code."); return }
    setBusy(true); setNote("")
    try {
      const r = await fetch("/api/identity/phone/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: number }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setNote(j.error || "The code could not be sent. Try again in a moment.")
      else { setPhone(number); setCodeSent(true) }
    } catch { setNote("The code could not be sent. Check your connection and try again.") }
    finally { setBusy(false) }
  }

  async function checkCode() {
    setBusy(true); setNote("")
    try {
      const r = await fetch("/api/identity/phone/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: normalizeUsPhone(phone) || phone.trim(), code: code.trim(), whatsappOptIn: true }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setNote(j.error || "That code did not match. Try again.")
      else { setCode(""); setCodeSent(false) }
      await load()
    } catch { setNote("The code could not be checked. Check your connection and try again.") }
    finally { setBusy(false) }
  }

  async function connectGoogle() {
    setBusy(true)
    try { const { connectGmail } = await import("@/lib/google-auth"); await connectGmail() } catch { setBusy(false); setNote("Google could not be opened. Try again.") }
  }

  async function finish() {
    if (!(await send("finish"))) return
    // Other pages still read these from the browser; they are given what the server now holds.
    try {
      const { profile } = await fetch("/api/profile", { cache: "no-store" }).then(r => r.json())
      if (profile) localStorage.setItem("jd_profile", JSON.stringify({ full_name: profile.full_name || "", title: profile.title || "", email: profile.email || "", location: profile.location || "", linkedin: profile.linkedin || "", phone: profile.phone || "", phoneVerified: !!profile.phone_verified, targetRoles: Array.isArray(profile.open_to_roles) ? profile.open_to_roles : [] }))
    } catch { /* the pages fall back to the server */ }
    router.replace("/dashboard")
  }

  if (!s) return <div role="status" aria-live="polite" style={{ maxWidth: 720, margin: "0 auto", padding: 24, color: P.muted, fontSize: 15 }}>{note || "Getting things ready…"}</div>

  // Someone already set up has nothing to answer here.
  if (s.already) return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <Bot>You are already set up{s.hello ? `, ${s.hello}` : ""}. There is nothing more I need. To change your details, open your <a href="/dashboard/profile" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>Profile page</a>.</Bot>
      <Row><a href="/dashboard" style={{ ...primary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Open MarketFit</a></Row>
    </div>
  )

  const at = s.steps.indexOf(s.step)
  const past = (step: Step) => s.steps.indexOf(step) < at
  const now = (step: Step) => s.step === step
  const chosen = s.roles.domains.find(d => d.id === domain)
  const suggested = s.roles.suggested && s.roles.suggested.domain === domain ? s.roles.suggested.branches : []
  const asked = ["phone", "resume", "gmail", "roles"] as Step[]
  const question = Math.min(asked.length, asked.filter(q => s.steps.indexOf(q) <= at).length)
  const details: [string, string][] = s.read ? ([["Name", s.read.name], ["Title", s.read.title], ["Email", s.read.email], ["Mobile", s.read.phone], ["Location", s.read.location], ["LinkedIn", s.read.linkedin]] as [string, string][]).filter(([, v]) => !!v) : []

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14, paddingBottom: 40 }}>
      <p style={{ margin: 0, fontSize: 13.5, color: P.hint }}>{s.step === "done" ? "All questions answered" : `Question ${question} of ${asked.length}`}</p>

      <div role="log" aria-live="polite" aria-label="Setting up your account" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* 1. The resume */}
        <Bot>Welcome{s.hello ? `, ${s.hello}` : ""}. I will set you up in about two minutes, and I will only ask what I need.</Bot>
        {/* 3. The mobile number, which connects WhatsApp */}
        {(now("phone") || past("phone")) && (s.phone.required || s.phone.verified
          ? <Bot>First, which mobile number would you like to register? I will text you a code to verify it. Use your WhatsApp number so you can send MFit your resume and a job description.</Bot>
          : <Bot>{s.phone.note === "admin" ? "You run this site, so your mobile number is not needed to carry on." : "A code cannot be texted right now, so we will leave your mobile number for later."} You can connect WhatsApp at any time from the WhatsApp page, with one message.</Bot>)}
        {now("phone") && s.phone.note === "unavailable" && <Bot>Text verification is temporarily unavailable. Choose Later to continue. We will remind you at the start of your next visit.</Bot>}
        {now("phone") && s.phone.required && !codeSent && (
          <Row>
            <input style={field} type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 314 555 0100" aria-label="Mobile number" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void textCode() }} />
            <button type="button" style={primary} disabled={busy || !phone.trim()} onClick={() => { void textCode() }}>{busy ? "Sending…" : "Text me a code"}</button>
          </Row>
        )}
        {now("phone") && s.phone.required && codeSent && (
          <>
            <Me>{phone}</Me>
            <Bot>Sent. Type the code from the text message.</Bot>
            <Row>
              <input style={{ ...field, flex: "0 1 160px", letterSpacing: 3 }} inputMode="numeric" autoComplete="one-time-code" placeholder="Code" aria-label="Code from the text message" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={e => { if (e.key === "Enter" && code.length >= 4) void checkCode() }} />
              <button type="button" style={primary} disabled={busy || code.length < 4} onClick={() => { void checkCode() }}>{busy ? "Checking…" : "Verify"}</button>
              <button type="button" style={plain} disabled={busy} onClick={() => { setCodeSent(false); setCode("") }}>Change the number</button>
            </Row>
          </>
        )}
        {now("phone") && <Row><button type="button" style={primary} disabled={busy} onClick={() => { void send("phone_later") }}>Later</button></Row>}
        {past("phone") && <Me>{s.phone.verified ? "Verified" : "Later"}</Me>}

        {s.phone.verified && <Bot>{s.phone.whatsappNumber
          ? <>Your number is verified. Message MFit at <a href={`https://wa.me/${s.phone.whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>+{s.phone.whatsappNumber.replace(/\D/g, "")}</a> from your registered number. Send your resume as a PDF or Word file and the job description; MFit will send back a tailored resume.</>
          : <>Your number is verified. The MFit WhatsApp contact is temporarily unavailable. Check the WhatsApp page later.</>}</Bot>}

        {(now("resume") || past("resume")) && <Bot>Next, your resume: a Word file or a PDF. I read your details from it, so you do not have to type them.</Bot>}
        {now("resume") && (
          <Row>
            <input ref={fileRef} id="setup-resume" type="file" className="sr-only" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
              onChange={e => { void sendResume(e.target.files?.[0]) }} />
            <label htmlFor="setup-resume" style={{ ...primary, display: "inline-flex", alignItems: "center", opacity: busy ? 0.6 : 1 }}>{busy ? "Reading it…" : "Choose my resume"}</label>
            <button type="button" style={plain} disabled={busy} onClick={() => { void send("decline_resume") }}>I do not have it with me</button>
          </Row>
        )}
        {past("resume") && <Me>{s.resumeName || "I do not have it with me"}</Me>}

        {/* 2. May the profile be filled from it? */}
        {s.read && details.length > 0 && (now("confirm") || past("confirm")) && (
          <Bot>
            <span>Here is what I read from it:</span>
            <span style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", margin: "10px 0" }}>
              {details.map(([k, v]) => <span key={k} style={{ display: "contents" }}><span style={{ color: P.muted }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></span>)}
            </span>
            <span>Shall I fill your profile with this?</span>
          </Bot>
        )}
        {now("confirm") && (
          <Row>
            <button type="button" style={primary} disabled={busy} onClick={() => { void send("use_resume") }}>Yes, use it</button>
            <button type="button" style={plain} disabled={busy} onClick={() => { void send("decline_resume") }}>No, I will fill it in myself</button>
            <label htmlFor="setup-resume-again" style={{ fontSize: 14, color: P.muted, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>Send a different file</label>
            <input id="setup-resume-again" type="file" className="sr-only" accept=".docx,.pdf" onChange={e => { void sendResume(e.target.files?.[0]) }} />
          </Row>
        )}
        {past("confirm") && s.read && details.length > 0 && <Me>{s.consent === "yes" ? "Yes, use it" : "No, I will fill it in myself"}</Me>}
        {past("confirm") && s.consent === "no" && <Bot>No problem. Your <a href="/dashboard/profile" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>Profile page</a> is there whenever you want to fill it in.</Bot>}

        {/* 4. Gmail: every inbox in one place */}
        {(now("gmail") || past("gmail")) && <Bot>Now Gmail. Connect it and your job mail is in one place here. You can add more than one inbox.</Bot>}
        {now("gmail") && s.gmail.inboxes > 0 && <Bot>{s.gmail.inboxes === 1 ? "One inbox is connected." : `${s.gmail.inboxes} inboxes are connected.`} Add another, or carry on.</Bot>}
        {now("gmail") && (
          <Row>
            {s.gmail.canAdd && (
              <button type="button" disabled={busy} onClick={() => { void connectGoogle() }} style={{ ...(s.gmail.inboxes ? plain : primary), display: "inline-flex", alignItems: "center", gap: 10, ...(s.gmail.inboxes ? {} : { background: P.surface, color: P.text, boxShadow: "0 1px 3px rgba(12,11,8,.12), 0 0 0 1px rgba(12,11,8,.08)" }) }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#888471"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#938f7a"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#c6c0b0"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#7f7c69"/></svg>
                {s.gmail.inboxes ? "Add another inbox" : "Connect Gmail"}
              </button>
            )}
            {s.gmail.inboxes > 0
              ? <button type="button" style={primary} disabled={busy} onClick={() => { void send("gmail_done") }}>Carry on</button>
              : <button type="button" style={plain} disabled={busy} onClick={() => { void send("gmail_done") }}>Not now</button>}
          </Row>
        )}
        {past("gmail") && <Me>{s.gmail.inboxes ? (s.gmail.inboxes === 1 ? "One inbox connected" : `${s.gmail.inboxes} inboxes connected`) : "Not now"}</Me>}

        {/* 5. The kind of work, then its branches */}
        {(now("roles") || past("roles")) && <Bot>Last one. What kind of work are you looking for?</Bot>}
        {now("roles") && <Row>{s.roles.domains.map(d => <Chip key={d.id} on={domain === d.id} onClick={() => { setDomain(d.id); setTicked(d.id === s.roles.suggested?.domain ? s.roles.suggested.branches : []) }}>{d.label}</Chip>)}</Row>}
        {now("roles") && chosen && (
          <>
            <Me>{chosen.label}</Me>
            <Bot>Which parts of {chosen.label.toLowerCase()}? Tick every one that fits.{suggested.length ? " I ticked the ones your resume points to." : ""}</Bot>
            <Row>{chosen.branches.map(b => <Chip key={b} on={ticked.includes(b)} onClick={() => setTicked(t => (t.includes(b) ? t.filter(x => x !== b) : t.length < 12 ? [...t, b] : t))}>{b}</Chip>)}</Row>
            <Row><button type="button" style={primary} disabled={busy || !ticked.length} onClick={() => { void send("roles", { domain, branches: ticked }) }}>{ticked.length ? `Done: ${ticked.length} ticked` : "Tick at least one"}</button></Row>
          </>
        )}
        {past("roles") && <Me>{(s.roles.domains.find(d => d.id === s.roles.domain)?.label || "")}: {s.roles.branches.join(", ")}</Me>}

        {/* Done */}
        {now("done") && (
          <>
            <Bot>That is everything I need. LinkedIn search comes later and needs nothing from you now. Your resumes are in Files, and each one made for a job is saved there by its kind of work.</Bot>
            <Row><button type="button" style={primary} disabled={busy} onClick={() => { void finish() }}>{busy ? "Opening…" : "Open MarketFit"}</button></Row>
          </>
        )}
      </div>

      {note && <p role="alert" style={{ margin: 0, padding: "10px 14px", borderRadius: 12, border: `1px solid ${P.border}`, background: P.bg, color: P.text, fontSize: 14.5, lineHeight: 1.5 }}>{note}</p>}
      <div ref={end} />
    </div>
  )
}
