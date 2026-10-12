"use client"

import type { ApplicationChain, ChainStageKey } from "@/app/api/gmail/_lib"

/* ── ChainRail — the train on its track ────────────────────────────────────
   Every application is a train moving through RTR → Submitted → With client
   → Interview → Decision. The glowing dot is your profile, right now. */

const ORDER: ChainStageKey[] = ["rtr", "submitted", "client", "interview", "decision"]

export default function ChainRail({ chain }: { chain: ApplicationChain }) {
  const currentIdx = ORDER.indexOf(chain.current)
  const doneColor = chain.terminal === "rejected" ? "var(--text-soft)" : "var(--accent)"

  return (
    <div style={{ padding: "6px 2px 2px" }}>
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* the rail */}
        <div style={{
          position: "absolute", top: 11, left: 22, right: 22, height: 3,
          background: "var(--border)", borderRadius: 3,
        }} />
        <div style={{
          position: "absolute", top: 11, left: 22, height: 3, borderRadius: 3,
          width: `calc(${(currentIdx / (ORDER.length - 1)) * 100}% - ${(currentIdx / (ORDER.length - 1)) * 44}px)`,
          background: "var(--border)", transition: "width 0.6s ease",
        }} />
        {chain.stops.map((s, i) => {
          const isCurrent = s.reached && i === currentIdx && !chain.terminal
          const isDone = s.reached
          return (
            <div key={s.key} style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", width: 64, flexShrink: 0 }}>
              <div style={{
                width: isCurrent ? 26 : 22, height: isCurrent ? 26 : 22, borderRadius: 999,
                background: isDone || isCurrent
                  ? (chain.terminal === "offer" && s.key === "decision" ? "#b98a1e" : doneColor)
                  : "var(--surface)",
                border: `2.5px solid ${isDone || isCurrent ? (chain.terminal === "offer" && s.key === "decision" ? "#b98a1e" : doneColor) : "var(--border-strong)"}`,
                boxShadow: isCurrent ? `0 0 0 6px ${doneColor}22, 0 0 18px ${doneColor}55` : "none",
                animation: isCurrent ? "train-glow 2s ease-in-out infinite" : "none",
                display: "grid", placeItems: "center",
              }}>
                {isDone && !isCurrent && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6.5L5 9.5L10 3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? "var(--text)" : "var(--text-muted)", textAlign: "center", lineHeight: 1.3 }}>
                {s.label}
              </div>
              {s.at && (
                <div style={{ fontSize: 10, color: "var(--text-soft)", marginTop: 2 }}>
                  {new Date(s.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              )}
              <style>{`@keyframes train-glow { 0%,100% { box-shadow: 0 0 0 5px ${doneColor}1e, 0 0 12px ${doneColor}44; } 50% { box-shadow: 0 0 0 8px ${doneColor}30, 0 0 22px ${doneColor}66; } }`}</style>
            </div>
          )
        })}
      </div>
    </div>
  )
}
