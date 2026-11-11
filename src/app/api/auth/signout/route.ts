import { NextResponse } from "next/server"
import { AUTH_UNAVAILABLE, isAuthUnreachable, plainAuthError } from "@/lib/kompasAuthSession"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }

// Explicit sign-out. A later patch may clear extra local keys through
// kompasAuthSession. An unreachable auth service does not pretend the
// session was cleared.
export async function POST() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    if (error && isAuthUnreachable(error)) {
      return NextResponse.json(
        { ok: false, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE },
        { status: 503, headers: noStore },
      )
    }
    if (error) {
      return NextResponse.json(
        { ok: false, error: "sign_out_failed", message: plainAuthError(error) },
        { status: 400, headers: noStore },
      )
    }
    return NextResponse.json({ ok: true }, { headers: noStore })
  } catch {
    return NextResponse.json(
      { ok: false, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE },
      { status: 503, headers: noStore },
    )
  }
}
