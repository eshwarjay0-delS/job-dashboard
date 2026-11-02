import { NextResponse, type NextRequest } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST /api/auth/refresh — renew the cookie session in place.
// The SSR client reads the refresh token from the session cookies, rotates
// it, and writes the fresh pair back through setAll. The Kompas client calls
// this when an API call meets a 401 and whenever the window regains focus,
// so a session that lapsed quietly while the app sat idle heals itself
// instead of ejecting the user to the login page mid-interview.
// A live Bearer token short-circuits first: the desktop shell injects one on
// every call, and when it is live the cookie refresh must not run at all —
// the cookies hold an older generation of the same rotating family, and
// presenting it could revoke the family the shell just renewed.
// 200 = a live session exists after the attempt; 401 = truly signed out.
export async function POST(request: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };
  try {
    const supabase = await createClientFromRequest(request);
    const { data: first } = await supabase.auth.getUser();
    if (first.user) {
      return NextResponse.json({ ok: true, refreshed: false, userId: first.user.id }, { headers: noStore });
    }
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
    }
    return NextResponse.json({ ok: true, refreshed: true, userId: data.session.user.id }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }
}
