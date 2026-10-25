import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, TRACKING_DAYS, type ClassifiedThread } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { readRecruiters } from "@/lib/my-recruiters-store"
import { sendGmailMessage } from "@/lib/gmailSend"
import {
  classifySender, senderEmailOf, firstNameOf, isRolePitch, isAvailabilityAsk, hasBundledAsk,
  gateReply, availabilityReply, gateViolations, availabilityViolations,
  chainsMatch, cardKey, bucketFor, cardHeader, verbLabel,
  validDelegateOptIn, delegateEligible, SKIP_RENUDGE_MS, NEVER_AUTO_SEND,
  type SenderClass, type PatternId, type DelegateOptIn, type Bucket,
} from "@/lib/reply-patterns"

export const runtime = "nodejs"

type LogEntry = { patternId: PatternId; account: string; senderEmail: string; threadId: string; mode: "tier1" | "tier2"; at: string; cardKey: string; body?: string }
type SkipEntry = { cardKey: string; patternId: PatternId; at: string }
type HandledEntry = { cardKey: string; at: string }

function str(v: unknown): string { return typeof v === "string" ? v : "" }
function asLog(v: unknown): LogEntry[] {
  if (!Array.isArray(v)) return []
  return v.filter((e): e is LogEntry => !!e && typeof e === "object"
    && (e as LogEntry).patternId !== undefined && typeof (e as LogEntry).account === "string"
    && typeof (e as LogEntry).threadId === "string").slice(0, 200)
}
function asSkips(v: unknown): SkipEntry[] {
  if (!Array.isArray(v)) return []
  return v.filter((e): e is SkipEntry => !!e && typeof e === "object" && typeof (e as SkipEntry).cardKey === "string").slice(0, 100)
}
function asHandled(v: unknown): HandledEntry[] {
  if (!Array.isArray(v)) return []
  return v.filter((e): e is HandledEntry => !!e && typeof e === "object" && typeof (e as HandledEntry).cardKey === "string").slice(0, 200)
}
function asOptIns(v: unknown): DelegateOptIn[] {
  if (!Array.isArray(v)) return []
  return v.filter(validDelegateOptIn)
}

