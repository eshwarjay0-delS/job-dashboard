// What an email says, made readable. Pure functions: no network, no imports.
//
// The owner, 12 Oct 2026, of /dashboard/mail: "the Email inboxes are so freaking messy I can't read or understand anything
// from it."
//
// THE MISTAKE THIS FILE PREVENTS. The inbox page never showed an email. It showed the first 140 characters Gmail gives as a
// "snippet", under a title worked out from the sender's domain, and then a stack of reply tools. There was nothing to read.
// The text of every message was already kept on the server (`bodyText`); it was only never sent to the page.
//
// So this turns a thread into what a person reads: each message in order, who said it, when, and what THEY wrote. The
// earlier messages an email client quotes underneath are split off (they are the previous message, already shown above),
// and so is the legal notice or the unsubscribe block at the foot. Nothing is reworded: a line is kept or set aside whole.

export interface ReadMessage {
  id: string
  who: string        // the person's name, or the first part of their address
  email: string
  mine: boolean      // written from one of the person's own connected accounts
  at: number         // epoch ms, 0 when Gmail gave no date
  text: string       // what this message itself says
  earlier: string    // the quoted history under it, kept for "show earlier" and never shown by default
  footer: boolean    // a legal notice or unsubscribe block was set aside
}
export interface ThreadLike {
  threadId: string
  accountEmail: string
  messages: Array<{ id: string; from: string; subject: string; snippet: string; internalDate?: string; bodyText?: string }>
}
export interface Reading { subject: string; messages: ReadMessage[] }

const ENTITY: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™" }
/** "&amp;" and "&#39;" as the characters they stand for. Gmail's snippet arrives with them still encoded. */
export function decodeEntities(text: string): string {
  return String(text || "")
    .replace(/&#(\d{1,6});/g, (m, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m })
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, n) => { const c = parseInt(n, 16); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m })
    .replace(/&([a-z]{2,8});/gi, (m, n) => ENTITY[String(n).toLowerCase()] ?? m)
}

