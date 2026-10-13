// Joining a WhatsApp number to the signed-in account, so what the bot makes is saved in this account's Files.
//
//   GET     which numbers are joined (last four digits only)
//   POST    a new code: valid once, for fifteen minutes. The person sends "link <code>" to the bot from their WhatsApp.
//   DELETE  take every number off this account. Files already saved stay.
//
// Why it works this way is written in src/lib/whatsapp-link.ts. Nothing here asks the WhatsApp provider anything, so
// the page may ask GET every few seconds while it waits for the code to be sent.
import { NextRequest, NextResponse } from "next/server"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { checkRateLimit } from "@/lib/rateLimit"
import { CODE_MINUTES, linkedNumbers, newLinkCode, showCode, unlinkAll } from "@/lib/whatsapp-link"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }

export async function GET(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  return NextResponse.json({ ok: true, numbers: await linkedNumbers(userId) }, PRIVATE)
}

export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  // A code is cheap to make; this only stops a page that asks for them in a loop.
  if (!checkRateLimit(`wa-link:${userId}`, { max: 12, windowMs: 60 * 60_000 }).ok) return NextResponse.json({ ok: false, error: "That is a lot of codes in an hour. Use the last one, or try again later." }, { status: 429 })
  const { code, expiresAt } = await newLinkCode(userId)
  return NextResponse.json({ ok: true, code: showCode(code), send: `link ${showCode(code)}`, minutes: CODE_MINUTES, expiresAt }, PRIVATE)
}

export async function DELETE(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  return NextResponse.json({ ok: true, removed: await unlinkAll(userId) }, PRIVATE)
}
