import { hasCronBearer } from "@/lib/cronAuth"
import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { isAdminEmail } from "@/lib/owner"
import { checkRateLimit } from "@/lib/rateLimit"
import { toWorkerNotifyOwner } from "@/lib/notify-rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" }

/** Private worker-only export. It remains disabled until the owner explicitly
 * enables a configured scheduler. Rules stay grouped by owner and receiving
 * inbox; identical senders in different accounts are never merged. */
export async function GET(req: NextRequest) {
  if (process.env.GMAIL_UPDATES_SCHEDULER_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "Background inbox updates are disabled." }, { status: 503, headers: PRIVATE_HEADERS })
  }
  if (!hasCronBearer(req.headers.get("authorization"), process.env.CRON_SECRET || "")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS })
  }
  if (!checkRateLimit("notify-rules-export", { max: 30, windowMs: 60_000 }).ok) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429, headers: PRIVATE_HEADERS })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Notify export is not configured on this deployment." }, { status: 503, headers: PRIVATE_HEADERS })
  }

  try {
    const admin = createServiceClient(url, key)
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
    if (error) throw error
    const owners = []
    for (const user of data?.users || []) {
      if (!isAdminEmail(user.email)) continue
      const scoped = toWorkerNotifyOwner(user.id, user.user_metadata?.gmail_notify_rules)
      if (scoped) owners.push(scoped)
    }
    return NextResponse.json({ ok: true, updatedAt: Date.now(), owners }, { headers: PRIVATE_HEADERS })
  } catch (err) {
    console.error("notify-rules/export error:", err)
    return NextResponse.json({ ok: false, error: "Could not read notify rules." }, { status: 500, headers: PRIVATE_HEADERS })
  }
}
