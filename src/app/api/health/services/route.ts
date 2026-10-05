import { NextResponse } from "next/server"
import { phoneVerifyStatus, type PhoneVerifyStatus } from "@/lib/phoneVerify"
import { waStatus, type WhatsAppStatus } from "@/lib/whatsapp"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/health/services — can a new person get through setup and reach the WhatsApp bot right now?
//
// Three links have to hold: a code can be texted (sms), the verified number can be linked to the account (identity), and the
// bot's sender answers people (whatsapp). Each is reported as a state plus, when it is not "ok", what to do about it.
//
// It is public on purpose, like a status page: on 2026-10-05 every sign-up was stuck on "Send code" and the only evidence was a
// provider message in a user's browser. It reports states and the SHAPE of settings (is the token 32 characters), never a value,
// sends no message, and is answered from memory for 60 seconds so it cannot be used to hammer a provider.
type Identity = { state: "ok" | "not_configured" | "function_missing" | "unreachable"; fix: string }
type Report = { ok: boolean; checkedAt: string; sms: PhoneVerifyStatus; identity: Identity; whatsapp: WhatsAppStatus }

let cached: { at: number; report: Report } | null = null

async function identityStatus(): Promise<Identity> {
  if (!serviceClientAvailable()) return { state: "not_configured", fix: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the deployment, then redeploy." }
  try {
    // A number nobody owns: the answer is "no user", which proves the function exists and the key can call it.
    const { error } = await createServiceClient().rpc("identity_resolve_whatsapp_user", { p_phone_e164: "+10000000000" })
    if (!error) return { state: "ok", fix: "" }
    const missing = error.code === "PGRST202" || /could not find the function|does not exist/i.test(error.message || "")
    return missing
      ? { state: "function_missing", fix: "The database does not have the phone binding functions. Run supabase/migrations/20261004_unified_identity_channels.sql and 20261005_verified_phone_binding.sql in the Supabase SQL editor." }
      : { state: "unreachable", fix: "The database refused the request. Check SUPABASE_SERVICE_ROLE_KEY belongs to the project in NEXT_PUBLIC_SUPABASE_URL." }
  } catch {
    return { state: "unreachable", fix: "The database did not answer. Try again in a minute." }
  }
}

export async function GET() {
  if (cached && Date.now() - cached.at < 60_000) return NextResponse.json({ ...cached.report, cached: true })
  const [sms, identity, whatsapp] = await Promise.all([phoneVerifyStatus(), identityStatus(), waStatus()])
  const report: Report = { ok: sms.state === "ok" && identity.state === "ok" && whatsapp.state === "ok", checkedAt: new Date().toISOString(), sms, identity, whatsapp }
  cached = { at: Date.now(), report }
  return NextResponse.json(report)
}
