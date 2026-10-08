import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads, threadsToMails } from "../_lib"
import { checkRateLimit } from "@/lib/rateLimit"

// GET /api/gmail/threads — classified inbox threads shaped as Mail[]
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }

    const rl = checkRateLimit(`gmail-threads:${ctx.userId}`, { max: 10, windowMs: 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    }

    const url = new URL(req.url)
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 90)
    const max = Math.min(Math.max(Number(url.searchParams.get("max")) || 50, 1), 100)

    const threads = await fetchClassifiedThreads(ctx.userId, { days, max })
    const mails = threadsToMails(threads)

    return NextResponse.json({ ok: true, count: mails.length, mails })
  } catch (err) {
    console.error("gmail/threads error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
