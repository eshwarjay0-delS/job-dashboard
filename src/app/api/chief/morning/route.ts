import { NextRequest, NextResponse } from "next/server"
import { morningUsers, runMorningReport } from "@/lib/chief-morning"

export const runtime = "nodejs"

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chief/morning — the Chief's 7am report (chief-morning.ts) for everyone who sent "morning on".
// Called by the scheduler (vercel.json cron "13 12 * * *": 7:13 am in Chicago in summer time, 6:13 am in winter).
// Bearer-protected with CRON_SECRET, and closed when the deployment has none.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim()
  if (secret.length < 16 || (req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  const users = await morningUsers()
  const results: { sent: boolean; saved: boolean; why?: string }[] = []
  for (const userId of users) {
    try { results.push(await runMorningReport(userId)) }
    catch (e) { results.push({ sent: false, saved: false, why: String(e).slice(0, 160) }) }
  }
  return NextResponse.json({ ok: true, users: users.length, sent: results.filter(r => r.sent).length, results })
}
