import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ─── Public routes that skip auth entirely ───────────────────────────────────
// /api/* routes NOT in this list will return 401 when called without a session.
const PUBLIC_API_PREFIXES = [
  "/api/jobs",         // job search — used on landing + unauthenticated boards
  "/api/h1b",          // H1B badge lookup — used by job cards
  "/api/profile",      // extension autofill (GET, no session) — falls back to
                        // resume-library extraction for the "demo" user; POST
                        // still requires auth internally (route.ts checks it)
  "/api/waitlist",     // waitlist sign-up (public landing form)
  "/api/contact",      // contact form (public)
  "/api/admin/auth",   // admin login endpoint (handles its own auth)
  "/api/salary",        // salary estimate — TODO: add auth when billing is live
  "/api/score",         // resume score — used in marketing demo flow
  "/api/autofill-log",  // extension telemetry — called from ATS pages (no cookie session available)
  // Demo-mode backends for the public try-before-signup flow (each already
  // falls back to a shared "demo" user id / has no per-user auth check of
  // its own — see PUBLIC_DASHBOARD_PREFIXES below for the pages that call these).
  "/api/tailor",
  "/api/resumes",
  "/api/user-resumes",
  "/api/cover-letter",
  "/api/prep",
  "/api/match-score",
  "/api/copilot",
  "/api/nexus",
  "/api/assist",
];

// /dashboard/* pages that stay browsable without signing in — the app's
// "try it before you sign up" demo flow. Anything not listed here (settings,
// admin, profile, email, analytics, etc.) still requires a real session
// because it touches real account/billing/personal data.
const PUBLIC_DASHBOARD_PREFIXES = [
  "/dashboard/jobs",       // job boards — public listings, no user data
  "/dashboard/jobs-ft",
  "/dashboard/contracts",
  "/dashboard/companies",
  "/dashboard/resume",     // resume tailoring demo (shared "demo" folder)
  "/dashboard/documents",
  "/dashboard/ai-tools",   // cover letter / interview prep / score demo
  "/dashboard/marketing",  // showcase page
];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

function isPublicDashboardPath(pathname: string): boolean {
  if (pathname === "/dashboard") return true;
  return PUBLIC_DASHBOARD_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Build a response object we can mutate (for cookie refresh) ──────────
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // ── 2. Create a Supabase client that reads/writes cookies via middleware ───
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to both the outgoing request and response so
          // subsequent server components see the refreshed session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ── 3. Refresh the session (keeps the token alive; no-ops if already fresh) ─
  // IMPORTANT: use getUser() not getSession() — getSession() does NOT validate
  // the token against Supabase server, it just reads the cookie. getUser() does.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── 4. Gate /dashboard/* pages ─────────────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (!user && !isPublicDashboardPath(pathname)) {
      // Unauthenticated → send to landing with a hint
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.searchParams.set("auth", "required");
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // ── 5. Gate /api/* routes ──────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    // Public API endpoints are exempt
    if (isPublicApi(pathname)) return response;

    // Everything else needs a session
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
    return response;
  }

  // ── 6. Public pages — always allow ────────────────────────────────────────
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every request EXCEPT:
     *  - Next.js internals (_next/static, _next/image, favicon, etc.)
     *  - Static file extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|css|js)$).*)",
  ],
};
