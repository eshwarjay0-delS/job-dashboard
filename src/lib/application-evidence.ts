// Conservative, deterministic evidence rules. Absence of evidence remains unknown.
export function emailAddress(value: string): string {
  return value.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase() || ""
}

export function authoredText(body: string): string {
  return body.split(/\n\s*(?:On .+wrote:|From:|>+|[-_]{3,}\s*(?:Original|Forwarded))/i)[0].trim()
}

export function submissionEvidence(body: string): { submitted: boolean; client: boolean; recipient?: string; quote?: string } {
  const sentences = authoredText(body).split(/(?<=[.!?])\s+|\n/)
  for (const sentence of sentences) {
    if (/\b(not|never|haven't|hasn't|hadn't|will|would|could|can|please|if|once|plan|planning|pending)\b|\?/i.test(sentence)) continue
    if (!/\b(?:I|we)\s+(?:have\s+)?(?:submitted|forwarded|shared|sent)\s+(?:your|the)\s+(?:profile|resume)\b|\b(?:your|the)\s+(?:profile|resume)\s+(?:(?:has been|was)\s+)(?:submitted|forwarded|shared|sent)\b/i.test(sentence)) continue
    const target = sentence.match(/\bto\s+(.+)$/i)?.[1] || ""
    return { submitted: true, client: /\b(?:end client|hiring manager|end customer)\b/i.test(target), recipient: emailAddress(target) || undefined, quote: sentence.trim() }
  }
  return { submitted: false, client: false }
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
  messages: Array<{ id: string; internalDate?: string; rfcMessageId?: string; references?: string; sourceThreadId?: string }>
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
  const groups = new Map<number, T[]>()
  ordered.forEach((t, i) => { const key = root(i); groups.set(key, [...(groups.get(key) || []), t]) })
  return [...groups.values()].map(group => {
    const messages = [...new Map(group.flatMap(t => t.messages.map(m => ({ ...m, sourceThreadId: m.sourceThreadId || t.threadId }))).map(m => [m.id, m])).values()]
      .sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0) || a.id.localeCompare(b.id))
    return { ...group[0], messages, sourceThreadIds: group.map(t => t.threadId) } as T & { sourceThreadIds: string[] }
  })
}
