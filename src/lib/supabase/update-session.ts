import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authGateRedirect } from "@/lib/authGate";
import { safeDisabledAuthNext } from "@/lib/authRedirect";
import { userFromAuthClient } from "@/lib/kompasAuthSession";
import { hasOwnerSkipCookie, isAuthDisabled } from "@/lib/authDisabled";

// The trust variable, read server-side on every gated page request: Supabase
// getUser() verifies the token with the identity provider instead of trusting
// a cookie value, and anonymous sessions do not count as signed in (same rule
// as the API boundary in lib/authBoundary).
//
// Previously this file passed everything straight through ("Auth removed"),
// which is why a signed-in user still saw the marketing page and the sign-in
// form, and a signed-out user could open dashboard pages: no page checked
// auth server-side at all. The matcher in src/proxy.ts keeps this to the
// page routes that need it: /, /login and /dashboard*. Everything else —
// /auth/* (including the desktop handoff and the OAuth callback), /api/*
// (which authenticate themselves) and the static Kompas app at /kompas —
// passes through untouched.
export async function updateSession(request: NextRequest) {
  if (isAuthDisabled() || hasOwnerSkipCookie(request.cookies.getAll())) {
    // Treat the single owner as signed in, including /login, so every sign-in
    // screen routes straight into the app. Do not call Supabase.
    const redirect = authGateRedirect(
      request.nextUrl.pathname,
      request.nextUrl.search,
      safeDisabledAuthNext(request.nextUrl.searchParams.get("next")),
      true,
    );
    if (redirect) return NextResponse.redirect(new URL(redirect, request.url));
    return NextResponse.next({ request });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Unconfigured host (demo mode): never 500 on a missing session check.
  if (!url || !key) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  let signedIn = false;
  try {
    // A Supabase outage must not bounce a person who still has a valid token.
    // userFromAuthClient keeps them when getClaims can verify it locally, and
    // reports unreachable (rather than signed-out) when the service cannot be
    // asked at all. A missing session is still signed out.
    const user = await userFromAuthClient(supabase);
    signedIn = !!(user && (user.id || user.unreachable));
  } catch {
    signedIn = false;
  }
  const redirect = authGateRedirect(
    request.nextUrl.pathname,
    request.nextUrl.search,
    request.nextUrl.searchParams.get("next"),
    signedIn,
  );
  if (redirect) return NextResponse.redirect(new URL(redirect, request.url));
  return response;
}
