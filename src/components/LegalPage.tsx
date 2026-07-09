import Link from "next/link"
import type { ReactNode } from "react"

/**
 * Public, self-contained shell for legal pages (privacy / terms).
 * Light, read-optimized layout — independent of the dashboard sidebar/theme.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f9fc", color: "#1a2035" }}>
      <style>{`
        .legal-body h2 { font-size: 19px; font-weight: 700; color: #0b1220; margin: 34px 0 10px; letter-spacing: -0.3px; }
        .legal-body h3 { font-size: 15.5px; font-weight: 700; color: #1a2035; margin: 20px 0 6px; }
        .legal-body p { margin: 0 0 14px; }
        .legal-body ul { margin: 0 0 16px; padding-left: 22px; }
        .legal-body li { margin: 0 0 7px; }
        .legal-body a { color: var(--accent); }
        .legal-body strong { color: #0b1220; }
        .legal-body .note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 16px; font-size: 13.5px; color: #1e40af; margin: 0 0 18px; }
      `}</style>

      <header style={{ borderBottom: "1px solid #e4e8ef", background: "#fff" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(145deg,#3b82f6,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 12 }}>MF</div>
            <span style={{ fontWeight: 750, fontSize: 16, color: "#0b1220", letterSpacing: "-0.3px" }}>MarketFit</span>
          </Link>
          <Link href="/dashboard" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>Open app →</Link>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "44px 24px 90px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.6px", margin: "0 0 6px" }}>{title}</h1>
        <p style={{ color: "#6b7a99", fontSize: 13.5, margin: "0 0 32px" }}>Last updated: {updated}</p>
        <div className="legal-body" style={{ fontSize: 15, lineHeight: 1.7, color: "#2c3650" }}>
          {children}
        </div>
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid #e4e8ef", fontSize: 13, color: "#6b7a99" }}>
          Questions? Email <a href="mailto:support@marketfit.app" style={{ color: "var(--accent)" }}>support@marketfit.app</a>.
          {" · "}<Link href="/privacy" style={{ color: "var(--accent)" }}>Privacy</Link>
          {" · "}<Link href="/terms" style={{ color: "var(--accent)" }}>Terms</Link>
        </div>
      </main>
    </div>
  )
}
