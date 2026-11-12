import { createClient, type Session } from "@supabase/supabase-js"
import type { DesktopAccount, DesktopAuthPort, DesktopCredential } from "@/lib/desktopSession"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"

// Cookie sessions stay on the website client. This port builds a Supabase
// client with no cookie storage and no automatic refresh, then either rotates
// the one refresh token the desktop presented or opens a different session
// with a magic-link verify. generateLink does not send email. The hashed
// token is exchanged here and is not returned.

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function issued(session: Session | null): DesktopCredential | null {
  if (!session?.access_token || !session.refresh_token) return null
  const expiresAt = typeof session.expires_at === "number" && Number.isFinite(session.expires_at)
    ? session.expires_at
    : Math.floor(Date.now() / 1000) + (typeof session.expires_in === "number" ? session.expires_in : 3600)
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt,
    familyId: session.user?.id || "desktop",
    userId: session.user?.id || "",
  }
}

function failure(error: { message?: string; code?: string; status?: number } | null, fallback = "invalid_grant") {
  return { session: null, error: { message: error?.message || fallback, code: error?.code || fallback, status: error?.status } }
}

export function supabaseDesktopAuth(): DesktopAuthPort {
  return {
    async userFromAccessToken(accessToken) {
      const client = anonClient()
      if (!client) return null
      const { data, error } = await client.auth.getUser(accessToken)
      if (error || !data.user || data.user.is_anonymous) return null
      return { id: data.user.id, email: data.user.email ?? null }
    },

    async refreshPresented(refreshToken) {
      const client = anonClient()
      if (!client) return failure({ message: "Desktop refresh is not configured.", code: "issuer_unavailable" })
      const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken })
      const session = issued(data.session)
      if (error || !session) return failure(error)
      return { session, error: null }
    },

    async mintIndependentSession(user: DesktopAccount) {
      if (!user.email) {
        return failure({ message: "This account has no email, so a separate desktop session cannot be opened.", code: "invalid_grant" })
      }
      if (!serviceClientAvailable()) {
        return failure({ message: "Desktop session issuer is not configured.", code: "issuer_unavailable" })
      }
      const admin = createServiceClient()
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email })
      const hashed = link.data?.properties?.hashed_token
      const linkedUser = link.data?.user?.id
      if (link.error || !hashed) return failure(link.error)
      if (linkedUser && linkedUser !== user.id) {
        return failure({ message: "Desktop session did not match the signed-in account.", code: "invalid_grant" })
      }
      const client = anonClient()
      if (!client) return failure({ message: "Desktop session issuer is not configured.", code: "issuer_unavailable" })
      const verified = await client.auth.verifyOtp({ token_hash: hashed, type: "magiclink" })
      const session = issued(verified.data.session)
      if (verified.error || !session) return failure(verified.error)
      if (verified.data.user?.id && verified.data.user.id !== user.id) {
        return failure({ message: "Desktop session did not match the signed-in account.", code: "invalid_grant" })
      }
      return { session, error: null }
    },
  }
}
