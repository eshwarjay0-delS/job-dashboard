// The watchdog's tripwires over a person's classified threads (duplicate chains, conflicting RTRs, rate drift, vendors
// gone quiet, interviews with no follow-up), kept apart from the route so the Chief's scheduled double-submit job runs
// the very same checks. Until 23 Oct 2026 they lived inside the route file, which Next lets export only its handlers,
// so a second copy would have been the only way to reuse them, and two copies drift.
import type { ClassifiedThread } from "@/app/api/gmail/_lib"

export interface Finding {
  check: string
  roleKey: string
  title: string
  body: string
}

function normRole(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
}

// Prefer a req/posting number as the grouping key when the subject carries one.
export function roleKeyFor(t: ClassifiedThread): string {
  const latest = t.messages[t.messages.length - 1]
  const hay = `${latest.subject} ${t.messages.map(m => m.subject).join(" ")}`
  const req = hay.match(/(?:req|posting|position|job)[\s#:]*(\d{4,7})/i)
  if (req) return `req:${req[1]}`
  const title = normRole(latest.jobTitle || t.messages.find(m => m.jobTitle)?.jobTitle || "")
  if (title) return `role:${title.slice(0, 60)}`
  return `subj:${normRole(latest.subject).slice(0, 60)}`
}

export function vendorOf(t: ClassifiedThread): string {
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

export function runChecks(threads: ClassifiedThread[]): Finding[] {
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
