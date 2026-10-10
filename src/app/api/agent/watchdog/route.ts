import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { fetchClassifiedThreads, type ClassifiedThread } from "../_tools"

export const runtime = "nodejs"
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
// MFit Agent watchdog — the background "is something going wrong?" monitors.
// Deterministic tripwires over the user's classified threads:
//
//  - duplicate-chains:  2+ vendors on the same posting/role  → DQ risk
//  - rtr-conflict:      RTRs signed/requested with 2+ vendors for one role
//  - rate-drift:        same role at 2+ different rates
//  - vendor-quiet:      actionable thread silent 7+ days (10+ → call list)
//  - interview-stale:   interview thread, no follow-up within 7 days
//
// GET  → Vercel cron fan-out (x-watchdog-secret header), all Gmail users
// POST → on-demand run for the signed-in user ("Check now" button)
// Findings land in mfit_notifications; repeats are deduped per role+vendor set.
// ─────────────────────────────────────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

interface Finding {
  check: string
  roleKey: string
  title: string
  body: string
}

function normRole(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
}

// Prefer a req/posting number as the grouping key when the subject carries one.
function roleKeyFor(t: ClassifiedThread): string {
  const latest = t.messages[t.messages.length - 1]
  const hay = `${latest.subject} ${t.messages.map(m => m.subject).join(" ")}`
  const req = hay.match(/(?:req|posting|position|job)[\s#:]*(\d{4,7})/i)
  if (req) return `req:${req[1]}`
  const title = normRole(latest.jobTitle || t.messages.find(m => m.jobTitle)?.jobTitle || "")
  if (title) return `role:${title.slice(0, 60)}`
  return `subj:${normRole(latest.subject).slice(0, 60)}`
}

function vendorOf(t: ClassifiedThread): string {
  const latest = t.messages[t.messages.length - 1]
  return latest.vendorDomain || latest.vendor || latest.from
}

function latestInbound(t: ClassifiedThread, accountEmail: string): (typeof t.messages)[number] | null {
  const own = accountEmail.toLowerCase()
  for (let i = t.messages.length - 1; i >= 0; i--) {
    if (!t.messages[i].from.toLowerCase().includes(own)) return t.messages[i]
  }
  return null
}

function daysAgo(iso?: string): number {
  if (!iso) return 999
  const ms = Date.now() - Number(iso)
  return Number.isFinite(ms) ? ms / 86_400_000 : 999
}

function fmtDate(iso?: string): string {
  if (!iso) return "unknown date"
  const d = new Date(Number(iso))
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "unknown date"
}

function runChecks(threads: ClassifiedThread[]): Finding[] {
  const findings: Finding[] = []
  const byRole = new Map<string, ClassifiedThread[]>()
  for (const t of threads) {
    const k = roleKeyFor(t)
    if (!byRole.get(k)) byRole.set(k, [])
    byRole.get(k)!.push(t)
  }

  for (const [roleKey, group] of byRole) {
    const vendors = [...new Set(group.map(vendorOf).filter(Boolean))]
    const label = roleKey.replace(/^(req|role|subj):/, "")
    if (vendors.length >= 2) {
      const chains = group.map(t => {
        const l = t.messages[t.messages.length - 1]
        const rate = l.rate || t.messages.find(m => m.rate)?.rate
        return `• ${vendorOf(t)}${rate ? ` — ${rate}` : ""} (last touch ${fmtDate(l.internalDate)})`
      })
      findings.push({
        check: "duplicate-chains",
        roleKey,
        title: `Possible duplicate submission: ${label}`,
        body: `${vendors.length} different vendors are touching the same role. Multiple filings for one posting can mean automatic disqualification — pick ONE chain and tell the others to stand down.\n${chains.join("\n")}`,
      })
    }

    const rtrVendors = [...new Set(
      group.filter(t => t.messages.some(m => m.category === "RTR Request")).map(vendorOf).filter(Boolean),
    )]
    if (rtrVendors.length >= 2) {
      findings.push({
        check: "rtr-conflict",
        roleKey,
        title: `Conflicting RTRs: ${label}`,
        body: `RTRs are in play with ${rtrVendors.length} vendors on the same role (${rtrVendors.join(", ")}). Signing two RTRs for one posting — especially an exclusive one — is a live conflict. Keep one, withdraw the rest in writing.`,
      })
    }

    const rates = [...new Set(
      group.flatMap(t => t.messages.map(m => m.rate).filter(Boolean)),
    )]
    if (rates.length >= 2) {
      findings.push({
        check: "rate-drift",
        roleKey,
        title: `Rate drift on ${label}`,
        body: `This role is floating at ${rates.length} different rates: ${rates.join(" vs ")}. The lower number usually wins if both get submitted — know which chain carries which rate before you commit.`,
      })
    }
  }

  const ACTIONABLE = new Set(["RTR Request", "Rate Confirmation", "Submission Confirmation", "Document Request"])
  for (const t of threads) {
    const inbound = latestInbound(t, t.accountEmail)
    if (!inbound || !ACTIONABLE.has(inbound.category)) continue
    const age = daysAgo(inbound.internalDate)
    if (age >= 7) {
      const label = roleKeyFor(t).replace(/^(req|role|subj):/, "")
      findings.push({
        check: age >= 10 ? "vendor-quiet-10" : "vendor-quiet-7",
        roleKey: roleKeyFor(t),
        title: `${age >= 10 ? "Call-list" : "Nudge"}: ${vendorOf(t)} quiet on ${label}`,
        body: age >= 10
          ? `No reply from ${vendorOf(t)} in ${Math.floor(age)} days on "${inbound.subject}". This belongs on your call list — a thread never just dies quietly.`
          : `No reply from ${vendorOf(t)} in ${Math.floor(age)} days on "${inbound.subject}". Time for a follow-up draft.`,
      })
    }
  }

  for (const t of threads) {
    const hasInterview = t.messages.some(m => m.category === "Interview Request")
    if (!hasInterview) continue
    const hasFollowup = t.messages.some(m => m.category === "Follow-up")
    const inbound = latestInbound(t, t.accountEmail)
    if (!inbound || hasFollowup) continue
    const age = daysAgo(inbound.internalDate)
    if (age >= 7) {
      const label = roleKeyFor(t).replace(/^(req|role|subj):/, "")
      findings.push({
        check: "interview-stale",
        roleKey: roleKeyFor(t),
        title: `Interview with no follow-up: ${label}`,
        body: `Interview activity with ${vendorOf(t)} went quiet ${Math.floor(age)} days ago and no follow-up went out. Interviews get a follow-up every week without fail.`,
      })
    }
  }

  return findings
}

async function runForUser(userId: string): Promise<{ checked: number; notified: number }> {
  const service = createServiceClient()
  const threads = await fetchClassifiedThreads(userId, { days: 21, max: 100 })
  if (!threads.length) return { checked: 0, notified: 0 }

  const findings = runChecks(threads)
  let notified = 0

  for (const f of findings) {
    const vendorHash = crypto.createHash("sha1").update(f.body).digest("hex").slice(0, 16)
    // Dedup: same check + role + content already notified → skip.
    const { data: seen } = await service
      .from("mfit_watchdog_state")
      .select("id")
      .eq("user_id", userId)
      .eq("check_type", f.check)
      .eq("role_key", f.roleKey)
      .eq("vendor_hash", vendorHash)
      .limit(1)
    if (seen && seen.length > 0) continue

    const { error: nerr } = await service.from("mfit_notifications").insert({
      user_id: userId,
      type: `watchdog:${f.check}`,
      title: f.title.slice(0, 200),
      body: f.body.slice(0, 2000),
      link: "/dashboard/agent",
      read: false,
    })
    if (nerr) continue

    await service.from("mfit_watchdog_state").insert({
      user_id: userId,
      check_type: f.check,
      role_key: f.roleKey,
      vendor_hash: vendorHash,
    })
    notified++
  }

  return { checked: threads.length, notified }
}

// ── GET: cron fan-out ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const watchdogSecret = process.env.WATCHDOG_CRON_SECRET || ""
  const vercelCronSecret = process.env.CRON_SECRET || ""
  const providedHeader = req.headers.get("x-watchdog-secret") || ""
  const authHeader = req.headers.get("authorization") || ""
  const vercelCron = authHeader === `Bearer ${vercelCronSecret}` && vercelCronSecret.length >= 16
  const okSecret =
    (watchdogSecret.length >= 32 && timingSafeEqual(providedHeader, watchdogSecret)) || vercelCron
  if (!okSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  if (!serviceClientAvailable()) {
    return NextResponse.json({ error: "Service client not configured." }, { status: 500 })
  }

  const service = createServiceClient()
  const { data: accounts, error } = await service
    .schema("private")
    .from("google_workspace_accounts")
    .select("user_id")
    .eq("gmail_enabled", true)
  if (error) {
    return NextResponse.json({ error: `Could not list accounts: ${error.message}` }, { status: 500 })
  }
  const userIds = [...new Set(((accounts || []) as Array<{ user_id: string }>).map(a => a.user_id))]

  const results: Record<string, { checked: number; notified: number } | { error: string }> = {}
  for (const uid of userIds) {
    try {
      results[uid] = await runForUser(uid)
    } catch (err) {
      results[uid] = { error: String(err).slice(0, 200) }
    }
  }
  return NextResponse.json({ ok: true, users: userIds.length, results })
}

// ── POST: on-demand run for the signed-in user ────────────────────────────
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  if (!serviceClientAvailable()) {
    return NextResponse.json({ error: "Service client not configured." }, { status: 500 })
  }
  try {
    const r = await runForUser(user.id)
    return NextResponse.json({ ok: true, ...r })
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 })
  }
}
