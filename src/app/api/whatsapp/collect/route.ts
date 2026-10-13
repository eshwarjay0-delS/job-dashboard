// POST /api/whatsapp/collect
// For the owner of the site, signed in: join the owner's own WhatsApp numbers (named in settings) to this account when
// they are joined to nobody, and bring the resumes the bot still holds for them into this account's Files.
// Files and the WhatsApp page call it when they open, so the owner's resumes arrive without a message to the bot and
// without a code (13 Oct 2026: eighteen resumes had been made over WhatsApp that day and his Files held none).
// For anyone else it does nothing and says so. -> { ok, owner, numbers, joined, held, moved }  (counts only)
import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { isAdminEmail, ownerEntries } from "@/lib/owner"
import { checkRateLimit } from "@/lib/rateLimit"
import { joinIfFree } from "@/lib/whatsapp-link"
import { collectHeld, heldCount } from "@/lib/whatsapp-collect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }

export async function POST(request: NextRequest) {
  const began = Date.now()
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401, ...PRIVATE })
  if (!isAdminEmail(user.email)) return NextResponse.json({ ok: true, owner: false, numbers: 0, joined: 0, held: 0, moved: 0 }, PRIVATE)
  if (!checkRateLimit(`wa-collect:${user.id}`, { max: 20, windowMs: 60_000 }).ok) return NextResponse.json({ ok: true, owner: true, numbers: 0, joined: 0, held: 0, moved: 0 }, PRIVATE)
  // A number with an account named beside it in settings belongs to that account: it is left alone unless it is this one.
  const mine = ownerEntries().filter(e => !e.userId || e.userId === user.id).slice(0, 6)
  let joined = 0, held = 0, moved = 0
  try {
    for (const entry of mine) {
      const state = await joinIfFree(entry.digits, user.id)
      if (state === "joined") joined++
      if (state !== "joined" && state !== "mine") continue
      held += await heldCount(entry.digits)
      moved += await collectHeld(entry.digits, user.id, began + 40_000)
    }
  } catch (error) {
    console.error("[whatsapp/collect]", String(error).slice(0, 300))
    return NextResponse.json({ ok: false, owner: true, numbers: mine.length, joined, held, moved, error: "Your WhatsApp resumes could not all be brought in just now. Open this page again in a moment." }, { status: 500, ...PRIVATE })
  }
  return NextResponse.json({ ok: true, owner: true, numbers: mine.length, joined, held, moved }, PRIVATE)
}
