// Conversational automation: parse plain-English automation requests into
// structured intents. V1 supports sender watch/mute (uses the existing
// notify-rules API). V2 will add reminders and digest schedules.
// Pure function — no LLM, predictable regex parsing for v1.

export type AutomationIntent =
  | { kind: "watch_sender"; sender: string; account?: string }
  | { kind: "mute_sender"; sender: string; account?: string }
  | { kind: "unknown"; raw: string }

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

// Patterns for "always notify" / watch
const WATCH_PATTERNS = [
  /(?:always\s+)?(?:notify|alert)\s+me\s+(?:about|when)\s+(.+)/i,
  /watch\s+(.+)/i,
  /(?:tell|let)\s+me\s+(?:when|if)\s+(.+?)\s+(?:emails?|writes?|contacts?)/i,
  /ping\s+me\s+(?:when|if)\s+(.+)/i,
]

// Patterns for "never notify" / mute
const MUTE_PATTERNS = [
  /(?:never\s+)?(?:don't|do\s+not)\s+(?:notify|alert|tell)\s+me\s+(?:about\s+)?(.+)/i,
  /mute\s+(.+)/i,
  /ignore\s+(.+)/i,
  /(?:stop|turn\s+off)\s+(?:notifications?\s+for\s+)?(.+)/i,
]

function extractSender(text: string): string | null {
  // Prefer an explicit email address
  const email = text.match(EMAIL_RE)
  if (email) return email[0].toLowerCase()
  // Otherwise take the captured name/phrase, trimmed of trailing punctuation
  const cleaned = text.trim().replace(/[.,!?]+$/, "").trim()
  return cleaned.length > 0 && cleaned.length < 100 ? cleaned : null
}

export function parseAutomationIntent(input: string): AutomationIntent {
  const text = input.trim()
  if (!text) return { kind: "unknown", raw: input }

  // Check MUTE first: "don't notify me about X" contains "notify me about X"
  // which would false-match a WATCH pattern.
  for (const pattern of MUTE_PATTERNS) {
    const m = text.match(pattern)
    if (m) {
      const sender = extractSender(m[1])
      if (sender) return { kind: "mute_sender", sender }
    }
  }

  for (const pattern of WATCH_PATTERNS) {
    const m = text.match(pattern)
    if (m) {
      const sender = extractSender(m[1])
      if (sender) return { kind: "watch_sender", sender }
    }
  }

  return { kind: "unknown", raw: input }
}

// Match a sender name/phrase against known email addresses from recent mail.
// Returns the email if confident, null otherwise.
export function matchSender(
  query: string,
  candidates: Array<{ email: string; name?: string }>
): string | null {
  const q = query.toLowerCase().trim()
  if (!q) return null

  // Exact email match
  if (q.includes("@")) {
    const found = candidates.find(c => c.email.toLowerCase() === q)
    if (found) return found.email
    // Partial email match
    const partial = candidates.find(c => c.email.toLowerCase().includes(q))
    if (partial) return partial.email
    return null
  }

  // Name match: check if query words appear in the name or email
  const qWords = q.split(/\s+/)
  const scored = candidates
    .map(c => {
      const nameLower = (c.name || "").toLowerCase()
      const emailLower = c.email.toLowerCase()
      let score = 0
      for (const w of qWords) {
        if (w.length < 2) continue
        if (nameLower.includes(w)) score += 2
        else if (emailLower.includes(w)) score += 1
      }
      return { email: c.email, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  // Require a clear winner (score > 1 or single match)
  if (scored.length === 0) return null
  if (scored.length === 1) return scored[0].email
  if (scored[0].score > scored[1].score) return scored[0].email
  return null // ambiguous
}
