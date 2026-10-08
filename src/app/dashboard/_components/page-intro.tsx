"use client"

// Every page opens the same way so nobody has to hunt: where you are, what this page is for in one
// line, and one button for the next step. A page on sample data says so here in one sentence rather
// than with a badge, and never claims to be connected.

import Link from "next/link"
import type { CSSProperties } from "react"
import { navItem } from "./nav"

export type IntroAction =
  | { label: string; href: string; external?: boolean }
  | { label: string; htmlFor: string }
  | { label: string; onClick: () => void }

const BUTTON: CSSProperties = {
  minHeight: 48, padding: "0 24px", fontSize: 15.5, textDecoration: "none", cursor: "pointer",
}

// `what` replaces the page's one line when a page does two things and is showing the second of them (Kompas Flow).
export default function PageIntro({ page, action, sample, what }: { page: string; action: IntroAction; sample?: string; what?: string }) {
  const item = navItem(page)
  const text = <>{action.label}<span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>→</span></>

  return (
    <header style={{ marginBottom: 32, paddingBottom: 26, borderBottom: "0.8px solid var(--border-strong)" }}>
      <div className="ink-eyebrow" style={{ fontSize: 12 }}>You are here</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", margin: "10px 0 0" }}>
        {item.label}
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--text-muted)", margin: "8px 0 0", maxWidth: 640 }}>{what ?? item.what}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginTop: 20 }}>
        {"href" in action ? (
          action.external
            ? <a href={action.href} target="_blank" rel="noopener noreferrer" className="btn-accent" style={BUTTON}>{text}</a>
            : action.href.startsWith("#")
              ? <a href={action.href} className="btn-accent" style={BUTTON} onClick={e => {
                  const target = document.getElementById(action.href.slice(1))
                  if (!target) return
                  e.preventDefault()
                  target.scrollIntoView({ behavior: "smooth", block: "start" })
                }}>{text}</a>
              : <Link href={action.href} className="btn-accent" style={BUTTON}>{text}</Link>
        ) : "htmlFor" in action ? (
          <label htmlFor={action.htmlFor} className="btn-accent" style={BUTTON}>{text}</label>
        ) : (
          <button type="button" onClick={action.onClick} className="btn-accent" style={BUTTON}>{text}</button>
        )}
        {sample && <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--text-muted)", margin: 0, maxWidth: 420 }}>{sample}</p>}
      </div>
    </header>
  )
}
