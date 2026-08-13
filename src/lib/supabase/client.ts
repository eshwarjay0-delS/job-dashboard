import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type BrowserClient = SupabaseClient;

// When Supabase isn't configured in the browser bundle (NEXT_PUBLIC_SUPABASE_* not
// set at build time on the host), createBrowserClient() throws "Your project's URL
// and API key are required" — which crashes EVERY client page that renders the
// sidebar (it calls auth.getUser on mount). Return a no-session stub so the app
// runs OPEN (demo mode) instead of taking the whole dashboard down.
function stubClient(): BrowserClient {
  const notConfigured = { message: "Supabase is not configured on this deployment." };
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  for (const m of ["select", "eq", "neq", "in", "order", "limit", "range", "single", "maybeSingle", "insert", "update", "upsert", "delete", "match", "filter", "ilike", "gte", "lte"]) {
    chain[m] = passthrough;
  }
  // Make the chain awaitable → resolves to { data: null, error: null }.
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      // Return a real (no-op) subscription handle so onMount cleanup doesn't crash.
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInAnonymously: async () => ({ data: { user: null, session: null }, error: notConfigured }),
      signInWithOAuth: async () => ({ data: { provider: null, url: null }, error: notConfigured }),
      signInWithOtp: async () => ({ data: {}, error: notConfigured }),
      verifyOtp: async () => ({ data: { user: null, session: null }, error: notConfigured }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: notConfigured }),
      signOut: async () => ({ error: null }),
    },
    from: () => chain,
  } as unknown as BrowserClient;
}

// Creates a Supabase client for use in the browser (inside "use client" pages).
export function createClient(): BrowserClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return stubClient();
  return createBrowserClient(url, key);
}
