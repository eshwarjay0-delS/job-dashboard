"use client"

import { useCallback, useEffect, useState } from "react"
import { connectGmail } from "@/lib/google-auth"

type GoogleAccount = {
  id: string
  google_email: string
  gmail_enabled: boolean
  calendar_enabled: boolean
  is_primary: boolean
}

type Status = {
  google?: { accounts?: GoogleAccount[]; maxAccounts?: number; canAdd?: boolean }
}

export default function ChatIntegrationsCard() {
  const [status, setStatus] = useState<Status>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/connections/status", { cache: "no-store" })
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const accounts = status.google?.accounts || []
  const connected = accounts.length > 0
  const max = status.google?.maxAccounts || 4
  const canAdd = status.google?.canAdd !== false && accounts.length < max

  return (
    <div style={{ width: "100%", maxWidth: 680, margin: "4px 0 8px", borderRadius: 22, background: "var(--surface)", border: "1px solid #e6e2d9", overflow: "hidden", boxShadow: "0 8px 28px rgba(12,11,8,.05)" }}>
      <div style={{ padding: "18px 20px 10px", fontSize: 16, fontWeight: 800, color: "#161510" }}>Connect your apps</div>

      <button
        onClick={() => void connectGmail("/dashboard/copilot")}
        disabled={loading || !canAdd}
        style={{ width: "100%", border: 0, borderTop: "1px solid #efede7", background: "transparent", padding: "15px 20px", display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: canAdd ? "pointer" : "default", fontFamily: "inherit" }}
      >
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fff", border: "1px solid #e6e2d9", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 19, color: "#b3261e" }}>M</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 750, fontSize: 15, color: "#161510" }}>Gmail</div>
          <div style={{ fontSize: 12.5, color: "#777267", marginTop: 2 }}>{connected ? `${accounts.length} account${accounts.length === 1 ? "" : "s"} connected · read and send with approval` : "Manage your inbox and draft replies"}</div>
        </div>
        <div style={{ fontSize: 23, color: "#9a9589" }}>›</div>
      </button>

      <button
        onClick={() => void connectGmail("/dashboard/copilot")}
        disabled={loading || !canAdd}
        style={{ width: "100%", border: 0, borderTop: "1px solid #efede7", background: "transparent", padding: "15px 20px", display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: canAdd ? "pointer" : "default", fontFamily: "inherit" }}
      >
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fff", border: "1px solid #e6e2d9", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 15, color: "#2b67d1" }}>31</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 750, fontSize: 15, color: "#161510" }}>Google Calendar</div>
          <div style={{ fontSize: 12.5, color: "#777267", marginTop: 2 }}>{connected ? "Connected with Google Workspace · read interview and recruiting events" : "Read your schedule and coordinate interview events"}</div>
        </div>
        <div style={{ fontSize: 23, color: "#9a9589" }}>›</div>
      </button>

      <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #efede7", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#777267" }}>{loading ? "Checking connections…" : connected ? "Connected. Sensitive actions still require your approval." : "Nothing is connected until you approve Google access."}</span>
        <a href="/dashboard/connections" style={{ fontSize: 12.5, fontWeight: 750, color: "#161510", textDecoration: "none" }}>Manage integrations →</a>
      </div>
    </div>
  )
}
