"use client"

// Plan & Vision hub — developer notes for every product, in three forms:
// text, mind map, image. Linked from the Admin page.

import Link from "next/link"
import PageIntro from "../../_components/page-intro"

const PRODUCTS = [
  {
    slug: "gmail",
    name: "Gmail",
    tagline: "Everything Gmail does, plus the intelligence Gmail never built.",
    desc: "Parity + agent layer, multi-account without the mess, folding desktop layout, important = tracked, automation bots.",
  },
  {
    slug: "apply",
    name: "Apply",
    tagline: "One search across every prime vendor portal. Pick a contract job, apply without leaving.",
    desc: "Inclusive search crawler, inclusive browser, resume at apply-time, auto-apply + pattern learning. Contract-only: W2 / C2C / 1099 / C2H.",
  },
  {
    slug: "resume",
    name: "Resume",
    tagline: "Built once, fitted to every job, filed forever.",
    desc: "Guided builder, approved formatting, per-JD tailoring, WhatsApp loop, versioned filing. Draft — owner to review.",
  },
  {
    slug: "kompas",
    name: "Kompas",
    tagline: "Interview practice that listens — grounded in your real work.",
    desc: "Voice sessions, dossier-grounded answers, full-spectrum prep, paid models only. Draft — owner to review.",
  },
]

export default function VisionHubPage() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 64px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--text)", margin: 0 }}>
          Plan &amp; Vision
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--text-muted)", margin: "6px 0 0", maxWidth: 680 }}>
          Developer notes: what each product is becoming and why. Every product gets three forms —
          text, mind map, image — so the plan reads the same to everyone.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {PRODUCTS.map(p => (
          <Link
            key={p.slug}
            href={`/dashboard/admin/vision/${p.slug}`}
            style={{
              display: "flex", flexDirection: "column", textDecoration: "none",
              border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/vision/${p.slug}.svg`} alt={`${p.name} vision diagram`}
              style={{ width: "100%", height: "auto", display: "block", borderBottom: "1px solid var(--border)" }} />
            <div style={{ padding: "16px 18px 18px" }}>
              <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>{p.name}</h2>
              <p style={{ fontSize: 13.5, fontStyle: "italic", color: "var(--text-muted)", margin: "0 0 8px", lineHeight: 1.5 }}>
                {p.tagline}
              </p>
              <p style={{ fontSize: 13.5, color: "var(--text)", margin: 0, lineHeight: 1.55 }}>{p.desc}</p>
              <span style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
                Open plan &amp; vision <span aria-hidden="true">→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
