import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authGateRedirect } from "@/lib/authGate";

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
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = !!user && !user.is_anonymous;
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
