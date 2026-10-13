// "My recruiters": the person's own list of the people who put their profile in front of others (src/lib/my-recruiters.ts).
//
//   GET     -> { ok, recruiters: [{ kind: "person" | "company", value, name?, at }] }
//   POST    { kind, value, name? }  add one: a person by address, or everyone at a company by what stands after the @
//   DELETE  { kind, value }         take one off
// Each answers with the list as it now is. Overview reads this list and never says a nudge is due to someone on it; the
// people they write to are the ones shown to watch. Kept per person on the server (not in the sign-in cookie).
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext } from "../_lib"
import { readRecruiters, writeRecruiters } from "@/lib/my-recruiters-store"
import { checkRateLimit } from "@/lib/rateLimit"
import { tidyRecruiter, withRecruiter, withoutRecruiter, MOST_RECRUITERS } from "@/lib/my-recruiters"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }

async function who() {
  const ctx = await requireAuth()
  if (!isAuthContext(ctx)) return { error: NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status, ...PRIVATE }) }
  if (!checkRateLimit(`recruiters:${ctx.userId}`, { max: 120, windowMs: 60_000 }).ok) return { error: NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429, ...PRIVATE }) }
  return { userId: ctx.userId }
}

export async function GET() {
  const at = await who()
  if (at.error) return at.error
  return NextResponse.json({ ok: true, recruiters: await readRecruiters(at.userId) }, PRIVATE)
}

export async function POST(req: Request) {
  const at = await who()
  if (at.error) return at.error
  const rule = tidyRecruiter(await req.json().catch(() => null), Date.now())
  if (!rule) return NextResponse.json({ ok: false, error: "That is not an email address or a company's own address. A free mail service (gmail.com, outlook.com) cannot be a company." }, { status: 400, ...PRIVATE })
  const next = withRecruiter(await readRecruiters(at.userId), rule)
  if (next.why === "full") return NextResponse.json({ ok: false, error: `Your recruiter list holds ${MOST_RECRUITERS}. Take one off to add another.` }, { status: 409, ...PRIVATE })
  if (next.added) await writeRecruiters(at.userId, next.rules)
  return NextResponse.json({ ok: true, recruiters: next.rules }, PRIVATE)
}

export async function DELETE(req: Request) {
  const at = await who()
  if (at.error) return at.error
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; value?: unknown }
  const rules = withoutRecruiter(await readRecruiters(at.userId), String(body.kind || ""), String(body.value || ""))
  await writeRecruiters(at.userId, rules)
  return NextResponse.json({ ok: true, recruiters: rules }, PRIVATE)
}
