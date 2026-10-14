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
  minHeight: 40, padding: "0 18px", fontSize: 14.5, textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap",
}

// `what` replaces the page's one line when a page does two things and is showing the second of them (Kompas Flow).
// The look (design system 2, 14 Oct 2026): the page header people know from the apps they use. The title and its one
// line on the left, the one next step on the right; nothing above the title, since the menu already shows where you are.
export default function PageIntro({ page, action, sample, what }: { page: string; action: IntroAction; sample?: string; what?: string }) {
  const item = navItem(page)
  const text = <>{action.label}<span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>→</span></>

  return (
    <header className="mf-page-intro" style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: "1 1 420px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, color: "var(--text)", margin: 0 }}>
          {item.label}
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--text-muted)", margin: "6px 0 0", maxWidth: 640 }}>{what ?? item.what}</p>
        {sample && <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text-soft)", margin: "8px 0 0", maxWidth: 560 }}>{sample}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>
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
      </div>
    </header>
  )
}
