"use client"

/* ── TypingDots — the app's loader ─────────────────────────────────────────
   Four dots that bounce one after another, like a typing indicator —
   jumping and typing at the same time. Replaces every spinner. */

export default function TypingDots({ label, size = 9 }: { label?: string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }} aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <span
            key={i}
            style={{
              width: size, height: size, borderRadius: 999,
              background: "var(--accent)",
              animation: `typing-dot 1.1s ease-in-out ${i * 0.14}s infinite`,
              display: "inline-block",
            }}
          />
        ))}
      </span>
      {label && <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{label}</span>}
      <style>{`
        @keyframes typing-dot {
          0%, 100% { transform: translateY(0) scale(0.82); opacity: 0.45; }
          45%      { transform: translateY(-7px) scale(1.12); opacity: 1; }
        }
      `}</style>
    </span>
  )
}
