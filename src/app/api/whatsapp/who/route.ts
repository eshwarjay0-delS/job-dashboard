// Would the WhatsApp bot answer this number, and how did it come to be registered? For the owner of the site only (an
// address in ADMIN_EMAILS). It asks the same code the bot asks (src/lib/whatsapp-who.ts) and sends nothing to anyone,
// so the rule can be checked without a message to the bot.
//
//   GET              is the bot open to every number, or to registered numbers only?
//   POST { number }  -> { ok, registered, by, checked, open, wouldSay }
//        by        "code" (it sent a link code), "owner" (named in settings), "verified" (its mobile code was confirmed),
//                  "open" (nobody registered it; the deployment answers everyone), or null
//        checked   false when the store or the database did not answer: the bot then says so, and never "not registered"
//        wouldSay  the one automated message this number would get, when it is not answered
// The number is never sent back, and it goes in the body, not the address.
import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { isAdminEmail } from "@/lib/owner"
import { checkRateLimit } from "@/lib/rateLimit"
import { resolveWhatsAppUser, textCodesWork } from "@/lib/whatsapp-who"
import { notRegisteredMessage, openToAll, siteOf, NOT_CHECKED_MESSAGE } from "@/lib/whatsapp-who-core"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }

async function owner(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return { refuse: NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401, ...PRIVATE }) }
  if (!isAdminEmail(user.email)) return { refuse: NextResponse.json({ ok: false, error: "This is for the owner of the site." }, { status: 403, ...PRIVATE }) }
  return { user }
}

export async function GET(request: NextRequest) {
  const asked = await owner(request)
  if (asked.refuse) return asked.refuse
  const open = openToAll(process.env.WHATSAPP_IDENTITY_BINDING_REQUIRED)
  // `textCodes`: can a mobile number be verified by a texted code right now? When not, the automated message tells
  // an unregistered number to register with the code from the WhatsApp page instead.
  return NextResponse.json({ ok: true, open, answers: open ? "every number" : "registered numbers only", textCodes: await textCodesWork() }, PRIVATE)
}

export async function POST(request: NextRequest) {
  const asked = await owner(request)
  if (asked.refuse) return asked.refuse
  if (!checkRateLimit(`wa-who:${asked.user.id}`, { max: 30, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "That is a lot of checks in a minute. Try again shortly." }, { status: 429, ...PRIVATE })
  const body = (await request.json().catch(() => ({}))) as { number?: unknown }
  const digits = String(body.number || "").replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return NextResponse.json({ ok: false, error: "Give the number with its country code, digits only." }, { status: 400, ...PRIVATE })
  const sender = await resolveWhatsAppUser(digits)
  const site = siteOf(process.env.NEXT_PUBLIC_APP_URL, request.nextUrl.origin)
  return NextResponse.json({
    ok: true,
    registered: !!sender.who && sender.by !== "open",
    answered: !!sender.who,
    by: sender.by,
    checked: sender.checked,
    open: openToAll(process.env.WHATSAPP_IDENTITY_BINDING_REQUIRED),
    textCodes: await textCodesWork(),
    wouldSay: sender.who ? "" : sender.checked ? notRegisteredMessage(site, await textCodesWork()) : NOT_CHECKED_MESSAGE,
  }, PRIVATE)
}