/** "Priya Raman <priya@tekblu.us>" as "Priya Raman". With no name, the part of the address before the @. */
export function senderName(from: string): string {
  const raw = decodeEntities(String(from || "")).trim()
  const email = raw.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ""
  const name = raw.replace(/<[^>]*>/g, "").replace(email, "").replace(/^["'\s]+|["'\s]+$/g, "").trim()
  // A directory writes "Dasari, Jeevan". People say "Jeevan Dasari", and the first word is then the name to greet by.
  const flipped = /^([^,]{2,30}),\s*([^,]{2,30})$/.exec(name)
  if (flipped && !/\b(?:inc|llc|ltd|corp|co|group|team|via)\b/i.test(name)) return `${flipped[2]!.trim()} ${flipped[1]!.trim()}`
  if (name) return name
  return email ? email.split("@")[0]! : raw
}

/* Is the last thing they wrote a "nothing for you to do yet"? Read on the owner's mail, 12 Oct 2026: the first mail under
   "Your turn" said they had no update and would follow up. A message that says they will come back to you, and asks
   nothing, leaves the turn with them. Conservative on purpose: one question mark or one "please" and it is an ask. */
const THEY_WILL = /\b(?:(?:i|we)(?:'ll| will| shall) (?:follow up|keep you (?:posted|updated|informed)|get back to you|update you|let you know|reach out|be in touch|circle back)|(?:haven'?t|have not|yet to) (?:received|heard|gotten|got)\b[^.?!]{0,60}\b(?:update|feedback|response|back)|no (?:update|feedback|news) (?:yet|so far|at this time)|still (?:waiting|awaiting)|awaiting (?:feedback|an update|a response|client))/i
const ASKS = /\?|\b(?:please|kindly|could you|can you|would you|let me know|need you to|you need to|at your earliest|asap)\b/i
export function saysWaitForUs(text: string): boolean {
  const said = splitQuoted(decodeEntities(String(text || ""))).said
  return THEY_WILL.test(said) && !ASKS.test(said)
}
export function senderEmail(from: string): string {
  return String(from || "").match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase() || ""
}

// Where the writer's own words end and the quoted history begins: "On Mon, ... wrote:", an Outlook "From: ... Sent: ..."
// block, a line of ">" quotes, "-----Original Message-----", or Outlook's long underscore rule.
const QUOTED = /(?:^|\n)[ \t]*(?:On [^\n]{4,200}(?:\n[^\n]*){0,3}?wrote:|From:[ \t][^\n]*\n[ \t]*(?:Sent|Date|To):|>+[ \t]?\S|[-_]{3,}[ \t]*(?:Original|Forwarded)[ \t]+(?:Message|message)|_{20,})/
/** One message's own words, and the history quoted under them. A forward with nothing written above it is all `said`. */
export function splitQuoted(body: string): { said: string; earlier: string } {
  const text = String(body || "")
  const at = text.search(QUOTED)
  if (at < 0) return { said: text.trim(), earlier: "" }
  const said = text.slice(0, at).trim()
  return said ? { said, earlier: text.slice(at).trim() } : { said: text.trim(), earlier: "" }
}

/**
 * Only what the writer typed above the quoted history. Unlike splitQuoted, a reply with nothing typed above it (an
 * attachment on its own, a bare forward) gives "": the mail quoted under it is somebody else's words, and must never be
 * taken for the writer's own.
 */
export function ownPart(body: string): string {
  const text = String(body || "")
  const at = text.search(QUOTED)
  return (at < 0 ? text : text.slice(0, at)).trim()
}

// A notice that is the same under every email from that company: it is not part of what the person wrote.
const FOOTER = /(?:^|\n)[ \t*_]*(?:CONFIDENTIALITY (?:NOTICE|STATEMENT)|DISCLAIMER\b|You have received this (?:e-?mail|message) because|This (?:e-?mail|message|communication)(?:,? (?:and|including) any (?:attachments?|files)[^\n]{0,40})? (?:is|are|may contain|contains|and its)[^\n]{0,40}(?:confidential|privileged|intended (?:only|solely))|To (?:unsubscribe|stop receiving|opt[ -]?out)|Unsubscribe\b|If you (?:no longer wish|do not wish|would like to (?:be removed|unsubscribe|opt[ -]?out))|You(?:'re| are) receiving this (?:e-?mail|message)|Note: (?:We respect|If you are not the intended)|We respect your (?:online )?privacy)/i
/** The text without its legal notice or unsubscribe block. Cut only when real writing comes first, never the whole message. */
export function dropFooter(text: string): { text: string; cut: boolean } {
  const at = text.search(FOOTER)
  if (at < 120) return { text, cut: false }
  return { text: text.slice(0, at).trimEnd(), cut: true }
}

/** Whitespace and noise only: no word of the message is changed. */
export function tidy(text: string): string {
  let t = decodeEntities(String(text || "")).replace(/\r\n?/g, "\n").replace(/[​-‍﻿­]/g, "").replace(/ /g, " ")
  // The spaces at the end of a line, taken off by counting back from the end. As a pattern ("spaces, then the end") this
  // took 16 seconds on one line of 99,000 spaces followed by a full stop: each run of spaces was read again from every
  // space in it. A body is kept up to 100,000 characters and anyone can send one.
  const endTrimmed = (l: string) => { let e = l.length; while (e > 0 && (l[e - 1] === " " || l[e - 1] === "\t")) e--; return e === l.length ? l : l.slice(0, e) }
  t = t.split("\n").map(endTrimmed).filter(l => !/^\s*\[(?:image|cid|logo)[^\]]{0,80}\]\s*$/i.test(l)).join("\n")
  // A link as a mail program writes it in plain text: "[Sign the form](https://site/a-very-long-tail)" or
  // "Sign the form <https://site/a-very-long-tail>". What a person reads is its name and where it goes; the tail is noise.
  // Seen in a real recruiter mail on 12 Oct 2026: one signing link was 430 characters of the message.
  const host = (url: string) => url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] || url
  // An address a mail program wrote twice: "dana@site.example<mailto:dana@site.example>". Once is enough.
  t = t.replace(/<mailto:[^>\s]*>?/gi, "")
  t = t.replace(/\[([^\]\n]{0,160})\]\((https?:\/\/[^\s)]+)\)/g, (_m, name: string, url: string) => (name.trim() ? `${name.trim()} (link: ${host(url)})` : `(link: ${host(url)})`))
  // The spaces before the link are written so that only one part of the pattern can take any given space (the part
  // that ends in a line break, or the part after it): with two parts both able to, a long run of spaces was read over
  // and over (same measurement as above).
  t = t.replace(/(\S)(?:[ \t]*\n)?[ \t]*<(https?:\/\/[^\s>]+)>/g, (_m, before: string, url: string) => `${before} (link: ${host(url)})`)
  // A bare link with a tracking tail: its address is kept, its tail is not shown.
  t = t.replace(/https?:\/\/([^\s/<>"')]+)\/[^\s<>"')]{60,}/g, "https://$1/…")
  // A plain-text email is cut at about 72 characters a line. A long line followed by a line that carries on in small
  // letters is one sentence: it is joined. A list, a signature and an address keep their lines.
  const lines = t.split("\n"), out: string[] = []
  for (const line of lines) {
    const prev = out[out.length - 1]
    if (prev !== undefined && prev.length >= 58 && prev.length <= 90 && /^[a-z(]/.test(line) && !/[.!?:]$/.test(prev) && !/^\s*(?:[-*•]|\d+[.)])\s/.test(line)) out[out.length - 1] = prev + " " + line
    else out.push(line)
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

export interface Contacts { phones: Array<{ number: string; who: string }>; emails: Array<{ email: string; who: string }> }
// A North American number as people write it in a signature: (608) 555-0123, 608-555-0123, +1 608 555 0123 x204.
// Ten digits, so a job number ("166719") and a year are never taken for one.
const PHONE = /(?<![\d.])(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d{1,6})?(?![\d])/gi
const ADDRESS = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
/** How to reach the people in this conversation: the numbers and addresses THEY wrote, never the person's own. */
export function contactsOf(reading: Reading): Contacts {
  const phones = new Map<string, { number: string; who: string }>(), emails = new Map<string, { email: string; who: string }>()
  const mine = new Set(reading.messages.filter(m => m.mine).map(m => m.email))
  for (const m of reading.messages) {
    if (m.mine) continue
    if (m.email && !emails.has(m.email)) emails.set(m.email, { email: m.email, who: m.who })
    for (const hit of m.text.match(PHONE) || []) {
      const digits = hit.replace(/(?:x|ext\.?|extension)\s*\d+$/i, "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")
      if (digits.length !== 10 || phones.has(digits)) continue
      const ext = hit.match(/(?:x|ext\.?|extension)\s*(\d+)$/i)?.[1]
      phones.set(digits, { number: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}${ext ? " ext. " + ext : ""}`, who: m.who })
    }
    for (const hit of m.text.match(ADDRESS) || []) {
      const email = hit.toLowerCase().replace(/[.]+$/, "")
      if (!mine.has(email) && !emails.has(email)) emails.set(email, { email, who: m.who })
    }
  }
  return { phones: [...phones.values()].slice(0, 6), emails: [...emails.values()].slice(0, 6) }
}

/** When the conversation began, when it last moved, and who spoke last: the "where does this stand" line. */
export function sequenceOf(reading: Reading): { count: number; first: number; last: number; lastMine: boolean } {
  const ms = reading.messages
  return { count: ms.length, first: ms[0]?.at || 0, last: ms[ms.length - 1]?.at || 0, lastMine: !!ms[ms.length - 1]?.mine }
}

/* Whose turn it is. Measured on the owner's own inboxes on 12 Oct 2026: the page said 39 emails "need your reply", and in
   30 of them the last word was already his. An ask is only open if they made it AFTER he last wrote.
   `since` is everything they have written since his last message (all of it, when he has never written). */
export function turnOf<T extends { from: string; internalDate?: string }>(messages: T[], myEmails: string[]): { lastMine: boolean; myLastAt: number; since: T[] } {
  const mine = new Set(myEmails.map(e => String(e || "").toLowerCase()).filter(Boolean))
  const ordered = [...(messages || [])].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0))
  let myLastAt = 0, myLastIndex = -1
  ordered.forEach((m, i) => { if (mine.has(senderEmail(m.from))) { myLastAt = Number(m.internalDate || 0); myLastIndex = i } })
  return { lastMine: ordered.length > 0 && myLastIndex === ordered.length - 1, myLastAt, since: ordered.slice(myLastIndex + 1) }
}

/* What a mail is about, in the few words a person would use: the job. A recruiter's subject line is a shout
   ("Urgent Hiring || Cybersecurity Analyst 166719 || State of Wisconsin || Madison, WI (HYBRID)") and on the owner's
   inboxes 199 of 255 rows showed that line, cut off at 60 characters, as "the role". This picks the part that names a job
   and drops the shouting, the request number and the place. When no part names a job, the subject is kept, tidied. */
const TITLE = /\b(?:engineer|analyst|architect|developer|administrator|admin|consultant|manager|specialist|lead|director|officer|designer|scientist|tester|technician|programmer|devops|sre|sme|expert|auditor|coordinator)\b/i
export function aboutOf(subject: string): string {
  const clean = decodeEntities(String(subject || "")).replace(/^(?:\s*(?:re|fw|fwd)\s*:\s*)+/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim()
  if (!clean) return ""
  // "II" typed for "||" is a divider only when it is used as one, twice or more: "Security Analyst II" is a grade.
  const bars = (clean.match(/ II /g) || []).length >= 2 ? clean.replace(/ II /g, " || ") : clean
  // A hyphen divides when it has a space on either side ("220417 -Network Analyst", "Analyst - Austin"); inside a word it does not ("On-site").
  const parts = bars.split(/\s*(?:\|\|+|\||!!+|::|-{2,}|–|—|\s+-\s*|\s*-\s+|:\s)\s*/).map(p => p.replace(/^[\s\-–—:|#]+/, "").trim()).filter(Boolean)
  const part = parts.find(p => TITLE.test(p))
  if (!part) return clean.length > 80 ? clean.slice(0, 77).trimEnd() + "…" : clean
  const job = part
    .replace(/^(?:(?:urgent(?:ly)?|immediate(?:ly)?|hot|new|direct client|hiring|need(?:ed)?|opening|requirement|role|position|job|for|a|an|the)\b[\s:!-]*)+/i, "")
    .replace(/\s+(?:at|in|for|@)\s+.*$/i, "")                      // "... at Atlanta GA for Delta Air Lines"; "with Java experience" is part of the job
    .replace(/\s*[#(\[]?\s*\b\d{4,}\b\s*[)\]]?/g, "")               // a request number
    .replace(/\s*\((?:[^)]*)\)\s*$/g, "")                           // "(Hybrid)", "(C2C)"
    .replace(/[\s,;:-]+$/g, "").trim()
  return job || part
}

const MOST = 12, LONGEST = 8000
/** A thread as it is read: oldest first, each message's own words, the last twelve. */
export function readThread(thread: ThreadLike, myEmails: string[]): Reading {
  const mine = new Set(myEmails.map(e => String(e || "").toLowerCase()).filter(Boolean))
  const ordered = [...(thread.messages || [])].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0))
  const messages = ordered.slice(-MOST).map((m): ReadMessage => {
    const email = senderEmail(m.from)
    const { said, earlier } = splitQuoted(m.bodyText || "")
    const body = dropFooter(tidy(said))
    // Gmail's own first lines when the full text was never stored: better a short true line than an empty box.
    const text = (body.text || tidy(m.snippet || "")).slice(0, LONGEST)
    return { id: m.id, who: senderName(m.from), email, mine: mine.has(email), at: Number(m.internalDate || 0), text, earlier: tidy(earlier).slice(0, LONGEST), footer: body.cut }
  })
  const subject = tidy(ordered[ordered.length - 1]?.subject || "").replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, "")
  return { subject, messages }
}
