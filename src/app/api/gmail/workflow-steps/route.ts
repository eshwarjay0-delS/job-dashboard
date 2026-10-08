import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads } from "../_lib"
import { decideFollowup, type FollowupThread } from "@/lib/followup-engine"
import { checkRateLimit } from "@/lib/rateLimit"
import type { Step } from "@/app/dashboard/_suite/sample"

// GET /api/gmail/workflow-steps — follow-up engine state shaped as Step[]
// Reflects the actual automation: recency rule, interview weekly cadence,
// 7-day follow-up → 10-day call escalation, marketing-firm exclusion.
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }

    const rl = checkRateLimit(`gmail-workflows:${ctx.userId}`, { max: 10, windowMs: 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    }

    // Unfollowed domains for exclusion
    const { data: unfollowed } = await ctx.supabase
      .from("unfollowed_domains")
      .select("domain")
      .eq("user_id", ctx.userId)
    const unfollowedDomains: string[] = (unfollowed || []).map((u: { domain: string }) => u.domain)

    const threads = await fetchClassifiedThreads(ctx.userId, { days: 30, max: 50 })

    const steps: Step[] = []
    const now = new Date()
    let followupN = 0
    let callN = 0

    for (const t of threads) {
      const latest = t.messages[t.messages.length - 1]
      if (!latest) continue
      const hasInterview = t.messages.some(m => m.category === "Interview Request")
      const ft: FollowupThread = {
        threadId: t.threadId,
        vendor: latest.vendor,
        vendorDomain: latest.vendorDomain,
        jobTitle: latest.jobTitle,
        lastActivityAt: latest.internalDate ? new Date(Number(latest.internalDate)) : now,
        lastFollowupAt: null,
        followupCount: 0,
        hasInterview,
        lastMessageFromUser: false,
      }
      const decision = decideFollowup(ft, unfollowedDomains, now)

      if (decision.action === "draft_followup" && followupN < 10) {
        followupN++
        steps.push({
          id: `f-${t.threadId}`,
          title: `Follow up — ${latest.vendor} (${latest.jobTitle || latest.subject.slice(0, 40)})`,
          trigger: hasInterview ? "Interview thread — weekly cadence" : "No reply after submission",
          days: ["Mon", "Wed", "Fri"],
          time: "9:00 AM",
          mode: "approve",
        })
      } else if (decision.action === "escalate_call" && callN < 10) {
        callN++
        steps.push({
          id: `c-${t.threadId}`,
          title: `Call — ${latest.vendor} (${latest.jobTitle || "no response"})`,
          trigger: decision.reason,
          days: ["Thu"],
          time: "Call list",
          mode: "approve",
        })
      }
    }

    // Always include the standing automation steps so the queue isn't empty
    if (steps.length === 0) {
      steps.push(
        { id: "s-default-1", title: "Weekly follow-up sweep", trigger: "Mon / Wed / Fri — threads with 24–48h activity", days: ["Mon", "Wed", "Fri"], time: "9:00 AM", mode: "auto" },
        { id: "s-default-2", title: "Thursday call list", trigger: "Threads 10+ days silent after follow-up", days: ["Thu"], time: "9:00 AM", mode: "auto" },
      )
    }

    return NextResponse.json({ ok: true, count: steps.length, steps })
  } catch (err) {
    console.error("gmail/workflow-steps error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
