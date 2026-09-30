"use client"

import { useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react"
import { STAGE, type Stage } from "./sample"

// Approving a waiting reply has to remove it from every screen that lists it (Today, Mail, the
// Workflows queue), not just the one it was clicked on, or the same reply looks unanswered
// somewhere else. Kept per browser session because nothing here is connected to real mail yet.
const ANSWERED_KEY = "mf_suite_answered"
const ANSWERED_EVENT = "mf-suite-answered"

function readAnswered(): string[] {
  try { return JSON.parse(sessionStorage.getItem(ANSWERED_KEY) || "[]") } catch { return [] }
}

function subscribeAnswered(onChange: () => void) {
  window.addEventListener(ANSWERED_EVENT, onChange)
  return () => window.removeEventListener(ANSWERED_EVENT, onChange)
}

export function useAnswered(): [string[], (id: string) => void] {
  const raw = useSyncExternalStore(subscribeAnswered, () => sessionStorage.getItem(ANSWERED_KEY) || "[]", () => "[]")
  const answered = useMemo<string[]>(() => { try { return JSON.parse(raw) } catch { return [] } }, [raw])
  const answer = (id: string) => {
    const next = Array.from(new Set([...readAnswered(), id]))
    sessionStorage.setItem(ANSWERED_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(ANSWERED_EVENT))
  }
  return [answered, answer]
}

// A row that is being approved fades and folds for this long before it leaves the list. Removal is
// driven by a timer rather than transitionend, which never fires under reduced motion.
export const LEAVE_MS = 240

export function useLeaving(onGone: (id: string) => void): [string[], (id: string) => void] {
  const [leaving, setLeaving] = useState<string[]>([])
  const leave = (id: string) => {
    if (leaving.includes(id)) return
    setLeaving(xs => [...xs, id])
    window.setTimeout(() => {
      onGone(id)
      setLeaving(xs => xs.filter(x => x !== id))
    }, LEAVE_MS)
  }
  return [leaving, leave]
}

export function leavingStyle(isLeaving: boolean): CSSProperties {
  return {
    transition: `opacity ${LEAVE_MS}ms ease, transform ${LEAVE_MS}ms ease`,
    opacity: isLeaving ? 0 : 1,
    transform: isLeaving ? "translateX(12px)" : "none",
  }
}

// Said once at the top of every page that shows it, through PageIntro, instead of a badge per card.
export const SAMPLE_LINE = "This page shows made-up example data, not your real accounts."

export function Card({ children, style, dark, id }: { children: ReactNode; style?: CSSProperties; dark?: boolean; id?: string }) {
  return (
    <div id={id} style={{
      background: dark ? "var(--accent)" : "var(--surface)",
      color: dark ? "var(--bg)" : "var(--text)",
      border: dark ? "1px solid var(--accent)" : "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: 20, boxShadow: dark ? "none" : "var(--shadow-card)", ...style,
    }}>{children}</div>
  )
}

export function Meta({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, letterSpacing: ".16em",
      textTransform: "uppercase", color: "var(--text-soft)", ...style,
    }}>
      {children}
    </div>
  )
}

export function StagePill({ stage, label }: { stage: Stage; label?: string }) {
  const s = STAGE[stage]
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
      fontFamily: "var(--font-label)", fontSize: 11, fontWeight: 600,
      padding: "3px 10px", borderRadius: 100, background: s.bg, color: s.fg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {label ?? s.label}
    </span>
  )
}

export function Chip({ label, active, count, onClick, disabled }: { label: ReactNode; active?: boolean; count?: number; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, minHeight: 40, padding: "0 16px", borderRadius: 100,
        fontFamily: "var(--font-label)", fontSize: 14.5, fontWeight: active ? 600 : 500,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "var(--bg)" : "var(--text-muted)",
        transition: "all .3s ease",
      }}>
      {label}
      {count !== undefined && <span style={{ fontFamily: "var(--font-num)", fontSize: 12, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>{count}</span>}
    </button>
  )
}

// solid is the strong button (acid, lifts onto an ink shadow); keep it to one per view.
export function Btn({ children, onClick, variant = "solid", disabled, style, title }: {
  children: ReactNode; onClick?: () => void; variant?: "solid" | "outline" | "ghost"; disabled?: boolean; style?: CSSProperties; title?: string
}) {
  const cls = variant === "solid" ? "btn-accent" : variant === "outline" ? "btn-outline" : "btn-ghost"
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls}
      style={{ minHeight: 44, padding: "0 18px", fontSize: 15, ...style }}>{children}</button>
  )
}

export function Avatar({ name, tint, size = 36 }: { name: string; tint: string; size?: number }) {
  const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <div aria-hidden style={{
      width: size, height: size, flexShrink: 0, borderRadius: "50%", background: tint, color: "#f4f1de",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-label)", fontSize: Math.max(11, size * 0.34), fontWeight: 600,
    }}>{initials}</div>
  )
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "var(--text)" }}>
      <button type="button" role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)}
        style={{
          width: 38, height: 22, borderRadius: 100, border: "1px solid var(--border-strong)", padding: 2, cursor: "pointer",
          background: value ? "var(--accent)" : "var(--surface-2)", transition: "background .3s ease",
        }}>
        <span style={{
          display: "block", width: 16, height: 16, borderRadius: "50%", background: value ? "var(--bg)" : "var(--text-soft)",
          transform: value ? "translateX(16px)" : "none", transition: "transform .3s ease",
        }} />
      </button>
      {label}
    </label>
  )
}
