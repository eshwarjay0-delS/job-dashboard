"use client"

// The employer blocklist request form. The server checks every field again (src/lib/blocklist-request.ts); the checks
// here only save a round trip. The hidden "homepage" field is a trap for form-filling robots and stays empty for people.

import { useState, type FormEvent } from "react"

type Fields = Record<string, string>

const input = "mt-1.5 w-full rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2.5 text-[15px] text-[var(--text)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
const label = "block text-[14px] font-semibold text-[var(--text)]"

export function BlocklistForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [message, setMessage] = useState("")
  const [errors, setErrors] = useState<Fields>({})

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) || "")
    setState("sending"); setMessage(""); setErrors({})
    try {
      const res = await fetch("/api/blocklist-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: text("company"), website: text("website"), contactName: text("contactName"), contactEmail: text("contactEmail"),
          contactRole: text("contactRole"), details: text("details"), authorized: form.get("authorized") === "on", homepage: text("homepage"),
        }),
      })
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string; fields?: Fields }
      if (res.ok) { setState("sent"); setMessage(data.message || "Thank you. Your request has been received."); return }
      setErrors(data.fields || {})
      setMessage(data.error || "The request could not be sent. Try again in a moment.")
    } catch {
      setMessage("The request could not be sent. Check your connection and try again.")
    }
    setState("idle")
  }

  if (state === "sent") return <p role="status" className="text-[15.5px] leading-[1.6] text-[var(--text)]">{message}</p>

  const fieldError = (name: string) => errors[name] ? <p id={`${name}-error`} className="mt-1 text-[13.5px] font-semibold text-[var(--signal-chilli)]">{errors[name]}</p> : null
  const described = (name: string) => errors[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {}

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h3 className="text-[18px] font-bold text-[var(--text)]">Ask to be blocklisted</h3>
      <div>
        <label htmlFor="company" className={label}>Employer name</label>
        <input id="company" name="company" required maxLength={120} autoComplete="organization" className={input} {...described("company")} />
        {fieldError("company")}
      </div>
      <div>
        <label htmlFor="website" className={label}>Employer website <span className="font-normal text-[var(--text-soft)]">(optional)</span></label>
        <input id="website" name="website" maxLength={200} inputMode="url" placeholder="example.com" className={input} {...described("website")} />
        {fieldError("website")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contactName" className={label}>Your name</label>
          <input id="contactName" name="contactName" required maxLength={100} autoComplete="name" className={input} {...described("contactName")} />
          {fieldError("contactName")}
        </div>
        <div>
          <label htmlFor="contactRole" className={label}>Your role <span className="font-normal text-[var(--text-soft)]">(optional)</span></label>
          <input id="contactRole" name="contactRole" maxLength={100} autoComplete="organization-title" className={input} {...described("contactRole")} />
          {fieldError("contactRole")}
        </div>
      </div>
      <div>
        <label htmlFor="contactEmail" className={label}>Work email</label>
        <input id="contactEmail" name="contactEmail" type="email" required maxLength={254} autoComplete="email" className={input} {...described("contactEmail")} />
        {fieldError("contactEmail")}
      </div>
      <div>
        <label htmlFor="details" className={label}>Anything we should know <span className="font-normal text-[var(--text-soft)]">(optional)</span></label>
        <textarea id="details" name="details" rows={4} maxLength={2000} className={input} {...described("details")} />
        {fieldError("details")}
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="homepage">Leave this empty</label>
        <input id="homepage" name="homepage" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label className="flex items-start gap-2.5 text-[14.5px] leading-[1.5] text-[var(--text)]">
          <input type="checkbox" name="authorized" required className="mt-1 size-4 shrink-0 accent-[var(--accent)]" {...described("authorized")} />
          I work for this employer and may ask on its behalf.
        </label>
        {fieldError("authorized")}
      </div>
      {message && <p role="alert" className="text-[14px] text-[var(--text-muted)]">{message}</p>}
      <button type="submit" disabled={state === "sending"}
        className="flex h-11 w-full cursor-pointer items-center justify-center rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--accent-h)] disabled:cursor-wait disabled:opacity-70 sm:w-auto sm:px-6">
        {state === "sending" ? "Sending…" : "Send request"}
      </button>
    </form>
  )
}
