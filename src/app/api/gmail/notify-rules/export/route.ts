import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { isAdminEmail } from "@/lib/owner"
import { checkRateLimit } from "@/lib/rateLimit"
import { mergePublicRules } from "@/lib/notify-rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Worker-readable export of the per-sender notify controls (Poke parity).
//
// The 30-minute inbox worker has no user session and no service key, so it
// cannot read Supabase user_metadata where the UI stores the rules. This
// route is the credential path: the app reads the owner's rules with its
// service-role key and serves the worker only what triage needs — sender
// emails and their always/never mode. Account addresses, message content
// and everything else stay server-side. Nothing here needs auth to read:
// it is the owner's own curation of recruiter business emails, and the
// route is rate-limited. If this ever carries anything more sensitive,
// gate it behind the cron secret instead.
export async function GET() {
  const rl = checkRateLimit("notify-rules-export", { max: 30, windowMs: 60_000 })
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Notify export is not configured on this deployment." }, { status: 503 })
  }
  try {
    const admin = createServiceClient(url, key)
    const { data, error } = await admin.auth.admin.listUsers()
    if (error) throw error
    const perOwner: unknown[][] = []
    for (const u of data?.users || []) {
      if (!isAdminEmail(u.email)) continue
      const stored = (u.user_metadata as Record<string, unknown> | null)?.gmail_notify_rules
      if (Array.isArray(stored)) perOwner.push(stored)
    }
    return NextResponse.json(
      { ok: true, updatedAt: Date.now(), rules: mergePublicRules(perOwner) },
      { headers: { "Cache-Control": "public, max-age=300" } },
    )
  } catch (err) {
    console.error("notify-rules/export error:", err)
    return NextResponse.json({ ok: false, error: "Could not read notify rules." }, { status: 500 })
  }
}
