import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Safe diagnostic: reports ONLY whether each env var is PRESENT (boolean) and its
// length — never the value. Lets us confirm what the deployed server actually sees
// so we stop guessing about Vercel env config. No secrets are exposed.
export async function GET() {
  const e = process.env
  const present = (v?: string) => ({ set: !!(v && v.trim()), len: (v || "").trim().length })

  const r2 = {
    R2_BUCKET: present(e.R2_BUCKET),
    R2_ACCOUNT_ID: present(e.R2_ACCOUNT_ID),
    R2_ACCESS_KEY_ID: present(e.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY: present(e.R2_SECRET_ACCESS_KEY),
  }
  const r2Active = r2.R2_BUCKET.set && r2.R2_ACCOUNT_ID.set && r2.R2_ACCESS_KEY_ID.set && r2.R2_SECRET_ACCESS_KEY.set

  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    ai: {
      ANTHROPIC_API_KEY: present(e.ANTHROPIC_API_KEY),
      OPENROUTER_API_KEY: present(e.OPENROUTER_API_KEY),
      GEMINI_API_KEY: present(e.GEMINI_API_KEY),
    },
    storage: {
      activeAdapter: r2Active ? "R2 (durable)" : "filesystem /tmp (ephemeral)",
      ...r2,
    },
    supabase: {
      NEXT_PUBLIC_SUPABASE_URL: present(e.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: present(e.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    vercel: { env: e.VERCEL_ENV || null, region: e.VERCEL_REGION || null, deploymentUrl: e.VERCEL_URL || null },
  })
}
