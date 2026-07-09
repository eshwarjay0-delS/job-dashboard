import Link from "next/link"

// Branded, public 404 — independent of the dashboard shell.
export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1220", color: "#f1f5f9", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 440 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, margin: "0 auto 20px", background: "linear-gradient(145deg,#3b82f6,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 18, boxShadow: "0 8px 28px rgba(37,99,235,.4)" }}>MF</div>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: "-2px", lineHeight: 1, color: "#60a5fa" }}>404</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "14px 0 8px", letterSpacing: "-0.4px" }}>This page took a different career path</h1>
        <p style={{ color: "#94a3b8", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 26px" }}>
          The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get you back on track.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard" style={{ padding: "11px 22px", borderRadius: 11, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 14px rgba(37,99,235,.4)" }}>Go to dashboard</Link>
          <Link href="/dashboard/jobs-ft" style={{ padding: "11px 22px", borderRadius: 11, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#e2e8f0", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Browse jobs</Link>
        </div>
      </div>
    </div>
  )
}
