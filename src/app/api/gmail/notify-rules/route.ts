import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { validNotifyRule, type NotifyRule } from "@/lib/notify-rules"

// Kept so existing `import type { NotifyRule } from "@/app/api/gmail/notify-rules/route"` keeps working.
export type { NotifyRule }


// Poke parity: per-sender always/never-notify controls. The inbox watcher reads
// these and respects them — a "never" sender is never nudged, an "always"
// sender is nudged even below the normal importance bar.
export async function GET() {
  const sb = await createClient()
  const { data: { user }, error } = await sb.auth.getUser()
  if (error || !user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 })
  const stored = user.user_metadata?.gmail_notify_rules
  return NextResponse.json({ ok: true, rules: Array.isArray(stored) ? stored.filter(validNotifyRule) : [] })
}

export async function PUT(req: Request) {
  const sb = await createClient()
  const { data: { user }, error } = await sb.auth.getUser()
  if (error || !user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 })
  const input = await req.json().catch(() => null)
  if (!Array.isArray(input?.rules) || input.rules.length > 100 || !input.rules.every(validNotifyRule))
    return NextResponse.json({ ok: false, error: "Rules must be {account, email, mode: always|never}. Maximum 100." }, { status: 400 })
  const accounts = await listGoogleWorkspaceAccounts(user.id)
  if (input.rules.some((r: NotifyRule) => !accounts.some(a => a.google_email.toLowerCase() === r.account.toLowerCase())))
    return NextResponse.json({ ok: false, error: "Rule inbox is not connected" }, { status: 400 })
  const rules: NotifyRule[] = [...new Map<string, NotifyRule>(
    input.rules.map((r: NotifyRule) => [`${r.account.toLowerCase()}:${r.email.toLowerCase()}`, { ...r, account: r.account.toLowerCase(), email: r.email.toLowerCase() }])
  ).values()]
  const result = await sb.auth.updateUser({ data: { gmail_notify_rules: rules } })
  if (result.error) return NextResponse.json({ ok: false, error: "Could not save notify preferences" }, { status: 500 })
  return NextResponse.json({ ok: true, rules })
}
