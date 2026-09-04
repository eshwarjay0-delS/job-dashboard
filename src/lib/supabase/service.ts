import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client — for code paths with NO browser session.
 *
 * The auto-reply loop is triggered by a GitHub Actions cron, so it has no
 * cookies and no user session. Every new auto_reply_* table has RLS with
 * `auth.uid() = user_id` policies, which the anon key cannot satisfy without a
 * session — so the loop must use the service role, which bypasses RLS.
 *
 * WHY THIS THROWS, unlike `createClient()` in ./server.ts:
 * That one deliberately returns a `stubClient()` when env vars are missing, so
 * the app degrades to demo mode instead of 500-ing. For an unattended job that
 * behaviour is the worst possible failure: every query would resolve to
 * `{ data: null, error: null }`, and the tick would cheerfully report "0 drafts
 * found, nothing to do" forever while being completely misconfigured. A loud
 * failure on a cron is strictly better than a silent no-op, so this throws.
 *
 * NEVER import this from a Client Component — it reads the service-role key.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set — the auto-reply loop cannot reach Supabase. Refusing to run rather than silently finding nothing.",
    )
  }
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — the auto-reply loop cannot read its tables past RLS. Refusing to run rather than silently finding nothing.",
    )
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** True when the service role is actually configured (for pre-flight checks). */
export function serviceClientAvailable(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}
