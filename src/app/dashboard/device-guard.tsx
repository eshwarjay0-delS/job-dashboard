"use client"

import { useEffect, useState, type ReactNode } from "react"

const STORAGE_KEY = "marketfit_device_key"

function deviceKey() {
  let key = localStorage.getItem(STORAGE_KEY)
  if (!key) {
    key = crypto.randomUUID() + "-" + crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, key)
  }
  return key
}

export default function DeviceGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking"|"allowed"|"blocked">("checking")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    async function register() {
      try {
        const key = deviceKey()
        const res = await fetch("/api/identity/device/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceKey: key,
            channel: "web",
            label: navigator.userAgent.slice(0, 100),
          }),
          signal: controller.signal,
        })
        const body = await res.json().catch(() => ({}))
        if (res.status === 409 && body.code === "DEVICE_LIMIT_REACHED") {
          setMessage(body.error || "This subscription already has two active devices.")
          setState("blocked")
          return
        }
        if (!res.ok) throw new Error(body.error || "Could not register this device.")
        setState("allowed")
      } catch (e) {
        if (controller.signal.aborted) return
        // Do not silently bypass a configured device limit.
        setMessage(String(e instanceof Error ? e.message : e))
        setState("blocked")
      }
    }
    register()
    return () => controller.abort()
  }, [])

  if (state === "checking") {
    return <div style={{padding:40,color:"var(--text-muted)"}}>Verifying this device…</div>
  }
  if (state === "blocked") {
    return (
      <div style={{maxWidth:560,margin:"80px auto",padding:28,border:"1px solid var(--border)",borderRadius:18,background:"var(--surface)"}}>
        <h1 style={{fontSize:24,fontWeight:850,marginBottom:10}}>Device limit reached</h1>
        <p style={{lineHeight:1.6,color:"var(--text-muted)"}}>{message}</p>
        <p style={{marginTop:12,lineHeight:1.6,color:"var(--text-muted)"}}>
          MarketFit allows two active device slots per subscription. Revoke an old device from account settings before adding another.
        </p>
      </div>
    )
  }
  return <>{children}</>
}
