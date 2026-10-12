"use client"

import Link from "next/link"
import { X, TrainFront, User, ArrowRight } from "lucide-react"
import ChainRail from "./chain-rail"
import TypingDots from "../../_components/typing-dots"
import type { ApplicationChain, ChainEventKind } from "@/app/api/gmail/_lib"

const EVENT_DOT: Record<ChainEventKind, string> = {
  first_contact: "var(--text-muted)",
  rtr_request: "#b3541e",
  rtr_signed: "#2f6f6a",
  resume_sent: "#2f6f6a",
  rate: "#8a6d1b",
  submitted: "var(--accent)",
  client: "var(--accent)",
  interview_request: "#6d4fa3",
  interview_scheduled: "#6d4fa3",
  followup: "#a3a099",
  response: "var(--text-muted)",
  note: "var(--text-muted)",
  offer: "var(--success)",
  rejection: "var(--danger)",
}

/* ── ChainDetail — one application's full journey ──────────────────────────
   The train on its track, the people who carried the profile, who holds it
   now, and the next move. Slides up as a bottom sheet on mobile. */

export default function ChainDetail({
  chain, loading, onClose,
}: {
  chain: ApplicationChain | null
  loading: boolean
  onClose: () => void
}) {
  if (!chain && !loading) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 70, background: "rgba(20,18,12,0.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)", maxHeight: "88dvh", overflowY: "auto",
          background: "var(--surface)", borderRadius: "22px 22px 0 0",
          borderTop: "1px solid var(--border-strong)",
          padding: "14px 20px calc(20px + env(safe-area-inset-bottom))",
          animation: "sheet-up 0.28s ease-out",
        }}
      >
        <style>{`@keyframes sheet-up { from { transform: translateY(40px); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--border-strong)" }} />
        </div>

        {loading || !chain ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <TypingDots label="Tracing the chain…" />
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-soft)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                  <TrainFront size={13} /> Application journey
                </div>
                <h2 style={{ margin: "6px 0 2px", fontSize: 20 }}>{chain.company}</h2>
                <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{chain.role}{chain.rate ? ` · ${chain.rate}` : ""}</div>
              </div>
              <button onClick={onClose} aria-label="Close"
                style={{ border: "none", background: "var(--surface-2)", borderRadius: 999, width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--text-muted)", flex: "none" }}>
                <X size={17} />
              </button>
            </div>

            <div style={{ margin: "18px 0 6px" }}>
              <ChainRail chain={chain} />
            </div>

            {/* Who holds the profile right now */}
            {!chain.terminal && (
              <div style={{
                marginTop: 14, padding: "12px 14px", borderRadius: 14,
                background: chain.stalledDays >= 7 ? "var(--surface-2)" : "var(--accent-soft)",
                border: `1px solid ${chain.stalledDays >= 7 ? "#e8c98f" : "var(--accent-border)"}`,
                fontSize: 13.5, lineHeight: 1.55,
              }}>
                <strong>{chain.holder}</strong> has your profile
                {chain.stalledDays > 0 && <> · quiet for <strong>{chain.stalledDays} day{chain.stalledDays === 1 ? "" : "s"}</strong></>}.
                <div style={{ marginTop: 4, color: "var(--text-muted)" }}>{chain.nextAction}</div>
              </div>
            )}
            {chain.terminal && (
              <div style={{
                marginTop: 14, padding: "12px 14px", borderRadius: 14,
                background: chain.terminal === "offer" ? "#f4ecd4" : "var(--surface-2)",
                border: "1px solid var(--border-strong)", fontSize: 13.5,
              }}>
                {chain.nextAction}
              </div>
            )}

            {/* The numbers behind it */}
            {chain.journey && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>
                <span style={{ fontSize: 13 }}><strong>{chain.journey.emails}</strong> <span style={{ color: "var(--text-muted)" }}>emails</span></span>
                <span style={{ fontSize: 13 }}><strong>{chain.journey.people}</strong> <span style={{ color: "var(--text-muted)" }}>people</span></span>
                {chain.journey.daysToInterview !== undefined && (
                  <span style={{ fontSize: 13 }}><strong>{chain.journey.daysToInterview}</strong> <span style={{ color: "var(--text-muted)" }}>days to interview</span></span>
                )}
              </div>
            )}

            {/* People & contacts */}
            {chain.contacts.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-soft)", textTransform: "uppercase", marginBottom: 8 }}>
                  People involved
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {chain.contacts.map(ct => (
                    <div key={ct.email || ct.name} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", display: "flex", gap: 10, alignItems: "center", background: "var(--surface)" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", flex: "none", background: "var(--accent-soft)", color: "var(--accent-txt)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>
                        {ct.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ct.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ct.email}{ct.phone ? ` · ${ct.phone}` : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-soft)", flex: "none" }}>{ct.emails} mail{ct.emails === 1 ? "" : "s"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step by step: every email, in order, who passed to whom */}
            {chain.events.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-soft)", textTransform: "uppercase", marginBottom: 10 }}>
                  Every step, in order
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {chain.events.map((e, i) => (
                    <div key={`${e.messageId}-${i}`} style={{ display: "flex", gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 18 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", marginTop: 4, flex: "none", background: EVENT_DOT[e.kind] || "var(--text-muted)" }} />
                        {i < chain.events.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 12, background: "var(--border)", borderRadius: 2 }} />}
                      </div>
                      <div style={{ paddingBottom: 12, minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{e.label}</span>
                          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                            {e.at ? new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
                          {e.isMe ? "You" : e.from}{e.handoffFrom ? <span> · handed off by {e.handoffFrom}</span> : null}
                          {e.detail ? <span> — {e.detail}</span> : null}
                        </div>
                        {e.mentions.length > 0 && (
                          <div style={{ fontSize: 11.5, color: "var(--text-soft)", marginTop: 2 }}>
                            Named: {e.mentions.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Milestones with evidence */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-soft)", textTransform: "uppercase", marginBottom: 10 }}>
                Milestones
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {chain.stops.filter(s => s.reached).map(s => (
                  <div key={s.key} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "baseline" }}>
                    <span style={{ fontWeight: 700, minWidth: 88 }}>{s.label}</span>
                    {s.at && <span style={{ color: "var(--text-soft)" }}>{new Date(s.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                    {s.evidence && <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {s.evidence}</span>}
                  </div>
                ))}
                {chain.stops.filter(s => s.reached).length === 0 && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Early days — the first handoff hasn't shown up in email yet.</div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {!chain.terminal && chain.stalledDays >= 7 && (
                <Link href="/dashboard/mail" style={{
                  flex: 1, textAlign: "center", padding: "13px", borderRadius: 14, fontWeight: 750, fontSize: 14,
                  background: "var(--accent)", color: "#fff", textDecoration: "none",
                }}>
                  Draft the follow-up
                </Link>
              )}
              {chain.interviewThreadId && (
                <Link href="/dashboard/calendar" style={{
                  flex: 1, textAlign: "center", padding: "13px", borderRadius: 14, fontWeight: 700, fontSize: 14,
                  border: "1px solid var(--border-strong)", color: "var(--text)", textDecoration: "none",
                }}>
                  View interview
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
