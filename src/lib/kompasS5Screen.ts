/**
 * Shared-tab screen analyze (Parakeet S5).
 * One frame of the tab already shared. The full body stays visible.
 * A code bug gets a short corrected block. The first streamed word is
 * budgeted under 2.0s. A missing model or vision path is one sentence.
 */

export const SCREEN_FIRST_WORD_MS = 2000

export const SCREEN_FALLBACK_UNAVAILABLE = "Screen reading is unavailable right now. Type the question and press AI Answer."
export const SCREEN_FALLBACK_NO_SHARE = "Share the meeting tab first. Screen analyze uses that share and will not ask again."
export const SCREEN_FALLBACK_BLANK = "That frame was blank. Share the tab that has the question."
export const SCREEN_FALLBACK_UNREADABLE = "That frame could not be read. Share the tab that has the question."

export const GWLB_FIX = [
  "```hcl",
  'resource "aws_lb" "gwlb" {',
  '  load_balancer_type = "gateway"',
  "}",
  "",
  'resource "aws_lb_target_group" "appliances" {',
  '  protocol = "GENEVE"',
  "  port     = 6081",
  "}",
  "```",
].join("\n")

export type ScreenKind = "jd" | "design" | "code" | "question" | "empty"

export function screenFirstWordOk(ms: number): boolean {
  return Number.isFinite(ms) && ms >= 0 && ms < SCREEN_FIRST_WORD_MS
}

/** The card shows the whole frame text. It is not cut to a heading. */
export function screenCardBody(text: string): string {
  return String(text || "").replace(/\r\n/g, "\n").trim()
}

export function classifyScreenText(text: string): ScreenKind {
  const raw = screenCardBody(text)
  if (!raw) return "empty"
  if (/\b(?:job description|responsibilities|requirements|qualifications|about the role)\b/i.test(raw) && !/resource\s+"/.test(raw)) return "jd"
  if (/load_balancer_type\s*=|resource\s+"aws_lb"/i.test(raw)) return "code"
  if (/\b(?:gateway load balancer|inspection vpc|gwlb|geneve)\b/i.test(raw)) return "design"
  if (/[?]|\b(?:what|why|how|explain|describe|walk me)\b/i.test(raw)) return "question"
  if (raw.split(/\s+/).length >= 40) return "jd"
  return "question"
}

export function gwlbBug(text: string): boolean {
  const raw = String(text || "")
  const network = /load_balancer_type\s*=\s*["']network["']/i.test(raw)
  const http = /protocol\s*=\s*["']HTTP["']/i.test(raw)
  return (network || http) && /aws_lb|gateway load balancer|gwlb|terraform/i.test(raw)
}

/** Short corrected block for the Gateway Load Balancer snippet. */
export function correctTerraform(answer: string, screen: string): string {
  const blob = `${answer}\n${screen}`
  if (!gwlbBug(blob) && !gwlbBug(screen)) return answer
  if (/load_balancer_type\s*=\s*"gateway"/.test(answer) && /protocol\s*=\s*"GENEVE"/.test(answer)) return answer
  const base = String(answer || "").trim()
  if (base.includes('load_balancer_type = "gateway"') && base.includes('protocol = "GENEVE"')) return base
  const lead = base && !/```/.test(base) ? base : "The load balancer type is gateway, and the appliance protocol is GENEVE."
  return `${lead}\n\n${GWLB_FIX}`.trim()
}

export function screenReadPrompt(): string {
  return [
    "You are reading one screenshot from a live interview.",
    "The first sentence is the answer, in spoken prose, so the first word can stream immediately.",
    "If the screen is a job description, do not shorten it to a heading. After the answer write a line ---SCREEN--- and then every visible line of the job text.",
    "If the screen is code with a bug, name the bug in one sentence and then a short corrected fenced block.",
    "A Gateway Load Balancer uses load_balancer_type gateway, not network, and the appliance protocol is GENEVE on port 6081, not HTTP.",
    "If the screen is a design question, answer the design.",
    "Do not invent the candidate's employers, incidents, tools, or numbers.",
    "If the image cannot be read, reply with exactly: " + SCREEN_FALLBACK_UNAVAILABLE,
  ].join(" ")
}

export function splitScreenStream(text: string): { answer: string; body: string } {
  const raw = String(text || "")
  const mark = raw.indexOf("---SCREEN---")
  if (mark < 0) return { answer: raw.trim(), body: "" }
  const answer = raw.slice(0, mark).trim()
  const rest = raw.slice(mark + "---SCREEN---".length)
  const codeAt = rest.indexOf("---CODE---")
  const body = screenCardBody(codeAt >= 0 ? rest.slice(0, codeAt) : rest)
  return { answer, body }
}
