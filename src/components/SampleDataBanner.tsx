"use client"

import Link from "next/link"

// Shown across every job board (Jobs & Apply, Full-Time, Contracts) whenever
// the live job source isn't connected. The old indicator was a small gray
// pill easy to miss entirely; a user reported being fooled by fake listings
// with dead career-page links because of it. This is deliberately loud —
// unlabeled placeholder data mixed into a job board is worse than an empty
// state. `variant` distinguishes two genuinely different situations so the
// warning stays honest either way:
//  - "fabricated" (default): /api/jobs's hardcoded fallback — fake companies,
//    dead career-page links. Used by Jobs & Apply / Full-Time boards.
//  - "snapshot": Contracts board's static library — real recruiter posts,
//    just a saved snapshot from one date rather than a continuously live feed.
//    Calling that "not real" would itself be inaccurate.
export default function SampleDataBanner({ live, variant = "fabricated" }: { live: boolean; variant?: "fabricated" | "snapshot" }) {
  if (live) return null
  const message = variant === "snapshot"
    ? "These are real recruiter posts from a saved snapshot, not a live feed — some may already be filled or expired."
    : "These are sample listings, not real job postings — no live job source is connected yet."
  return (
    <div
      role="alert"
      style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "10px 14px", borderRadius: 12, marginBottom: 12,
        background: "var(--warning-soft)", border: "1px solid var(--warning-border)",
        color: "var(--warning)", fontSize: 13, fontWeight: 600,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>⚠</span>
      <span style={{ flex: 1, minWidth: 200 }}>{message}</span>
      <Link
        href="/dashboard/settings"
        style={{
          flexShrink: 0, padding: "5px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
          background: "var(--warning)", color: "#fff", textDecoration: "none",
        }}
      >
        Connect a live source →
      </Link>
    </div>
  )
}
