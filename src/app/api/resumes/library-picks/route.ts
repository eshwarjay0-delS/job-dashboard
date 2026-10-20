// Which resume each job started from, as the WhatsApp bot chose it, for the signed-in person: the newest picks first, with
// the role the post asked for, how many resumes were titled for it, the resume the person named (if any), and the AI
// agent's pick beside the code's. Read only. This is the evidence for how accurate the picking is (owner, 20 Oct 2026:
// "Resume mapping isn't accurate"): nothing about it could be read before.
//
//   GET -> { ok, agreement: { picks, compared, agreed }, picks: [{ at, job, email, role, titled, hint, used, agent, code, agree, why, by }] }
import { NextRequest, NextResponse } from "next/server"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { pickAgreement, readPicks } from "@/lib/library-agent"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }

export async function GET(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  const [agreement, picks] = await Promise.all([pickAgreement(userId), readPicks(userId, 50)])
  return NextResponse.json({ ok: true, agreement, picks }, PRIVATE)
}
