"use client"

// MetricHero: the "why am I here" strip for every Gmail page.
// One plain sentence a 5-year-old understands, then the big numbers.
// No jargon, no hunting.

import type { CSSProperties } from "react"

export type Metric = { value: string | number; label: string; hot?: boolean }

export default function MetricHero({
  why,
  metrics,
}: {
  why: string
  metrics: Metric[]
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "20px 22px",
        marginBottom: 20,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 15, lineHeight: 1.5, color: "var(--text)", fontWeight: 600 }}>
        {why}
      </div>
      <div
        style={{
          display: "flex",
          gap: 28,
          flexWrap: "wrap",
          marginTop: 14,
        }}
      >
        {metrics.map((m) => (
          <div key={m.label}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: m.hot ? "var(--accent)" : "var(--text)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {m.value}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--text-muted)",
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              {m.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const HERO_STYLE: CSSProperties = {}
