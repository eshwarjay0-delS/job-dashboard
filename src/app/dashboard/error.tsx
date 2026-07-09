"use client"

// Dashboard-level error boundary.
// When any /dashboard/* page throws a runtime error, this catches it
// and renders an in-page error card — the sidebar layout stays intact.
// Without this file, Next.js bubbles the crash to the root layout and
// the entire page (including the sidebar) unmounts.

import { useEffect } from "react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console for dev debugging — replace with Sentry/Datadog in prod
    console.error("[Dashboard] Page error:", error)
  }, [error])

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: 16,
      padding: "40px 24px",
      textAlign: "center",
    }}>
      {/* Icon */}
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: "#fef2f2", border: "1.5px solid #fecaca",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24,
      }}>
        ⚠️
      </div>

      {/* Heading */}
      <div>
        <h2 style={{
          fontSize: 18, fontWeight: 800, color: "#1a2035",
          marginBottom: 6, letterSpacing: "-0.3px",
        }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: 13.5, color: "#6b7a99", maxWidth: 380, lineHeight: 1.6 }}>
          This page ran into an error. Your data is safe — click Retry to reload
          it, or navigate to another page using the sidebar.
        </p>
      </div>

      {/* Error details (dev only) */}
      {process.env.NODE_ENV === "development" && error.message && (
        <div style={{
          maxWidth: 520, width: "100%",
          background: "#0f1623", border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 10, padding: "12px 16px",
          fontFamily: "monospace", fontSize: 12, color: "#f87171",
          textAlign: "left", overflowX: "auto",
        }}>
          <p style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginBottom: 4 }}>ERROR</p>
          {error.message}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={reset}
          style={{
            padding: "9px 20px", borderRadius: 9,
            background: "var(--accent)", color: "#fff",
            fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer",
          }}
        >
          Retry
        </button>
        <a
          href="/dashboard"
          style={{
            padding: "9px 20px", borderRadius: 9,
            background: "transparent", color: "#6b7a99",
            fontSize: 13.5, fontWeight: 600,
            border: "1px solid #e4e8ef", textDecoration: "none",
            display: "inline-flex", alignItems: "center",
          }}
        >
          Go to Home
        </a>
      </div>
    </div>
  )
}
