// Conservative, deterministic evidence rules. Absence of evidence remains unknown.
export function emailAddress(value: string): string {
  // Quoted display names can themselves contain an email or angle brackets.
  // They are labels, not the mailbox used for account ownership.
  const unquoted = value.replace(/"(?:\\.|[^"\\])*"/g, "")
  const mailboxes = [...unquoted.matchAll(/<([^<>]+)>/g)]
  if (mailboxes.length > 1) return "" // ambiguous sender is not outbound evidence
  return (mailboxes[0]?.[1] ?? unquoted).match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase() || ""
}

export function authoredText(body: string): string {
  return body.split(/(?:^|\n)\s*(?:On [^\n]*(?:\n[^\n]*){0,3}?wrote:|From:|>+|[-_]{3,}\s*(?:Original|Forwarded))/i)[0].trim()
}

export interface SubmissionEvidence {
  submitted: boolean
  client: boolean
  targetKind?: "client" | "end_client" | "partner" | "recipient" | "unknown"
  recipient?: string
  recipientLabel?: string
  quote?: string
}

export function submissionEvidence(body: string): SubmissionEvidence {
  // Match completed clauses, not entire sentences: a later promise does not
  // invalidate an earlier completed submission. Unfold MIME hard line wraps.
  const sentences = authoredText(body).replace(/\*/g, "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+|;|\s+(?:and|but)\s+(?=(?:soon\s+)?(?:I|we|will|you|please)\b)/i)
  const proofs: SubmissionEvidence[] = []
  for (const sentence of sentences) {
    if (/\b(not|never|haven't|hasn't|hadn't|isn't|wasn't|will|would|could|can|please|if|once|plan|planning|pending)\b|\?/i.test(sentence)) continue
    const completed = /\b(?:I|we)\s+(?:(?:have|had|already|just|successfully)\s+)*(?:submitted|forwarded|shared|sent)\s+(?:your|the)\s+(?:profile|resume|CV)\b|\b(?:your|the)\s+(?:profile|resume|CV)\s+(?:(?:has been|was|is|already|successfully)\s+)*(?:submitted|forwarded|shared|sent)\b|^(?:submitted|forwarded|shared|sent)\s+(?:your|the)\s+(?:profile|resume|CV)\b|^(?:profile|resume|CV)\s+(?:(?:has been|was|is|already|successfully)\s+)*(?:submitted|forwarded|shared|sent)\b/i
    const action = sentence.match(completed)
    if (!action) continue
    const afterAction = sentence.slice((action.index || 0) + action[0].length)
    const target = (afterAction.match(/\b(?:to|with)\s+(.+)$/i)?.[1] || "").replace(/\s+(?:for|regarding)\s+.*$/i, "").replace(/[.,;]+$/, "").trim()
    const partner = /\b(?:partner|vendor|agency|staffing)\b/i.test(target)
    const endClient = !partner && /\b(?:end[ -]client|hiring manager|end[ -]customer)\b/i.test(target)
    const client = !partner && /\b(?:client|customer|hiring manager)\b/i.test(target)
    proofs.push({ submitted: true, client, targetKind: partner ? "partner" : endClient ? "end_client" : client ? "client" : target ? "recipient" : "unknown", recipient: emailAddress(target) || undefined, recipientLabel: target.slice(0, 120) || undefined, quote: sentence.trim() })
  }
  return proofs.find(p => p.client) || proofs.at(-1) || { submitted: false, client: false }
}

export interface CalendarEvidence { uid: string; start?: number; end?: number; cancelled: boolean; summary: string }
export function calendarEvidence(text: string): CalendarEvidence[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "")
  const timestamp = (line?: string) => {
    const m = line?.match(/^DT(?:START|END)(?:;TZID=([^:]+))?:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
    if (!m) return undefined
    const fields = [+m[2], +m[3], +m[4], +m[5], +m[6], +m[7]]
    const wall = Date.UTC(fields[0], fields[1] - 1, fields[2], fields[3], fields[4], fields[5])
    if (m[8]) return wall
    if (!m[1]) return undefined
    const zones: Record<string, string> = { "Eastern Standard Time": "America/New_York", "Central Standard Time": "America/Chicago", "Mountain Standard Time": "America/Denver", "Pacific Standard Time": "America/Los_Angeles", "UTC": "UTC" }
    const zone = zones[m[1]] || m[1].replace(/^"|"$/g, "")
    try {
      const format = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      const local = (ts: number) => {
        const p = Object.fromEntries(format.formatToParts(ts).map(x => [x.type, x.value]))
        return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
      }
      let candidate = wall
      for (let i = 0; i < 3; i++) candidate += wall - local(candidate)
      // Nonexistent or repeated DST wall times need review.
      if (local(candidate) !== wall || local(candidate - 3600000) === wall || local(candidate + 3600000) === wall) return undefined
      return candidate
    } catch { return undefined }
  }
  return [...unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g)].map(match => {
    const block = match[1]
    const field = (key: string) => block.match(new RegExp(`^${key}(?:;[^:]+)?:([^\\r\\n]+)`, "m"))?.[1]
    return { uid: field("UID") || "", start: timestamp(block.match(/^DTSTART[^\r\n]+/m)?.[0]), end: timestamp(block.match(/^DTEND[^\r\n]+/m)?.[0]), cancelled: /^METHOD:CANCEL\s*$/m.test(unfolded) || /^STATUS:CANCELLED\s*$/m.test(block), summary: field("SUMMARY") || "" }
  })
}

export function gmailEvidenceUrl(account: string, messageId: string): string {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(account)}#all/${encodeURIComponent(messageId)}`
}

export interface LinkableThread {
  threadId: string; accountEmail: string;
  messages: Array<{ id: string; internalDate?: string; rfcMessageId?: string; references?: string; sourceThreadId?: string; subject?: string; from?: string; to?: string; cc?: string }>
}
// Only explicit email reference headers merge conversations. Name/domain signals
// can suggest a search, but cannot create a confirmed transfer.
export function linkReferencedThreads<T extends LinkableThread>(input: T[]): Array<T & { sourceThreadIds: string[] }> {
  const ordered = [...input].sort((a, b) => `${a.accountEmail}:${a.threadId}`.localeCompare(`${b.accountEmail}:${b.threadId}`))
  const parents = ordered.map((_, i) => i)
  function root(i: number): number { while (parents[i] !== i) i = parents[i]; return i }
  const owners = new Map<string, number>()
  ordered.forEach((t, i) => t.messages.forEach(m => { if (m.rfcMessageId) owners.set(`${t.accountEmail.toLowerCase()}:${m.rfcMessageId}`, i) }))
  ordered.forEach((t, i) => t.messages.forEach(m => {
    for (const ref of m.references?.match(/<[^>]+>/g) || []) {
      const other = owners.get(`${t.accountEmail.toLowerCase()}:${ref}`)
      if (other !== undefined) parents[root(i)] = root(other)
    }
  }))
  // A requisition ID plus the same exact external participant can reconcile
  // separate RTR/update threads. Role titles, domains and first names alone
  // never establish an application identity or a transfer.
  const requisitions = new Map<string, number>()
  ordered.forEach((t, i) => {
    const ids = [...new Set(t.messages.flatMap(m => m.subject?.match(/\b\d{5,9}(?:-\d+)?\b/g) || []))]
    if (ids.length !== 1) return
    const participants = new Set(t.messages.flatMap(m => `${m.from || ""} ${m.to || ""}`.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(s => s.toLowerCase()))
    participants.delete(t.accountEmail.toLowerCase())
    for (const email of participants) {
      if (/^(?:no-?reply|notifications?|calendar)[@+]/i.test(email)) continue
      const key = `${t.accountEmail.toLowerCase()}:${ids[0]}:${email}`
      const other = requisitions.get(key)
      if (other !== undefined) parents[root(i)] = root(other)
      requisitions.set(key, i)
    }
  })
  const groups = new Map<number, T[]>()
  ordered.forEach((t, i) => { const key = root(i); groups.set(key, [...(groups.get(key) || []), t]) })
  return [...groups.values()].map(group => {
    const messages = [...new Map(group.flatMap(t => t.messages.map(m => ({ ...m, sourceThreadId: m.sourceThreadId || t.threadId }))).map(m => [m.id, m])).values()]
      .sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0) || a.id.localeCompare(b.id))
    return { ...group[0], messages, sourceThreadIds: group.map(t => t.threadId) } as T & { sourceThreadIds: string[] }
  })
}
