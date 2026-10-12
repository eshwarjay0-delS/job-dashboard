import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { validIgnoreRule, type IgnoreRule } from "@/lib/gmail-ignore"

export async function GET() {
  const sb = await createClient()
  const { data: { user }, error } = await sb.auth.getUser()
  if (error || !user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 })
  const stored = user.user_metadata?.gmail_ignore_rules
  return NextResponse.json({ ok: true, rules: Array.isArray(stored) ? stored.filter(validIgnoreRule) : [] })
}

export async function PUT(req: Request) {
  const sb = await createClient()
  const { data: { user }, error } = await sb.auth.getUser()
  if (error || !user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 })
  const input = await req.json().catch(() => null)
  if (!Array.isArray(input?.rules) || input.rules.length > 100 || !input.rules.every(validIgnoreRule)) return NextResponse.json({ ok: false, error: "Choose an exact sender, thread, or company domain. Shared email domains cannot be ignored. Maximum 100 rules." }, { status: 400 })
  const accounts = await listGoogleWorkspaceAccounts(user.id)
  if (input.rules.some((r: IgnoreRule) => !accounts.some(a => a.google_email.toLowerCase() === r.account))) return NextResponse.json({ ok: false, error: "Rule inbox is not connected" }, { status: 400 })
  const rules: IgnoreRule[] = [...new Map<string, IgnoreRule>(input.rules.map((r: IgnoreRule) => [`${r.account}:${r.kind}:${r.value}`, r])).values()]
  const result = await sb.auth.updateUser({ data: { gmail_ignore_rules: rules } })
  if (result.error) return NextResponse.json({ ok: false, error: "Could not save ignore preferences" }, { status: 500 })
  return NextResponse.json({ ok: true, rules })
}
