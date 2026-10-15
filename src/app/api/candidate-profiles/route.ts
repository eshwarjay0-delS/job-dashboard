import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

// Fields the client is allowed to write. Anything else in the body is ignored.
const ALLOWED_FIELDS = [
  "full_name",
  "phone",
  "email",
  "city",
  "state",
  "zip",
  "linkedin",
  "work_auth",
  "availability",
  "interview_availability",
  "education",
  "total_experience",
  "relevant_experience",
  "employer_name",
  "employer_contact_name",
  "employer_contact_phone",
  "rate_default",
  "notes",
  "ssn_last4",
  "dob",
  "passport_no",
  "dl_number",
  "dl_state",
] as const

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

/** GET ?account=<google_email> → the caller's saved reply profile for that Gmail account. */
export async function GET(req: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const account = new URL(req.url).searchParams.get("account")?.trim().toLowerCase()
  if (!account) return NextResponse.json({ error: "Query param 'account' is required." }, { status: 400 })

  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("google_email", account)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data ?? null })
}

/** PUT { google_email, ...fields } → upsert the caller's reply profile. */
export async function PUT(req: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const google_email = String(body.google_email || "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(google_email)) {
    return NextResponse.json({ error: "A valid google_email is required." }, { status: 400 })
  }

  const fields: Record<string, string> = {}
  for (const f of ALLOWED_FIELDS) {
    const v = body[f]
    if (typeof v === "string") fields[f] = v.slice(0, 1000)
  }

  const { data, error } = await supabase
    .from("candidate_profiles")
    .upsert(
      { user_id: user.id, google_email, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "user_id,google_email" },
    )
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data ?? null })
}
