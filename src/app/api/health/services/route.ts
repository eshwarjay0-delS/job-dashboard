import { NextResponse } from "next/server"
import { phoneVerifyStatus, type PhoneVerifyStatus } from "@/lib/phoneVerify"
import { waStatus, type WhatsAppStatus } from "@/lib/whatsapp"
import { identityStatus, type IdentityStatus } from "@/lib/identityStatus"
import { llmStatus, type LlmStatus } from "@/lib/llmStatus"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/health/services — can a new person get through setup and reach the WhatsApp bot right now?
//
// Three links have to hold: a code can be texted (sms), the verified number can be linked to the account (identity), and the
// bot's sender answers people (whatsapp). Each is reported as a state plus, when it is not "ok", what to do about it.
//
// It is public on purpose, like a status page: on 2026-10-05 every sign-up was stuck on "Send code" and the only evidence was a
// provider message in a user's browser. It reports states and the SHAPE of settings (is the token 32 characters), never a value,
// and sends no message. One server instance probes at most once in 60 seconds: the answer is kept, and requests that arrive
// while a probe is running share it. (Instances do not share memory, so the bound is per instance.)
// `ai` is the fourth link: the providers that write a tailored resume. It does not decide `ok` (setup and the bot's wiring are
// one question, the writers' health is another), and it is probed at most every five minutes.
type Report = { ok: boolean; checkedAt: string; sms: PhoneVerifyStatus; identity: IdentityStatus; whatsapp: WhatsAppStatus; ai: LlmStatus }

let cached: { at: number; report: Report } | null = null
let inflight: Promise<Report> | null = null

async function build(): Promise<Report> {
  const [sms, identity, whatsapp, ai] = await Promise.all([phoneVerifyStatus(), identityStatus(), waStatus(), llmStatus()])
  const report: Report = { ok: sms.state === "ok" && identity.state === "ok" && whatsapp.state === "ok", checkedAt: new Date().toISOString(), sms, identity, whatsapp, ai }
  cached = { at: Date.now(), report }
  return report
}

export async function GET() {
  if (cached && Date.now() - cached.at < 60_000) return NextResponse.json({ ...cached.report, cached: true })
  inflight ??= build().finally(() => { inflight = null })
  return NextResponse.json(await inflight)
}
