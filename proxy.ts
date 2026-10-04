/**
 * Next.js 16 request interceptor.
 * Dashboard access is authenticated when REQUIRE_AUTH=1.
 * Google is the only supported interactive sign-in provider when AUTH_GOOGLE_ONLY=1.
 * External webhook/API routes are not redirected here; route handlers authenticate them.
 */
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const redirect = (pathname: string, source?: NextResponse) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ""
    const out = NextResponse.redirect(url)
    source?.cookies.getAll().forEach(c => out.cookies.set(c.name, c.value))
    return out
  }

  if (path === "/dashboard") return redirect("/dashboard/resume")
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

    const { data: { user } } = await supabase.auth.getUser()
    const isAuthPage = path === "/login" || path === "/signup"
    const isDashboard = path.startsWith("/dashboard")
    const requireAuth = process.env.REQUIRE_AUTH === "1"
    const googleOnly = process.env.AUTH_GOOGLE_ONLY === "1"

    if (user && googleOnly) {
      const provider = String(user.app_metadata?.provider || "")
      const providers = Array.isArray(user.app_metadata?.providers)
        ? user.app_metadata.providers.map(String)
        : []
      const googleIdentity = provider === "google" || providers.includes("google")
      if (!googleIdentity && isDashboard) return redirect("/login", res)
    }

    if (user && isAuthPage) return redirect("/dashboard/resume", res)
    if (!user && requireAuth && isDashboard) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("next", path + request.nextUrl.search)
      const out = NextResponse.redirect(url)
      res.cookies.getAll().forEach(c => out.cookies.set(c.name, c.value))
      return out
    }

    return res
  } catch {
    // Never turn an auth-provider outage into a site-wide 500.
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|api/whatsapp/webhook|api/billing/stripe/webhook|kompas/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
