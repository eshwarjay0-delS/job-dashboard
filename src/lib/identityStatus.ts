/**
 * Can a verified mobile number be linked to an account right now, and can setup therefore ask for one?
 *
 * identityStatus()        the database side: the service key works and both functions the confirm step calls exist.
 * phoneStepAvailable()    the whole step: a code can be texted AND the number can be linked. Setup requires a verified number
 *                         only while this is true; when it is not, nobody can verify, so requiring it would lock every new
 *                         person out for a fault that is ours (that is what happened on 2026-10-05).
 *
 * Nothing here writes. Results are kept for 60 seconds per server instance, and callers that arrive together share one probe.
 */
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { phoneVerifyStatus } from "@/lib/phoneVerify"

export type IdentityStatus = { state: "ok" | "not_configured" | "function_missing" | "not_service_key" | "key_rejected" | "unreachable"; fix: string }

const MIGRATIONS = "Run supabase/migrations/20261004_unified_identity_channels.sql and 20261005_verified_phone_binding.sql in the Supabase SQL editor."
const isMissing = (e: { code?: string; message?: string }) => e.code === "PGRST202" || /could not find the function|does not exist/i.test(e.message || "")

export async function identityStatus(): Promise<IdentityStatus> {
  if (!serviceClientAvailable()) return { state: "not_configured", fix: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the deployment, then redeploy." }
  try {
    const service = createServiceClient()
    // A number nobody owns: the answer is "no user", which proves the function exists and the key can call it.
    const { error } = await service.rpc("identity_resolve_whatsapp_user", { p_phone_e164: "+10000000000" })
    if (error) {
      if (isMissing(error)) return { state: "function_missing", fix: `The database does not have the phone binding functions. ${MIGRATIONS}` }
      // The functions are granted to service_role only, so "permission denied" means the key works but is not the service key.
      if (error.code === "42501" || /permission denied/i.test(error.message || "")) {
        return { state: "not_service_key", fix: "SUPABASE_SERVICE_ROLE_KEY is a key for this project, but not the service-role one (often the anon or publishable key pasted by mistake). In Supabase open Project Settings, API Keys, copy the service_role secret, save it on the deployment, then redeploy." }
      }
      if (/invalid api key|jwt|jws|signature/i.test(error.message || "") || /^PGRST30/.test(error.code || "")) {
        return { state: "key_rejected", fix: "Supabase does not accept SUPABASE_SERVICE_ROLE_KEY: it is from another project, was rotated, or was clipped when pasted. Copy the service_role secret again from this project's API Keys, save it on the deployment, then redeploy." }
      }
      return { state: "unreachable", fix: "The database refused the request. Check SUPABASE_SERVICE_ROLE_KEY belongs to the project in NEXT_PUBLIC_SUPABASE_URL." }
    }
    // The function that does the linking came in a later migration than the one above. Called with nothing, it stops at its own
    // first check (INVALID_PHONE_BINDING) before it touches a row; "function not found" means that migration was never run, and
    // every confirm would spend the person's code and then fail.
    const bind = await service.rpc("identity_bind_verified_phone", { p_user_id: null, p_phone_e164: null, p_phone_hash: null, p_last4: null, p_whatsapp_opt_in: null })
    if (bind.error && isMissing(bind.error)) return { state: "function_missing", fix: `The database can look a number up but cannot link one: the linking function is missing. ${MIGRATIONS}` }
    return { state: "ok", fix: "" }
  } catch {
    return { state: "unreachable", fix: "The database did not answer. Try again in a minute." }
  }
}

let kept: { at: number; available: boolean } | null = null
let inflight: Promise<boolean> | null = null

/** True when a person can actually get a code and have their number linked. ONBOARDING_PHONE_STRICT=1 always answers true. */
export async function phoneStepAvailable(): Promise<boolean> {
  if (process.env.ONBOARDING_PHONE_STRICT === "1") return true
  if (kept && Date.now() - kept.at < 60_000) return kept.available
  inflight ??= (async () => {
    try {
      const [sms, identity] = await Promise.all([phoneVerifyStatus(), identityStatus()])
      // A trial account still texts the numbers its owner verified, so the step is not dead; a silent provider is not proof either way.
      const available = !["not_configured", "credentials_rejected", "service_not_found"].includes(sms.state) && !["not_configured", "function_missing", "not_service_key", "key_rejected"].includes(identity.state)
      kept = { at: Date.now(), available }
      return available
    } catch { return true }                                   // when in doubt the requirement stands
    finally { inflight = null }
  })()
  return inflight
}
