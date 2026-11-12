import { NextResponse, type NextRequest } from "next/server";
import { AUTH_EGRESS_BLOCKED, AUTH_SIGNED_OUT, AUTH_UNAVAILABLE, isAuthEgressBlocked, isAuthUnreachable, isTerminalSignOut, userFromAuthClient } from "@/lib/kompasAuthSession";
import { disabledOwnerUser, isAuthDisabled } from "@/lib/authDisabled";
import { createClientFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST /api/auth/refresh — renew the cookie session in place.
// This is the website family. The desktop app must not store it. Two browser
// tabs rotate this cookie, and that rotation must not be the credential the
// Windows app keeps. Desktop renewal is POST /api/auth/desktop-session.
// The SSR client reads the refresh token from the session cookies, rotates
// it, and writes the fresh pair back through setAll. The Kompas client calls
// this when an API call meets a 401, and only in the minute before expiry.
// so a session that lapsed quietly while the app sat idle heals itself
// instead of ejecting the user to the login page mid-interview.
// A live Bearer token short-circuits first: the desktop shell injects one on
// every call, and when it is live the cookie refresh must not run at all —
// the cookies hold an older generation of the same rotating family, and
// presenting it could revoke the family the shell just renewed.
// 200 = a live session exists after the attempt; 401 = truly signed out.
export async function POST(request: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };
  if (isAuthDisabled()) {
    // The owner is already the signed-in person. Do not call Supabase Auth,
    // including when Auth is HTTP 402.
    return NextResponse.json(
      { ok: true, refreshed: false, authDisabled: true, userId: disabledOwnerUser().id },
      { headers: noStore },
    );
  }
  try {
    const supabase = await createClientFromRequest(request);
    const first = await userFromAuthClient(supabase);
    if (first?.unreachable) {
      if (first.blocked === "egress") {
        return NextResponse.json(
          { ok: false, error: "exceed_egress_quota", message: AUTH_EGRESS_BLOCKED },
          { status: 402, headers: noStore },
        );
      }
      return NextResponse.json(
        { ok: false, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE },
        { status: 503, headers: noStore },
      );
    }
    if (first?.id) {
      return NextResponse.json({ ok: true, refreshed: false, userId: first.id }, { headers: noStore });
    }
    const { data, error } = await supabase.auth.refreshSession();
    if (error && isAuthEgressBlocked(error)) {
      return NextResponse.json(
        { ok: false, error: "exceed_egress_quota", message: AUTH_EGRESS_BLOCKED },
        { status: 402, headers: noStore },
      );
    }
    if (error && isAuthUnreachable(error)) {
      return NextResponse.json(
        { ok: false, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE },
        { status: 503, headers: noStore },
      );
    }
    if (error || !data.session) {
      const signedOut = !error || isTerminalSignOut(error);
      return NextResponse.json(
        { ok: false, error: signedOut ? "signed_out" : "invalid_grant", message: signedOut ? AUTH_SIGNED_OUT : undefined },
        { status: 401, headers: noStore },
      );
    }
    return NextResponse.json({ ok: true, refreshed: true, userId: data.session.user.id }, { headers: noStore });
  } catch (err) {
    if (isAuthUnreachable(err instanceof Error ? err : { message: "fetch failed" })) {
      return NextResponse.json(
        { ok: false, error: "sign_in_unavailable", message: AUTH_UNAVAILABLE },
        { status: 503, headers: noStore },
      );
    }
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }
}
