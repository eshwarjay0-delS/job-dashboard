import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runDueWatches } from "@/app/api/agent/_tools"

export const runtime = "nodejs"

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chief/watch/run — execute due Chief watch tasks.
// Called by the scheduler (vercel.json cron). Bearer-protected with CRON_SECRET.
// Runs each due watch's sub-checks, hashes findings, notifies only on change.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim()
  const auth = req.headers.get("authorization") || ""
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const supabase = await createClient()
  // Runner needs a user id per watch owner; watches carry their own user_id.
  const { data: owners, error } = await supabase
    .from("mfit_chief_watches")
    .select("user_id")
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .limit(50)
  if (error) {
    const msg = error.message || ""
    const missing = msg.includes("mfit_chief_watches")
    return NextResponse.json({ ok: false, ran: 0, changed: 0, errors: [missing ? "migration pending: mfit_chief_watches" : msg] })
  }
  const ownersTyped = (owners || []) as { user_id: string }[]
  const userIds = [...new Set(ownersTyped.map(o => o.user_id))]
  const total = { ran: 0, changed: 0, errors: [] as string[] }
  for (const userId of userIds) {
    const r = await runDueWatches(userId)
    total.ran += r.ran
    total.changed += r.changed
    total.errors.push(...r.errors)
  }
  return NextResponse.json({ ok: true, owners: userIds.length, ...total })
}
