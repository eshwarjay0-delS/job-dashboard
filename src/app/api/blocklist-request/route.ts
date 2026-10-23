// An employer's request not to have Kompas used in its interviews. Public: the employer has no account here.
// Checking and keeping the request: src/lib/blocklist-request.ts. The owner reads them on /dashboard/admin/blocklist.
import { createHash, randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { MAX_BODY_BYTES, submitBlocklistRequest } from "@/lib/blocklist-request"
import { blob } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(request: NextRequest) {
  const text = await request.text().catch(() => "")
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "The request is too long." }, { status: 413, headers: NO_STORE })
  let body: unknown = null
  try { body = JSON.parse(text) } catch { body = null }
  // The network address is hashed for the brake against repeats and is never stored.
  const address = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown"
  const sender = createHash("sha256").update(`blocklist:${address}`).digest("hex").slice(0, 16)
  const reply = await submitBlocklistRequest({ body, sender, store: blob, id: randomBytes(8).toString("hex") })
  return NextResponse.json(reply.body, { status: reply.status, headers: NO_STORE })
}
