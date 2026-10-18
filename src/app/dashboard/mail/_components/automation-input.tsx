"use client"
import { useState } from "react"
import { parseAutomationIntent, matchSender } from "@/lib/automation-parse"
import type { Mail } from "@/app/dashboard/_suite/sample"
import type { NotifyRule } from "@/app/api/gmail/notify-rules/route"

// Conversational automation: type what you want in plain English,
// confirm, and it's done. V1: watch/mute senders.
export function AutomationInput({ mails, account, onRulesChanged }: {
  mails: Mail[]
  account: string
  onRulesChanged: () => void
}) {
  const [input, setInput] = useState("")
  const [pending, setPending] = useState<{ intent: "watch_sender" | "mute_sender"; email: string; name: string; account: string } | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  // Build sender candidates from recent mail
  const candidates = (() => {
    const seen = new Map<string, string>()
    for (const m of mails) {
      const email = (m.fromEmail || "").toLowerCase()
      if (email && !seen.has(email)) seen.set(email, m.from || "")
    }
    return [...seen.entries()].map(([email, name]) => ({ email, name }))
  })()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")
    setPending(null)
    const intent = parseAutomationIntent(input)
    if (intent.kind === "unknown") {
      setMessage("I didn't catch that. Try: \"Always notify me about Gary Singh\" or \"Mute newsletter@spam.com\".")
      return
    }
    const matchedEmail = matchSender(intent.sender, candidates)
    if (!matchedEmail) {
      setMessage(`I couldn't find "${intent.sender}" in your recent mail. Try their email address.`)
      return
    }
    const candidate = candidates.find(c => c.email === matchedEmail)
    const name = candidate?.name || matchedEmail
    // Use the inbox the sender actually emailed, falling back to the selected account
    const senderAccount = mails.find(m => (m.fromEmail || "").toLowerCase() === matchedEmail)?.account || account
    if (!senderAccount || senderAccount === "all") {
      setMessage("Select a specific inbox above first, so I know where to apply this.")
      return
    }
    setPending({ intent: intent.kind, email: matchedEmail, name, account: senderAccount })
  }

  async function confirm() {
    if (!pending) return
    setBusy(true)
    try {
      // Fetch current rules, add the new one, PUT back
      const getRes = await fetch("/api/gmail/notify-rules")
      const getJson = await getRes.json()
      const rules: NotifyRule[] = getJson.ok ? getJson.rules : []
      const mode = pending.intent === "watch_sender" ? "always" : "never"
      const updated = [...rules.filter(r => !(r.email === pending.email && r.account === pending.account)), { account: pending.account, email: pending.email, mode }]
      const putRes = await fetch("/api/gmail/notify-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: updated }),
      })
      const putJson = await putRes.json()
      if (putJson.ok) {
        setMessage(pending.intent === "watch_sender"
          ? `✓ You'll always be notified about ${pending.name}.`
          : `✓ ${pending.name} is muted. You won't be nudged about them.`)
        setInput("")
        setPending(null)
        onRulesChanged()
      } else {
        setMessage(`Couldn't save: ${putJson.error || "unknown error"}`)
      }
    } catch {
      setMessage("Couldn't save. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mf-automation">
      <form onSubmit={handleSubmit} className="mf-automation-form">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder='Try: "Always notify me about Gary Singh" or "Mute newsletter@spam.com"'
          className="mf-automation-input"
          aria-label="Describe an automation in plain English"
        />
        <button type="submit" className="btn-primary" disabled={!input.trim()}>Set up</button>
      </form>

      {pending && (
        <div className="mf-automation-confirm">
          <p>
            {pending.intent === "watch_sender" ? "🔔" : "🔕"}{" "}
            {pending.intent === "watch_sender"
              ? <>Always notify you about <strong>{pending.name}</strong> ({pending.email})?</>
              : <>Mute <strong>{pending.name}</strong> ({pending.email}) — no nudges about them?</>}
          </p>
          <div className="mf-automation-actions">
            <button onClick={confirm} disabled={busy} className="btn-primary">
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button onClick={() => setPending(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {message && !pending && <p className="mf-automation-message">{message}</p>}
    </div>
  )
}
