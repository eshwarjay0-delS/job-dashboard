"use client"

// One product's Plan & Vision in three forms: text, mind map, image.

import { useMemo, useState } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { VISION_DOCS } from "@/lib/visionDocs"
import VisionMarkdown from "../_components/md"
import MindMap, { parseMindMap } from "../_components/mindmap"

type View = "text" | "mindmap" | "image"

const VIEWS: { key: View; label: string }[] = [
  { key: "text", label: "Text" },
  { key: "mindmap", label: "Mind map" },
  { key: "image", label: "Image" },
]

export default function VisionProductPage({ params }: { params: { product: string } }) {
  const [view, setView] = useState<View>("text")
  const doc = VISION_DOCS.find(d => d.product === params.product)
  const map = useMemo(() => (doc ? parseMindMap(doc.markdown) : null), [doc])

  if (!doc || !map) notFound()

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 64px" }}>
      <Link href="/dashboard/admin/vision"
        style={{ fontSize: 13.5, color: "var(--text-muted)", textDecoration: "none" }}>
        ← Plan &amp; Vision
      </Link>
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--text)", margin: "10px 0 4px" }}>
        {doc.title}
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-soft)", margin: "0 0 20px" }}>
        Source: <code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>docs/{doc.product}.md</code>
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }} role="tablist" aria-label="Vision format">
        {VIEWS.map(v => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            style={{
              minHeight: 38, padding: "0 18px", fontSize: 14, fontWeight: 600, borderRadius: 999,
              border: "1px solid var(--border)",
              background: view === v.key ? "var(--accent)" : "var(--surface)",
              color: view === v.key ? "var(--bg)" : "var(--text)",
              cursor: "pointer",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "text" && (
        <div role="tabpanel">
          <VisionMarkdown markdown={doc.markdown} />
        </div>
      )}

      {view === "mindmap" && (
        <div role="tabpanel">
          <MindMap map={map} />
        </div>
      )}

      {view === "image" && (
        <div role="tabpanel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/vision/${doc.product}.svg`} alt={`${doc.title} vision diagram`}
            style={{ width: "100%", height: "auto", borderRadius: 16, border: "1px solid var(--border)" }} />
          <p style={{ marginTop: 12 }}>
            <a href={`/vision/${doc.product}.svg`} download={`${doc.product}-vision.svg`}
              style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
              Download SVG <span aria-hidden="true">→</span>
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
