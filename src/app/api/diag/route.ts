import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Safe diagnostic: reports ONLY whether each env var is PRESENT (boolean), its
// length, and whether it's header-safe — never the value. Lets us confirm what the
// deployed server actually sees so we stop guessing about Vercel env config.
//
// ?ping=1 additionally makes ONE tiny (1-token) live Anthropic call to prove the
// key works end-to-end, isolated from the tailor pipeline.
function inspect(v?: string) {
  const raw = v || ""
  const trimmed = raw.trim()
  // Node rejects header values containing control chars or non-ASCII (ERR_INVALID_CHAR).
  const bad: { pos: number; code: number }[] = []
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i)
    if (code < 0x20 || code > 0x7e) bad.push({ pos: i, code })
  }
  return {
    set: !!trimmed,
    len: trimmed.length,
    // true when safe to put in an HTTP header (no hidden newline/space-run/unicode)
    headerSafe: trimmed.length > 0 && bad.length === 0,
    // untrimmed length differs → there was surrounding whitespace (Vercel paste artifact)
    hadSurroundingWhitespace: raw.length !== trimmed.length,
    badChars: bad.slice(0, 5),
  }
}

export async function GET(request: Request) {
  const e = process.env
  const ping = new URL(request.url).searchParams.get("ping") === "1"

  const anthropic = inspect(e.ANTHROPIC_API_KEY)

  let anthropicPing: unknown = "skipped (add ?ping=1)"
  if (ping && anthropic.set) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": (e.ANTHROPIC_API_KEY || "").trim(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      })
      anthropicPing = { httpStatus: res.status, ok: res.ok, body: (await res.text()).slice(0, 200) }
    } catch (err) {
      anthropicPing = { threw: String(err) }
    }
  }

  const r2 = {
    R2_BUCKET: inspect(e.R2_BUCKET),
    R2_ACCOUNT_ID: inspect(e.R2_ACCOUNT_ID),
    R2_ACCESS_KEY_ID: inspect(e.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY: inspect(e.R2_SECRET_ACCESS_KEY),
  }
  const r2Active = r2.R2_BUCKET.set && r2.R2_ACCOUNT_ID.set && r2.R2_ACCESS_KEY_ID.set && r2.R2_SECRET_ACCESS_KEY.set

  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    ai: {
      ANTHROPIC_API_KEY: anthropic,
      OPENROUTER_API_KEY: inspect(e.OPENROUTER_API_KEY),
      GEMINI_API_KEY: inspect(e.GEMINI_API_KEY),
      anthropicPing,
    },
    storage: { activeAdapter: r2Active ? "R2 (durable)" : "filesystem /tmp (ephemeral)", ...r2 },
    supabase: {
      NEXT_PUBLIC_SUPABASE_URL: inspect(e.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: inspect(e.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    vercel: { env: e.VERCEL_ENV || null, region: e.VERCEL_REGION || null },
  })
}
