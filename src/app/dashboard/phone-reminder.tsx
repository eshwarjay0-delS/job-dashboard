"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export default function PhoneReminder() {
  const pathname = usePathname()
  const [needed, setNeeded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [whatsapp, setWhatsapp] = useState("")

  useEffect(() => {
    let active = true
    fetch("/api/onboarding", { cache: "no-store" }).then(async r => {
      if (!r.ok) return
      const body = await r.json()
      if (active) setNeeded(!body.phone?.verified && body.phone?.note !== "admin")
    }).catch(() => {})
    return () => { active = false }
  }, [pathname])

  async function submit() {
    setBusy(true); setMessage("")
    try {
      const r = await fetch(`/api/identity/phone/${sent ? "confirm" : "start"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, ...(sent ? { code, whatsappOptIn: true } : {}) }),
      })
      const body = await r.json()
      if (!r.ok) { setMessage(body.error || "Please try again shortly."); return }
      if (!sent) { setSent(true); setMessage("Enter the code sent to your phone."); return }
      setNeeded(false); setCode(""); setEditing(false)
      setWhatsapp(String(body.whatsappNumber || "").replace(/\D/g, ""))
      setMessage("Your number is verified.")
    } catch { setMessage("Unable to connect. Try again, or choose Later.") }
    finally { setBusy(false) }
  }

  if (pathname === "/dashboard/setup" || dismissed || (!needed && !message)) return null
  return <section aria-label="Phone verification reminder" style={{ padding: 16, marginBottom: 20, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
    {needed && <p>Verify your mobile number to send your resume and job description to MFit on WhatsApp. You can do this later; we will remind you when you return.</p>}
    {needed && !editing && <button type="button" onClick={() => setEditing(true)}>Verify now</button>}
    {needed && editing && <form onSubmit={e => { e.preventDefault(); void submit() }} style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <label>Mobile number <input type="tel" autoComplete="tel" placeholder="+1 314 555 0100" value={phone} disabled={sent || busy} required onChange={e => setPhone(e.target.value)} /></label>
      {sent && <label>Verification code <input inputMode="numeric" autoComplete="one-time-code" value={code} required onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))} /></label>}
      <button disabled={busy} type="submit">{busy ? "Please wait…" : sent ? "Verify" : "Send code"}</button>
      {sent && <button type="button" disabled={busy} onClick={() => { setSent(false); setCode(""); setMessage("") }}>Change number or resend</button>}
    </form>}
    <button type="button" disabled={busy} onClick={() => setDismissed(true)} style={{ marginLeft: 12 }}>{needed ? "Later" : "Close"}</button>
    {message && <p role="status">{message}</p>}
    {whatsapp && <p>Message <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">MFit at +{whatsapp}</a> from your verified number. Send your resume and job description to receive a tailored resume.</p>}
  </section>
}
