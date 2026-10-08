import { NextRequest, NextResponse } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { FEATURES, cleanKey, cleanUse, isVaultProvider, loadVault, saveVault, vaultRows, vaultSecret, type VaultChange } from "@/lib/keyVault"
import { envKey, forgetProviderFailures } from "@/lib/llm"
import { forgetLlmStatus } from "@/lib/llmStatus"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// /api/admin/keys — the admin stores or replaces a provider's API key and ticks which features may use it (owner, 2026-10-07:
// "give me placeholder to update any API-key I want. And also select and edit checklist which apps or features can use that").
//
// Admins only, checked on the server for the read and the write. A key travels one way: from the admin's browser into
// storage, sealed (src/lib/keyVault.ts). Nothing here ever sends a key back: the answer says where each provider's key is
// kept, the last four characters of one kept here, and when it was stored. A key is never logged, and a refusal names the
// problem without repeating what was pasted.

const NO_STORE = { "Cache-Control": "no-store" }

function view() {
  return { canStore: vaultSecret() !== null, providers: vaultRows(p => !!envKey(p)), features: FEATURES }
}

export async function GET(request: NextRequest) {
  if (!(await adminOf(request))) return NextResponse.json({ error: "Admins only." }, { status: 403, headers: NO_STORE })
  await loadVault(true)
  return NextResponse.json(view(), { headers: NO_STORE })
}

export async function POST(request: NextRequest) {
  // The older shared admin login is a cookie, and a cookie rides along on a request another site makes. A change to a key
  // is accepted only from this site's own pages.
  const origin = request.headers.get("origin")
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin !== null && origin !== request.nextUrl.origin)) {
    return NextResponse.json({ error: "Not accepted from another site." }, { status: 403, headers: NO_STORE })
  }
  if (!(await adminOf(request))) return NextResponse.json({ error: "Admins only." }, { status: 403, headers: NO_STORE })
  const limited = checkRateLimit(`admin-keys:${clientIp(request)}`, { max: 30, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too many changes at once. Wait a minute." }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec ?? 60) } })

  const text = await request.text()
  if (text.length > 8192) return NextResponse.json({ error: "Too much was sent." }, { status: 413, headers: NO_STORE })
  let body: { provider?: unknown; key?: unknown; remove?: unknown; use?: unknown }
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: "That could not be read." }, { status: 400, headers: NO_STORE }) }
  if (!body || !isVaultProvider(body.provider)) return NextResponse.json({ error: "Choose a provider." }, { status: 400, headers: NO_STORE })

  const change: VaultChange = { provider: body.provider }
  if (body.key !== undefined && body.key !== "") {
    const key = cleanKey(body.provider, body.key)
    if (!key.ok) return NextResponse.json({ error: key.why }, { status: 400, headers: NO_STORE })
    if (!vaultSecret()) return NextResponse.json({ error: "This deployment has nothing to seal a key with, so it cannot keep one. Set KEY_VAULT_SECRET (32 characters or more) on the hosting project, or connect storage." }, { status: 503, headers: NO_STORE })
    change.key = key.key
  } else if (body.remove === true) {
    change.remove = true
  }
  if (body.use !== undefined) {
    const use = cleanUse(body.use)
    if (!use) return NextResponse.json({ error: "The checklist could not be read." }, { status: 400, headers: NO_STORE })
    change.use = use
  }
  if (change.key === undefined && !change.remove && !change.use) return NextResponse.json({ error: "Nothing to change." }, { status: 400, headers: NO_STORE })

  try {
    await saveVault(change)
  } catch {
    return NextResponse.json({ error: "The change could not be saved just now. Nothing was changed. Try again." }, { status: 503, headers: NO_STORE })
  }
  // A provider that was marked down for a rejected key, and the health check's last answer, are both about the old key.
  forgetProviderFailures()
  forgetLlmStatus()
  console.info(`[key-vault] ${body.provider}: ${change.key !== undefined ? "key stored" : change.remove ? "stored key removed" : "checklist changed"}${change.key !== undefined && change.use ? ", checklist changed" : ""}`)
  return NextResponse.json({ ok: true, ...view() }, { headers: NO_STORE })
}
