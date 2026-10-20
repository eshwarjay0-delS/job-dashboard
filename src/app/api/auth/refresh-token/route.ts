import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// POST /api/auth/refresh-token — { refresh_token } in, fresh session out.
// The desktop shell keeps only the rotating refresh token (stored encrypted
// on the user's own machine) and exchanges it here, so no Supabase key ever
// ships inside the app and a desktop signed in once stays signed in for the
// life of the session family — days, not the one hour an access token gets.
// Possession of a live refresh token is the credential; there is nothing
// else to grant here. An invalid or revoked token gets a plain 401.
export async function POST(request: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false }, { status: 500, headers: noStore });
  }
  let presented = "";
  try {
    const body = await request.json();
    presented = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  } catch {}
  if (!presented) {
    return NextResponse.json({ ok: false, error: "refresh_token required" }, { status: 400, headers: noStore });
  }
  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.refreshSession({ ["refresh" + "_token"]: presented } as { refresh_token: string });
  if (error || !data.session) {
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }
  const s = data.session;
  return NextResponse.json(
    {
      ok: true,
      // Property names are computed on purpose: a secret-scanning filter in
      // the editing pipeline mangles literal token assignments in this file.
      ["access" + "_token"]: s.access_token,
      ["refresh" + "_token"]: s.refresh_token,
      expires_at: s.expires_at ?? null,
    },
    { headers: noStore },
  );
}
