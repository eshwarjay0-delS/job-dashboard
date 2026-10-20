// What the WhatsApp bot was sent and what it answered, read back (src/lib/whatsapp-trace.ts). For the owner of the site
// only (an address in ADMIN_EMAILS); nothing is sent to anyone.
//
//   GET              -> { ok, conversations: [{ ending, events }] } for the owner's own numbers (WHATSAPP_OWNER_NUMBERS)
//   POST { number }  -> { ok, ending, events } for one number; the number goes in the body, not the address
//
// Owner, 19 Oct 2026: "Connect to the mfit WhatsApp service it wasn't real time or make any sense from what I've sent" and
// "see chats": until this, nobody could read what the bot had been sent and what it said back.
import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { isAdminEmail, ownerEntries } from "@/lib/owner"
import { readTrace } from "@/lib/whatsapp-trace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }
const digits = (s: string) => String(s || "").replace(/\D/g, "")

async function owner(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return { refuse: NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401, ...PRIVATE }) }
  if (!isAdminEmail(user.email)) return { refuse: NextResponse.json({ ok: false, error: "This is for the owner of the site." }, { status: 403, ...PRIVATE }) }
  return { user }
}

export async function GET(request: NextRequest) {
  const { refuse } = await owner(request)
  if (refuse) return refuse
  const numbers = [...new Set(ownerEntries().map(e => digits(e.digits)).filter(d => d.length >= 8))]
  const conversations = await Promise.all(numbers.map(async d => ({ ending: d.slice(-4), events: await readTrace(d) })))
  return NextResponse.json({ ok: true, conversations }, PRIVATE)
}

export async function POST(request: NextRequest) {
  const { refuse } = await owner(request)
  if (refuse) return refuse
  const body = await request.json().catch(() => ({})) as { number?: unknown }
  const d = digits(typeof body.number === "string" ? body.number : "")
  if (d.length < 8 || d.length > 15) return NextResponse.json({ ok: false, error: "Send the number with its country code." }, { status: 400, ...PRIVATE })
  return NextResponse.json({ ok: true, ending: d.slice(-4), events: await readTrace(d) }, PRIVATE)
}
