import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { buildSuggestions, type SuggestMail } from "@/lib/smart-reply"

export const runtime = "nodejs"

function asRecord(row: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!row) return out
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string") out[k] = v
    else if (v == null) out[k] = ""
  }
  return out
}

/**
 * POST { accountEmail, category, mail: { from, fromEmail, subject, preview, role, company, rate? } }
 * → { chips: [{ label, subject, body }], accountId }
 * Chips are deterministic templates filled from the caller's saved candidate
 * profile for that Gmail account. Nothing is sent here — the client shows the
 * draft for editing and only sends on explicit approval.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const accountEmail = String(body.accountEmail || "").trim().toLowerCase()
  const category = String(body.category || "Job Description")
  const m = (body.mail || {}) as Partial<SuggestMail>
  if (!accountEmail) return NextResponse.json({ error: "accountEmail is required." }, { status: 400 })

  const { data: profileRow } = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("google_email", accountEmail)
    .maybeSingle()

  let accountId: string | null = null
  try {
    const accounts = await listGoogleWorkspaceAccounts(user.id)
    const match = accounts.find(a => a.google_email.toLowerCase() === accountEmail)
    accountId = match ? match.id : null
  } catch {
    accountId = null
  }

  const mail: SuggestMail = {
    from: String(m.from || ""),
    fromEmail: String(m.fromEmail || ""),
    subject: String(m.subject || ""),
    preview: String(m.preview || ""),
    role: String(m.role || ""),
    company: String(m.company || ""),
    rate: typeof m.rate === "string" ? m.rate : undefined,
  }

  const { chips } = buildSuggestions(category, asRecord(profileRow as Record<string, unknown> | null), mail)
  return NextResponse.json({ chips, accountId })
}
