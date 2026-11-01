import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

type ServerClient = ReturnType<typeof createServerClient>;

// When Supabase isn't configured (e.g. env vars not set on the host), return a stub
// that behaves as "no session / no data" so the app runs OPEN (demo mode) instead of
// throwing "supabaseUrl is required" and 500-ing every route. Callers only use
// .auth.getUser() and simple .from(...).select()... chains, all covered here.
function stubClient(): ServerClient {
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
    },
    from: () => chain,
  } as unknown as ServerClient;
}

// Creates a Supabase client for use on the server (server components, etc.).
export async function createClient(): Promise<ServerClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return stubClient();

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, which cannot set cookies.
          // Safe to ignore — the proxy file refreshes the session instead.
        }
      },
    },
  });
}

// Desktop and extension requests can supply their own Supabase access token.
// An explicit Authorization header must never adopt a different browser-cookie
// account when that header is malformed or its token expires. Only an ABSENT
// header may use ambient cookies. Supabase getUser() verifies actual tokens.
export async function createClientFromRequest(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return stubClient();

  const authorization = request.headers.get("authorization");
  if (authorization === null) return createClient();
  const bearer = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!bearer) return stubClient();

  return createSupabaseClient(url, key, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
}
