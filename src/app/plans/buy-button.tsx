"use client"

// The one moving part of the Plans page: ask the server for a payment page and go there. While checkout is off or the
// plan has no price, the button is disabled and says why, so nobody clicks into an error.

import { useState } from "react"

export function BuyButton({ planId, buyable }: { planId: string; buyable: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  if (!buyable) {
    return (
      <button type="button" disabled aria-disabled="true"
        className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] text-[15px] font-semibold text-[var(--text-soft)]">
        Not on sale yet
      </button>
    )
  }

  async function buy() {
    setBusy(true); setError("")
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) })
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (res.status === 401) { window.location.assign("/login?next=/plans"); return }
      if (res.ok && data.url) { window.location.assign(data.url); return }
      setError(data.error || "Checkout could not start. Nothing was charged.")
    } catch {
      setError("Checkout could not start. Nothing was charged.")
    }
    setBusy(false)
  }

  return (
    <div>
      <button type="button" onClick={buy} disabled={busy}
        className="flex h-11 w-full cursor-pointer items-center justify-center rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--accent-h)] disabled:cursor-wait disabled:opacity-70">
        {busy ? "Opening the payment page…" : "Buy"}
      </button>
      {error && <p role="alert" className="mt-2 text-[13.5px] text-[var(--text-muted)]">{error}</p>}
    </div>
  )
}
