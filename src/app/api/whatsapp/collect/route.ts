// Bringing the resumes the WhatsApp bot made into the signed-in owner's Files, without a message to the bot or a code.
// For the owner of the site only (an address in ADMIN_EMAILS). For anyone else it does nothing and says so.
//
//   POST            the owner's own numbers named in settings, joined to nobody, are joined to this account and what the
//                   bot holds for them is saved into Files. Files and the WhatsApp page call this when they open.
//   POST { claim }  the owner says "the number ending 1234 is mine": that number is joined to this account and its
//                   resumes are saved into Files. For a deployment where no owner number is named in settings (found on
//                   13 Oct 2026: 18 resumes made over WhatsApp, his Files empty, and no number named or joined).
//   -> { ok, owner, numbers, joined, held, moved, unclaimed: [{ ending, held }] }   counts and last four digits only
import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { isAdminEmail, ownerEntries } from "@/lib/owner"
import { checkRateLimit } from "@/lib/rateLimit"
import { joinIfFree, linkedUserId } from "@/lib/whatsapp-link"
import { botNumbers, collectHeld, heldCount } from "@/lib/whatsapp-collect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }
const NOTHING = { numbers: 0, joined: 0, held: 0, moved: 0, unclaimed: [] as { ending: string; held: number }[] }

export async function POST(request: NextRequest) {
  const began = Date.now()
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401, ...PRIVATE })
  if (!isAdminEmail(user.email)) return NextResponse.json({ ok: true, owner: false, ...NOTHING }, PRIVATE)
  if (!checkRateLimit(`wa-collect:${user.id}`, { max: 20, windowMs: 60_000 }).ok) return NextResponse.json({ ok: true, owner: true, ...NOTHING }, PRIVATE)
  const body = (await request.json().catch(() => ({}))) as { claim?: unknown }
  const claim = String(body.claim || "").replace(/\D/g, "").slice(-4)
  let joined = 0, held = 0, moved = 0
  try {
    // A number with an account named beside it in settings belongs to that account: it is left alone unless it is this one.
    const mine = ownerEntries().filter(e => !e.userId || e.userId === user.id).slice(0, 6).map(e => e.digits)
    // Every number the bot holds resumes for that is joined to nobody. Shown to the owner by its last four digits.
    const loose: { digits: string; held: number }[] = []
    for (const n of await botNumbers()) if (!mine.includes(n.digits) && !(await linkedUserId(n.digits))) loose.push(n)
    // "The number ending 1234 is mine": taken only when exactly one loose number ends that way.
    const claimed = claim.length === 4 ? loose.filter(n => n.digits.endsWith(claim)) : []
    if (claim && claimed.length !== 1) return NextResponse.json({ ok: false, owner: true, ...NOTHING, error: "That number could not be found. Open this page again." }, { status: 409, ...PRIVATE })
    for (const digits of [...mine, ...claimed.map(n => n.digits)]) {
      const state = await joinIfFree(digits, user.id)
      if (state === "joined") joined++
      if (state !== "joined" && state !== "mine") continue
      held += await heldCount(digits)
      moved += await collectHeld(digits, user.id, began + 40_000)
    }
    // Numbers already joined to this account are kept up to date too: whatever was made since the last time.
    for (const n of await botNumbers()) {
      if (mine.includes(n.digits) || claimed.some(c => c.digits === n.digits)) continue
      if ((await linkedUserId(n.digits)) === user.id) { held += n.held; moved += await collectHeld(n.digits, user.id, began + 40_000) }
    }
    const unclaimed = loose.filter(n => !claimed.some(c => c.digits === n.digits)).map(n => ({ ending: n.digits.slice(-4), held: n.held }))
    return NextResponse.json({ ok: true, owner: true, numbers: mine.length + claimed.length, joined, held, moved, unclaimed }, PRIVATE)
  } catch (error) {
    console.error("[whatsapp/collect]", String(error).slice(0, 300))
    return NextResponse.json({ ok: false, owner: true, ...NOTHING, joined, held, moved, error: "Your WhatsApp resumes could not all be brought in just now. Open this page again in a moment." }, { status: 500, ...PRIVATE })
  }
}
