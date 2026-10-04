/**
 * Next.js 16 request interceptor.
 * When REQUIRE_AUTH=1, every user-facing page requires a Supabase session.
 * Google is the only supported interactive sign-in provider when AUTH_GOOGLE_ONLY=1.
 * Login and OAuth callbacks remain public. API handlers enforce their own auth,
 * and external webhook routes remain reachable for signed provider callbacks.
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
    const isLoginPage = path === "/login"
    const isSignupPage = path === "/signup"
    const isApi = path.startsWith("/api/")
    const isPublicPage = isLoginPage
    const requireAuth = process.env.REQUIRE_AUTH === "1"
    const googleOnly = process.env.AUTH_GOOGLE_ONLY === "1"
    const protectedPage = !isPublicPage && !isApi

    if (isSignupPage) return user ? redirect("/dashboard/resume", res) : redirect("/login", res)

    if (user && googleOnly && protectedPage) {
      const provider = String(user.app_metadata?.provider || "")
      const providers = Array.isArray(user.app_metadata?.providers)
        ? user.app_metadata.providers.map(String)
        : []
      const googleIdentity = provider === "google" || providers.includes("google")
      if (!googleIdentity) return redirect("/login", res)
    }

    if (user && isLoginPage) return redirect("/dashboard/resume", res)

    if (!user && requireAuth && protectedPage) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.search = ""
      url.searchParams.set("next", path + request.nextUrl.search)
      const out = NextResponse.redirect(url)
      res.cookies.getAll().forEach(c => out.cookies.set(c.name, c.value))
      return out
    }

    if (user && path === "/dashboard") return redirect("/dashboard/resume", res)

    return res
  } catch {
    // Never turn an auth-provider outage into a site-wide 500.
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|api/whatsapp/webhook|api/billing/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}