import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST /api/auth/refresh — renew the cookie session in place.
// The SSR client reads the refresh token from the session cookies, rotates
// it, and writes the fresh pair back through setAll. The Kompas client calls
// this when an API call meets a 401 and whenever the window regains focus,
// so a session that lapsed quietly while the app sat idle heals itself
// instead of ejecting the user to the login page mid-interview.
// 200 = a live session exists after the attempt; 401 = truly signed out.
export async function POST() {
  const noStore = { "Cache-Control": "no-store" };
  try {
    const supabase = await createClient();
    const { data: first } = await supabase.auth.getUser();
    if (first.user) {
      return NextResponse.json({ ok: true, refreshed: false }, { headers: noStore });
    }
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
    }
    return NextResponse.json({ ok: true, refreshed: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }
}
