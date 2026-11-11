/**
 * Anchor-mode answer card (readability only, 2026-11-10).
 *
 * When the answer engine returns stance / friction / fix / hook, the live card
 * shows the interviewer question, elapsed time, and those short fields. Full
 * prose is one toggle away. Missing fields fall back to ordinary bullets.
 * This is a reading layout only.
 */

export type AnchorFields = {
  stance?: string
  friction?: string
  fix?: string
  hook?: string
  prose?: string
}

export type AnchorCardModel = {
  mode: "anchor" | "bullets"
  question: string
  elapsedLabel: string
  elapsedMs: number
  stance: string
  friction: string
  fix: string
  hook: string
  prose: string
  showProse: boolean
  bullets: string[]
}

function words(text: string): string[] {
  return String(text || "").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean)
}

function clipWords(text: string, min: number, max: number): string {
  const w = words(text)
  if (!w.length) return ""
  if (w.length > max) return w.slice(0, max).join(" ")
  // Too-short fields are still shown; the engine is asked for min–max, we do not invent words.
  void min
  return w.join(" ")
}

export function hasAnchorFields(fields: AnchorFields | null | undefined): boolean {
  if (!fields) return false
  return Boolean(
    String(fields.stance || "").trim() &&
    String(fields.friction || "").trim() &&
    String(fields.fix || "").trim()
  )
}

export function clampAnchorFields(fields: AnchorFields | null | undefined): Required<AnchorFields> {
  const f = fields || {}
  return {
    stance: clipWords(f.stance || "", 1, 3),
    friction: clipWords(f.friction || "", 3, 5),
    fix: clipWords(f.fix || "", 3, 5),
    hook: clipWords(f.hook || "", 1, 8),
    prose: String(f.prose || "").trim(),
  }
}

export function formatElapsed(ms: number): string {
  const n = Math.max(0, Math.round(Number(ms) || 0))
  const s = Math.floor(n / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}s`
  return `${m}:${String(r).padStart(2, "0")}`
}

export function formatAnchorCard(opts: {
  question?: string
  elapsedMs?: number
  fields?: AnchorFields | null
  showProse?: boolean
  bullets?: readonly string[]
}): AnchorCardModel {
  const clamped = clampAnchorFields(opts.fields)
  const elapsedMs = Math.max(0, Number(opts.elapsedMs) || 0)
  const mode: "anchor" | "bullets" = hasAnchorFields(opts.fields) ? "anchor" : "bullets"
  return {
    mode,
    question: String(opts.question || "").replace(/\s+/g, " ").trim(),
    elapsedLabel: formatElapsed(elapsedMs),
    elapsedMs,
    stance: clamped.stance,
    friction: clamped.friction,
    fix: clamped.fix,
    hook: clamped.hook,
    prose: clamped.prose,
    showProse: !!opts.showProse,
    bullets: Array.from(opts.bullets || []).map((b) => String(b || "").trim()).filter(Boolean),
  }
}
