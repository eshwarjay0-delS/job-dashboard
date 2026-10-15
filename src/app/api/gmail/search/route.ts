import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, threadsToMails, TRACKING_DAYS, type AuthContext, type ClassifiedThread } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { parseQuery, indexDoc, matches, wordsToShow, findIn, type Indexed, type Found } from "@/lib/mail-search"
import { senderName, senderEmail, splitQuoted, dropFooter, tidy } from "@/lib/mail-reading"

// POST /api/gmail/search  { q, tz, account }      (GET ?q=&tz=&account= answers the same, for trying it by hand)
// The inbox search bar. `q` is what was typed, in Gmail's own words (src/lib/mail-search.ts): plain words, from:, to:,
// cc:, subject:, is:unread, newer_than:7d, older_than:, after:, before:, "a phrase", -leave out, OR, (brackets).
// `tz` is the browser's getTimezoneOffset(), so "after:2026/10/01" starts at the person's own midnight.
// `account` is the inbox chosen on the page, or nothing for all of them: it is applied here, before anything is counted
// or cut to the newest 60, so the number said and the rows shown are of the same inbox.
// It looks inside every message of every conversation this app keeps (the last 90 days), which the page cannot do: the
// page holds one line per conversation. It reads the kept copy only and never calls Gmail, because it is asked on every pause in typing.
// The page sends POST so that what a person searches for is not written into an address or a request log.
// Output { ok, q, kept, searched, count, unknown: [typed but not answerable here], mails: Mail[] (newest first, at most
//          60), hits: { "<account>:<id>": { who, before, hit, after } } (where the word stands, when it is inside a message) }

const MOST = 60
const HOLD_MS = 60_000
const MOST_TEXT = 400_000     // the most of one conversation that is made searchable
const MOST_SHOWN = 20_000     // the most of its quoted history that is kept for showing where a word stands
type Ready = { thread: ClassifiedThread; doc: Indexed; said: Array<{ who: string; text: string }>; earlier: string }
type Mailbox = { at: number; ready: Ready[]; kept: boolean }
// What one person's mail looks like once made searchable, held for a minute so each further letter is not a re-read.
const held = new Map<string, Mailbox>()
// The same work already under way for the same person: a second letter typed meanwhile waits for it, it does not start it again.
const making = new Map<string, Promise<Mailbox>>()

function ready(thread: ClassifiedThread): Ready {
  const ordered = [...thread.messages].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0))
  const said: Ready["said"] = []
  const earlier: string[] = []
  // A reply quotes every message before it, so the tenth reply holds the first message ten times. A line is made
  // searchable once: the first time it is seen in the conversation.
  const seen = new Set<string>()
  const once = (text: string) => text.split("\n").map(l => l.replace(/^[>\s]+/, "").trim()).filter(l => { if (l.length < 2 || seen.has(l)) return false; seen.add(l); return true }).join("\n")
  for (const m of ordered) {
    const cut = splitQuoted(m.bodyText || "")
    const own = dropFooter(tidy(cut.said)).text || tidy(m.snippet || "")
    once(own)
    said.push({ who: senderName(m.from), text: own })
    if (cut.earlier) { const fresh = once(tidy(cut.earlier)); if (fresh) earlier.push(fresh) }
  }
  const latest = ordered[ordered.length - 1]!
  const people = (pick: (m: ClassifiedThread["messages"][number]) => string | undefined) => [...new Set(ordered.map(m => String(pick(m) || "")).filter(Boolean))].join(" ")
  const quoted = earlier.join("\n")
  const doc = indexDoc({
    from: [...new Set(ordered.map(m => `${senderName(m.from)} ${senderEmail(m.from)}`))].join(" "),
    to: people(m => m.to),
    cc: people(m => m.cc),
    subject: [...new Set(ordered.map(m => m.subject))].join(" "),
    text: ([...new Set(ordered.flatMap(m => [m.jobTitle, m.vendor, m.rate]))].join(" ") + " " + said.map(s => s.text).join(" ") + " " + quoted).slice(0, MOST_TEXT),
    unread: ordered.some(m => m.unread),
    ts: Number(latest.internalDate || 0),
  })
  // Newest first: the place shown for a word is its latest mention.
  return { thread, doc, said: said.reverse(), earlier: quoted.slice(0, MOST_SHOWN) }
}

async function readyFor(ctx: AuthContext): Promise<Mailbox> {
  const now = Date.now()
  for (const [k, v] of held) if (now - v.at > HOLD_MS) held.delete(k)
  // The person and the inboxes they have switched on: an inbox disconnected or switched off is a different key.
  const key = `${ctx.userId}:${ctx.accounts.filter(a => a.gmail_enabled).map(a => a.google_email.toLowerCase()).sort().join(",")}`
  const have = held.get(key)
  if (have) return have
  const under = making.get(key)
  if (under) return under
  const work = (async (): Promise<Mailbox> => {
    const { threads, kept } = await keptThreads(ctx, TRACKING_DAYS)
    const made = { at: Date.now(), ready: threads.map(ready), kept }
    if (kept) { if (held.size >= 20) held.delete(held.keys().next().value as string); held.set(key, made) }
    return made
  })()
  making.set(key, work)
  try { return await work } finally { making.delete(key) }
}

async function answer(q: string, tz: number, inbox: string) {
  const ctx = await requireAuth()
  if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
  const rl = checkRateLimit(`gmail-search:${ctx.userId}`, { max: 120, windowMs: 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many searches at once. Wait a moment." }, { status: 429 })

  const typed = String(q || "").trim().slice(0, 300)
  const account = String(inbox || "").trim().toLowerCase().slice(0, 200)
  const query = parseQuery(typed, { tzOffsetMinutes: Math.min(Math.max(Number(tz) || 0, -840), 840) })
  if (query.empty) return NextResponse.json({ ok: true, q: typed, kept: true, searched: 0, count: 0, unknown: query.unknown, mails: [], hits: {} })

  const box = await readyFor(ctx)
  const all = account ? box.ready.filter(r => r.thread.accountEmail.toLowerCase() === account) : box.ready
  const now = Date.now()
  const found = all.filter(r => matches(r.doc, query, now))
  const top = found.slice(0, MOST)
  const words = wordsToShow(query)
  const hits: Record<string, Found & { who: string }> = {}
  if (words.length) {
    for (const r of top) {
      let place: (Found & { who: string }) | null = null
      for (const s of r.said) { const f = findIn(s.text, words); if (f) { place = { ...f, who: s.who }; break } }
      if (!place) { const f = findIn(r.earlier, words); if (f) place = { ...f, who: "" } }
      if (place) hits[`${r.thread.accountEmail}:${r.thread.threadId}`] = place
    }
  }
  return NextResponse.json({ ok: true, q: typed, kept: box.kept, searched: all.length, count: found.length, unknown: query.unknown, mails: threadsToMails(top.map(r => r.thread)), hits })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { q?: unknown; tz?: unknown; account?: unknown }
    return await answer(String(body.q ?? ""), Number(body.tz), String(body.account ?? ""))
  } catch (err) {
    console.error("gmail/search error:", err)
    return NextResponse.json({ ok: false, error: "The search could not be made." }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    return await answer(url.searchParams.get("q") || "", Number(url.searchParams.get("tz")), url.searchParams.get("account") || "")
  } catch (err) {
    console.error("gmail/search error:", err)
    return NextResponse.json({ ok: false, error: "The search could not be made." }, { status: 500 })
  }
}
