import { NextRequest, NextResponse } from "next/server"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"

// ApplyProfile: per-user reusable answers for ATS forms.
// Stored in Supabase user_metadata (same pattern as gmail_notify_rules).
// NEVER stores passwords. Portal logins live in the browser session, like Chrome.
export async function GET(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  // TODO: read from Supabase user_metadata.apply_profile when service key available
  return NextResponse.json({ ok: true, profile: null }, { headers: { "Cache-Control": "no-store" } })
}

export async function PUT(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }) }
  // Allowlist: only known profile fields. Passwords are never accepted.
  const allowed = ["fullName", "email", "phone", "location", "linkedin", "github", "portfolio",
    "workAuth", "visaSponsorship", "willingToRelocate", "remoteOnly", "minRate",
    "gender", "race", "veteranStatus", "disability"]
  const profile: Record<string, unknown> = {}
  for (const k of allowed) if (body[k] !== undefined) profile[k] = body[k]
  // TODO: write to Supabase user_metadata.apply_profile when service key available
  return NextResponse.json({ ok: true, profile }, { headers: { "Cache-Control": "no-store" } })
}
