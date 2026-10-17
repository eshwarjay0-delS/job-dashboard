"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
export default function PlanVisionLink() {
  const path = usePathname()
  const [admin, setAdmin] = useState(false)
  useEffect(() => { const abort = new AbortController(); fetch("/api/admin/me", { cache: "no-store", signal: abort.signal }).then(r => r.ok ? r.json() : null).then(data => setAdmin(data?.admin === true)).catch(() => {}); return () => abort.abort() }, [path])
  const area = path.startsWith("/dashboard/mail") ? "gmail" : path.startsWith("/dashboard/apply") || path.startsWith("/dashboard/applications") ? "applications" : path.startsWith("/dashboard/resume") ? "resume" : path.startsWith("/dashboard/kompas") || path.startsWith("/dashboard/ai-tools") ? "kompas" : null
  if (!admin || !area) return null
  return <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}><Link href={`/dashboard/admin/vision/${area === "applications" ? "apply" : area}`} style={{ fontSize: 13, color: "var(--accent)" }}>Plan and Vision · Developer notes →</Link></div>
}
