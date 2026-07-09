/**
 * proxy.ts — Next.js 16 request interceptor (the convention that replaced
 * middleware.ts). This is the SINGLE source of truth for session refresh +
 * route gating. Do not re-add a middleware.ts file — Next 16 would run it
 * instead of this and silently change auth behavior.
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the session if expired — required for Server Components to read it.
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Carry the refreshed auth cookies onto any redirect we issue.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ""
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value))
    return res
  }

  // Gate the app: only signed-in users reach the dashboard. Teammates sign in
  // (Google or magic link) so their resumes land in their own per-user folder.
  if (!user && path.startsWith("/dashboard")) return redirectTo("/login")

  // Launch default: land on resume tailoring (the only shipped surface for now).
  if (path === "/dashboard") return redirectTo("/dashboard/resume")

  // Signed-in users skip the auth screens.
  if (user && (path === "/login" || path === "/signup")) return redirectTo("/dashboard/resume")

  return supabaseResponse
}

// Run on all paths except static assets and the OAuth/auth callback (which must
// reach its own handler to exchange the code/token before any gating applies).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
