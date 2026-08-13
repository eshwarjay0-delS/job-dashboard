/**
 * proxy.ts — Next.js 16 request interceptor (the convention that replaced
 * middleware.ts). SINGLE source of truth for session refresh + light routing.
 * Do NOT re-add a middleware.ts file — Next 16 would run it instead of this.
 *
 * RESILIENCE: this runs on EVERY request, so it must never throw — a crash here
 * returns 500 (MIDDLEWARE_INVOCATION_FAILED) for the whole site. When Supabase
 * isn't configured (or its call errors), we skip auth and let the request through
 * (the app runs open / demo mode) instead of taking the site down.
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  const redirect = (pathname: string, cookies?: NextResponse) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ""
    const res = NextResponse.redirect(url)
    cookies?.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value))
    return res
  }

  // Nice default: land on the tailoring surface.
  if (path === "/dashboard") return redirect("/dashboard/resume")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Supabase not configured → do nothing (open app). Never crash the site.
  if (!supabaseUrl || !supabaseKey) return NextResponse.next()

  try {
    let res = NextResponse.next({ request })
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          res = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    })

    // Best-effort session refresh (keeps the token alive for Server Components).
    const { data: { user } } = await supabase.auth.getUser()

    // Signed-in users skip the auth screens. The app is otherwise OPEN — no login
    // gate — so an unauthenticated visitor still reaches the tailoring flow (demo).
    if (user && (path === "/login" || path === "/signup")) return redirect("/dashboard/resume", res)

    return res
  } catch {
    // Any Supabase/edge error must NOT 500 the whole site.
    return NextResponse.next()
  }
}

// Run on all paths except static assets and the OAuth/auth callback (which must
// reach its own handler to exchange the code/token before any gating applies).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