function reqNumberOf(text: string): string {
  const m = text.match(/req(?:uest)?(?:\s*#|\s+no\.?)?\s*(\d{4,})/i)
  return m ? m[1] : ""
}

type Card = {
  key: string; threadId: string; account: string; role: string; client: string; req: string
  recruiterName: string; recruiterEmail: string; senderClass: SenderClass
  latestAsk: string; category: string; pattern: PatternId | null; patternReason: string
  gateBody: string | null; availabilityBody: string | null
  bucket: Bucket; doubleSubmitHold: boolean; gateAlreadySent: boolean
  skipped: boolean; header: { what: string; todo: string; ifIgnored: string }
}

function buildCards(threads: ClassifiedThread[], vendorEmails: string[], vendorDomains: string[],
  log: LogEntry[], skips: SkipEntry[], handled: HandledEntry[]): Card[] {
  const now = Date.now()
  const handledKeys = new Set(handled.map(h => h.cardKey))
  const raw: Omit<Card, "doubleSubmitHold" | "bucket">[] = []
  for (const t of threads) {
    const latest = t.messages[t.messages.length - 1]
    if (!latest) continue
    const recruiterEmail = senderEmailOf(latest.from)
    if (!recruiterEmail) continue
    const senderClass = classifySender({ senderEmail: recruiterEmail, vendorEmails, vendorDomains })
    // A thread already carrying a submission or interview pipeline is an
    // established chain, not a first pitch: the gate must not re-fire.
    const established = senderClass === "known-vendor"
      || t.messages.some(m => m.category === "Submission Confirmation" || m.category === "Interview Request")
    const cls: SenderClass = senderClass === "marketing" ? "marketing" : established ? "known-vendor" : "new-external"
    const text = `${latest.subject} ${latest.snippet} ${latest.bodyText || ""}`
    const role = latest.jobTitle || latest.subject
    const req = reqNumberOf(`${latest.subject} ${latest.snippet}`)
    const key = cardKey({ req, senderEmail: recruiterEmail, role, firstPitchDate: t.messages[0]?.internalDate || "" })
    const first = firstNameOf(latest.from)
    const gateSent = log.some(l => l.patternId === "gate-c2c-c2h" && l.threadId === t.threadId)
    const skipped = skips.some(s => s.cardKey === key && now - Date.parse(s.at) < SKIP_RENUDGE_MS)
    let pattern: PatternId | null = null
    let reason = ""
    let gateBody: string | null = null
    let availBody: string | null = null
    if (cls === "marketing") {
      reason = "Marketing filing: filed, never replied."
    } else if (cls === "new-external" && isRolePitch({ senderClass: cls, category: latest.category, text, jobTitle: latest.jobTitle })) {
      if (gateSent) reason = "Gate already sent on this thread; waiting for the engagement answer."
      else { pattern = "gate-c2c-c2h"; gateBody = gateReply(first, role); reason = "New external recruiter pitching a role: confirm C2C or C2H first." }
    } else if (isAvailabilityAsk(text)) {
      pattern = "availability-interview"; availBody = availabilityReply(first); reason = "Pure interview-availability ask."
    } else if (hasBundledAsk(text) && /available|availability/i.test(text)) {
      reason = "Availability ask is bundled with a rate, RTR or document ask: split it, never bundle it into one auto-send."
    } else {
      reason = "No gate or availability pattern fires on this thread."
    }
    const resolved = handledKeys.has(key)
    raw.push({
      key, threadId: t.threadId, account: t.accountEmail, role, client: "", req,
      recruiterName: latest.vendor || first, recruiterEmail, senderClass: cls,
      latestAsk: latest.snippet, category: latest.category, pattern, patternReason: reason,
      gateBody, availabilityBody: availBody,
      gateAlreadySent: gateSent, skipped,
      header: cardHeader({ role, recruiterName: latest.vendor || first, decision: pattern ? verbLabel(pattern) : reason, deadline: "" }),
    })
  }
  // Double-submit hold: two cards, different senders, same req number, or
  // client plus role plus location all matching (location is empty here,
  // so the req-number path is the one that can hold automatically; weaker
  // matches are left for a human link, never auto-held).
  const byReq = new Map<string, Card[]>()
  for (const c of raw) if (c.req) {
    const list = byReq.get(c.req) || []
    list.push(c as Card)
    byReq.set(c.req, list)
  }
  const heldKeys = new Set<string>()
  for (const list of byReq.values()) {
    const senders = new Set(list.map(c => c.recruiterEmail))
    if (list.length > 1 && senders.size > 1) for (const c of list) heldKeys.add(c.key)
  }
  return raw.map(c => {
    const hold = heldKeys.has(c.key)
    const sentAwaiting = log.some(l => l.threadId === c.threadId)
    const decisionWaiting = c.pattern !== null && !c.skipped && !hold
    const bucket = bucketFor({ decisionWaiting, sentAwaitingReply: sentAwaiting, resolved: handledKeys.has(c.key), filedOnly: c.senderClass === "marketing" })
    return { ...c, doubleSubmitHold: hold, bucket, pattern: hold ? null : c.pattern, gateBody: hold ? null : c.gateBody, availabilityBody: hold ? null : c.availabilityBody, patternReason: hold ? "Double-submit hold: two chains on this req. Pick one chain before anything sends." : c.patternReason }
  })
}

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    const rl = checkRateLimit(`gmail-reply-patterns:${ctx.userId}`, { max: 20, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    const { data: { user } } = await ctx.supabase.auth.getUser()
    const meta = (user?.user_metadata || {}) as Record<string, unknown>
    const optIns = asOptIns(meta.gmail_reply_delegate_optins)
    const log = asLog(meta.gmail_reply_pattern_log)
    const skips = asSkips(meta.gmail_reply_pattern_skips)
    const handled = asHandled(meta.gmail_reply_pattern_handled)
    const view = new URL(req.url).searchParams.get("view")
    if (view === "cards") {
      const recruiters = await readRecruiters(ctx.userId)
      const vendorEmails = recruiters.filter(r => r.kind === "person").map(r => r.value)
      const vendorDomains = recruiters.filter(r => r.kind === "company").map(r => r.value)
      // Kept copy first: instant on later visits. fetchWhenEmpty runs the
      // existing incremental Gmail discovery once when there is no copy,
      // and the 30-minute inbox watcher plus the mail page refresh keep it
      // current afterwards — new mail appends, nothing rescans per visit.
      const kept = await keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: true })
      const cards = buildCards(kept.threads, vendorEmails, vendorDomains, log, skips, handled)
      const counts = { needsYou: 0, waiting: 0, done: 0 } as Record<string, number>
      for (const c of cards) counts[c.bucket === "needs-you" ? "needsYou" : c.bucket]++
      return NextResponse.json({ ok: true, kept: kept.kept, counts, cards })
    }
    return NextResponse.json({
      ok: true,
      patterns: [
        { id: "gate-c2c-c2h", label: verbLabel("gate-c2c-c2h"), body: gateReply("[first name]", "[role]"), tier: "tier1" },
        { id: "availability-interview", label: verbLabel("availability-interview"), body: availabilityReply("[first name]"), tier: "tier1-or-delegate" },
        { id: "followup-weekly-interview", label: verbLabel("followup-weekly-interview"), tier: "tier1" },
      ],
      buckets: ["needs-you", "waiting", "done"],
      neverAutoSend: NEVER_AUTO_SEND,
      optIns,
      log: log.map(({ body: _b, ...rest }) => rest),
      skips,
      handled,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    const rl = checkRateLimit(`gmail-reply-patterns:${ctx.userId}`, { max: 20, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = str(body.action)
    const { data: { user } } = await ctx.supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 })
    const meta = (user.user_metadata || {}) as Record<string, unknown>
    const optIns = asOptIns(meta.gmail_reply_delegate_optins)
    const log = asLog(meta.gmail_reply_pattern_log)
    const skips = asSkips(meta.gmail_reply_pattern_skips)
    const handled = asHandled(meta.gmail_reply_pattern_handled)
    const save = async (data: Record<string, unknown>) => {
      const r = await ctx.supabase.auth.updateUser({ data })
      return !r.error
    }

    if (action === "classify") {
      const senderEmail = senderEmailOf(str(body.from))
      const cls = classifySender({
        senderEmail,
        vendorEmails: Array.isArray(body.vendorEmails) ? body.vendorEmails.map(String) : [],
        vendorDomains: Array.isArray(body.vendorDomains) ? body.vendorDomains.map(String) : [],
        priorSenders: Array.isArray(body.priorSenders) ? body.priorSenders.map(String) : [],
      })
      const text = `${str(body.subject)} ${str(body.preview)}`
      const pitch = isRolePitch({ senderClass: cls, category: str(body.category), text, jobTitle: str(body.jobTitle) })
      const avail = isAvailabilityAsk(text)
      const first = firstNameOf(str(body.from))
      return NextResponse.json({
        ok: true, senderClass: cls,
        isRolePitch: pitch, gateBody: pitch ? gateReply(first, str(body.jobTitle)) : null,
        isAvailabilityAsk: avail, availabilityBody: avail ? availabilityReply(first) : null,
        bundled: hasBundledAsk(text),
      })
    }

    if (action === "optin" || action === "optout") {
      const patternId = str(body.patternId)
      const account = str(body.account).toLowerCase()
      const senderClass = str(body.senderClass) as SenderClass
      if (patternId !== "availability-interview") return NextResponse.json({ ok: false, error: "Only availability-interview can be delegated." }, { status: 400 })
      const accounts = await listGoogleWorkspaceAccounts(ctx.userId)
      if (!accounts.some(a => a.google_email.toLowerCase() === account && a.gmail_enabled)) {
        return NextResponse.json({ ok: false, error: "Account is not connected." }, { status: 400 })
      }
      if (senderClass !== "new-external" && senderClass !== "known-vendor") {
        return NextResponse.json({ ok: false, error: "Delegate covers new-external or known-vendor only, never marketing firms." }, { status: 400 })
      }
      let next: DelegateOptIn[]
      if (action === "optin") {
        const optIn: DelegateOptIn = { patternId: "availability-interview", account, senderClass, enabledAt: new Date().toISOString() }
        next = [...optIns.filter(o => !(o.patternId === optIn.patternId && o.account === account && o.senderClass === senderClass)), optIn]
      } else {
        next = optIns.filter(o => !(o.patternId === patternId && o.account === account && o.senderClass === senderClass))
      }
      const saved = await save({ gmail_reply_delegate_optins: next })
      if (!saved) return NextResponse.json({ ok: false, error: "Could not save delegate preference." }, { status: 500 })
      return NextResponse.json({ ok: true, optIns: next })
    }

    if (action === "skip") {
      const key = str(body.cardKey)
      const patternId = str(body.patternId) as PatternId
      if (!key) return NextResponse.json({ ok: false, error: "cardKey is required." }, { status: 400 })
      const next = [{ cardKey: key, patternId, at: new Date().toISOString() }, ...skips.filter(s => s.cardKey !== key)].slice(0, 100)
      const saved = await save({ gmail_reply_pattern_skips: next })
      if (!saved) return NextResponse.json({ ok: false, error: "Could not save skip." }, { status: 500 })
      return NextResponse.json({ ok: true, note: "Skip pauses only the 48-hour re-nudge for this ask; the weekly follow-up cadence is unchanged." })
    }

    if (action === "handled") {
      const key = str(body.cardKey)
      if (!key) return NextResponse.json({ ok: false, error: "cardKey is required." }, { status: 400 })
      const next = [{ cardKey: key, at: new Date().toISOString() }, ...handled.filter(h => h.cardKey !== key)].slice(0, 200)
      const saved = await save({ gmail_reply_pattern_handled: next })
      if (!saved) return NextResponse.json({ ok: false, error: "Could not save." }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === "send") {
      const mode = str(body.mode) === "tier2" ? "tier2" : "tier1"
      const patternId = str(body.patternId) as PatternId
      const account = str(body.account).toLowerCase()
      const threadId = str(body.threadId)
      const sendBody = str(body.body)
      if (!threadId || !account || !sendBody) return NextResponse.json({ ok: false, error: "threadId, account and body are required." }, { status: 400 })
      if (patternId !== "gate-c2c-c2h" && patternId !== "availability-interview") {
        return NextResponse.json({ ok: false, error: "Only the gate and availability patterns send from here." }, { status: 400 })
      }
      const accounts = await listGoogleWorkspaceAccounts(ctx.userId)
      const acct = accounts.find(a => a.google_email.toLowerCase() === account && a.gmail_enabled)
      if (!acct) return NextResponse.json({ ok: false, error: "Account is not connected." }, { status: 400 })
      const recruiters = await readRecruiters(ctx.userId)
      const vendorEmails = recruiters.filter(r => r.kind === "person").map(r => r.value)
      const vendorDomains = recruiters.filter(r => r.kind === "company").map(r => r.value)
      const kept = await keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: true })
      const thread = kept.threads.find(t => t.threadId === threadId && t.accountEmail.toLowerCase() === account)
      if (!thread) return NextResponse.json({ ok: false, error: "Thread not found in the kept copy." }, { status: 404 })
      const latest = thread.messages[thread.messages.length - 1]
      const senderEmail = senderEmailOf(latest.from)
      const senderClass = classifySender({ senderEmail, vendorEmails, vendorDomains })
      const established = thread.messages.some(m => m.category === "Submission Confirmation" || m.category === "Interview Request")
      const cls: SenderClass = senderClass === "marketing" ? "marketing" : established ? "known-vendor" : "new-external"
      if (cls === "marketing") return NextResponse.json({ ok: false, error: "Marketing firms are never reply targets." }, { status: 403 })
      const text = `${latest.subject} ${latest.snippet} ${latest.bodyText || ""}`
      const first = firstNameOf(latest.from)
      const allCards = buildCards(kept.threads, vendorEmails, vendorDomains, log, skips, handled)
      const card = allCards.find(c => c.threadId === threadId)
      if (card?.doubleSubmitHold) return NextResponse.json({ ok: false, error: "Double-submit hold: pick one chain before anything sends." }, { status: 403 })
      if (patternId === "gate-c2c-c2h") {
        if (mode === "tier2") return NextResponse.json({ ok: false, error: "The gate can never be delegated." }, { status: 403 })
        if (cls !== "new-external") return NextResponse.json({ ok: false, error: "The gate fires only for a new external recruiter." }, { status: 403 })
        if (!isRolePitch({ senderClass: cls, category: latest.category, text, jobTitle: latest.jobTitle })) {
          return NextResponse.json({ ok: false, error: "This thread is not a new role pitch." }, { status: 403 })
        }
        const v = gateViolations(sendBody)
        if (v.length) return NextResponse.json({ ok: false, error: `Gate reply fails guardrails: ${v.join(", ")}` }, { status: 403 })
        if (!/C2C/i.test(sendBody)) return NextResponse.json({ ok: false, error: "Gate reply must ask the C2C-or-C2H question." }, { status: 403 })
      } else {
        const v = availabilityViolations(sendBody)
        if (v.length) return NextResponse.json({ ok: false, error: `Availability reply fails guardrails: ${v.join(", ")}` }, { status: 403 })
        if (mode === "tier2") {
          const optIn = optIns.find(o => o.patternId === "availability-interview" && o.account === account && o.senderClass === cls)
          const priorTier1 = log.filter(l => l.patternId === "availability-interview" && l.account === account && l.mode === "tier1").length
          const check = delegateEligible({
            optIn: optIn || null, patternId, account, senderClass: cls, priorTier1Sends: priorTier1,
            pureAvailabilityAsk: isAvailabilityAsk(text), doubleSubmitHold: !!card?.doubleSubmitHold, body: sendBody,
          })
          if (!check.eligible) return NextResponse.json({ ok: false, error: "Delegate not eligible.", reasons: check.reasons }, { status: 403 })
          if (sendBody !== availabilityReply(first)) {
            return NextResponse.json({ ok: false, error: "Tier 2 sends only the exact availability template, never an edited draft." }, { status: 403 })
          }
        } else if (!isAvailabilityAsk(text) && !/available|availability/i.test(sendBody)) {
          return NextResponse.json({ ok: false, error: "This thread is not an availability ask." }, { status: 403 })
        }
      }
      const subject = latest.subject.startsWith("Re:") ? latest.subject : `Re: ${latest.subject}`
      const sent = await sendGmailMessage({ userId: ctx.userId, accountId: acct.id, to: senderEmail, subject, body: sendBody, threadId })
      const entry: LogEntry = {
        patternId, account, senderEmail, threadId, mode, at: new Date().toISOString(),
        cardKey: cardKey({ req: card?.req, senderEmail, role: latest.jobTitle || latest.subject, firstPitchDate: thread.messages[0]?.internalDate || "" }),
        body: sendBody,
      }
      const logSaved = await save({ gmail_reply_pattern_log: [entry, ...log].slice(0, 200) })
      return NextResponse.json({ ok: true, sent, mode, logSaved })
    }

    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
}
