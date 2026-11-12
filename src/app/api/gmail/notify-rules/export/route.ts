import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { checkRateLimit } from "@/lib/rateLimit"
import { listAdminNotifyRules } from "@/lib/mail-update-store"
import { mergePublicRules } from "@/lib/notify-rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The worker-readable export is private to the configured scheduler. It reads
// the owner-scoped R2 cache written by authenticated settings updates; it never
// enumerates Supabase Auth users or exposes sender preferences to public callers.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || ""
  const actual = req.headers.get("authorization") || ""
  const expected = `Bearer ${secret}`
  if (secret.length < 16 || Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }
  const rl = checkRateLimit("notify-rules-export", { max: 30, windowMs: 60_000 })
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429, headers: { "Cache-Control": "no-store" } })
  try {
    const perOwner = await listAdminNotifyRules()
    return NextResponse.json(
      { ok: true, updatedAt: Date.now(), rules: mergePublicRules(perOwner) },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (err) {
    console.error("notify-rules/export error:", err)
    return NextResponse.json({ ok: false, error: "Notify rules are not synchronized for the worker. Retry after account settings sync." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
