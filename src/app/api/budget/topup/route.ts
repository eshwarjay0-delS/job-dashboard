import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { isAdminEmail } from "@/lib/owner"
import { getKeyBalance, setKeyBalance } from "@/lib/keyBalance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }
const PROVIDERS = ["openai", "groq", "openrouter"] as const

// POST /api/budget/topup { provider, amountUsd } — one-tap "I added money".
// Adds to the declared balance instead of replacing it, so every top-up is
// just "I put another $10 on OpenRouter" with no math on his side.
// Owner only.
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE })
  if (!isAdminEmail(user.email || "")) return NextResponse.json({ error: "Owner only." }, { status: 403, headers: NO_STORE })
  let body: { provider?: unknown; amountUsd?: unknown }
  try { body = await request.json() } catch { body = {} }
  const provider = String(body.provider || "")
  const amount = Number(body.amountUsd)
  if (!(PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ error: `provider must be one of: ${PROVIDERS.join(", ")}` }, { status: 400, headers: NO_STORE })
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return NextResponse.json({ error: "amountUsd must be a positive number." }, { status: 400, headers: NO_STORE })
  }
  const current = await getKeyBalance(provider)
  const updated = await setKeyBalance(provider, current.loadedUsd + amount)
  return NextResponse.json({ ok: true, provider, addedUsd: amount, ...updated }, { headers: NO_STORE })
}
