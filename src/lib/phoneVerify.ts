/**
 * Mobile number verification (Twilio Verify), in one place.
 *
 * Why this file exists (2026-10-05): every new user was stuck on setup step 1. "Send code" answered with Twilio's own sentence,
 * "authentication failed, auth token is not valid for account AC…", shown raw in the form. Two routes each built their own
 * request, read the settings as they were typed (a pasted value with a space or a line break at its end fails exactly this way),
 * and passed the provider's message, account id included, to the browser.
 *
 * What it does now:
 *   - settings are cleaned before use: surrounding spaces, line breaks and quotes are removed;
 *   - an API key pair (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET) works as well as the account's auth token;
 *   - a refusal is sorted into a reason, and the person sees a sentence about what THEY can do. The provider's own message goes
 *     to the server log only;
 *   - `phoneVerifyStatus()` says, without revealing any value, whether the provider accepts the credentials and the service exists.
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET),
 *      TWILIO_VERIFY_SERVICE_SID (TWILIO_SERVICE_SID is accepted too).
 */

export function normalizePhone(input: string): string | null {
  const trimmed = String(input || "").trim()
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed
  if (trimmed.startsWith("+")) return null                    // written as international but not a valid one: never re-read as a US number
  const digits = trimmed.replace(/\D/g, "")
  // A US number: ten digits whose area code starts 2 to 9, with or without the leading 1.
  if (/^[2-9]\d{9}$/.test(digits)) return `+1${digits}`
  if (/^1[2-9]\d{9}$/.test(digits)) return `+${digits}`
  return null
}

/** A setting as it should have been typed: no spaces or line breaks around it, no quotes wrapped around it. */
const clean = (v: string | undefined) => String(v || "").trim().replace(/^["']+|["']+$/g, "").trim()

type Config = { accountSid: string; user: string; pass: string; service: string; usingApiKey: boolean }

function config(): Config | null {
  const accountSid = clean(process.env.TWILIO_ACCOUNT_SID)
  const token = clean(process.env.TWILIO_AUTH_TOKEN)
  const keySid = clean(process.env.TWILIO_API_KEY_SID)
  const keySecret = clean(process.env.TWILIO_API_KEY_SECRET)
  const service = clean(process.env.TWILIO_VERIFY_SERVICE_SID) || clean(process.env.TWILIO_SERVICE_SID)
  if (!accountSid || !service) return null
  if (keySid && keySecret) return { accountSid, user: keySid, pass: keySecret, service, usingApiKey: true }
  if (!token) return null
  return { accountSid, user: accountSid, pass: token, service, usingApiKey: false }
}

const basic = (c: Config) => `Basic ${Buffer.from(`${c.user}:${c.pass}`).toString("base64")}`

export type VerifyReason =
  | "not_configured"      // a setting is missing
  | "credentials_rejected" // the provider does not accept the account id / token pair
  | "service_not_found"   // the Verify service id does not exist on that account
  | "invalid_number"      // not a number a code can be sent to
  | "landline"            // the number cannot receive text messages
  | "too_many_attempts"   // the provider is rate limiting this number
  | "trial_account"       // a trial account can only text numbers verified in the provider's console
  | "blocked"             // the provider blocked this number or region
  | "wrong_code"          // the code is not the one that was sent
  | "expired"             // no pending verification: it expired, was used, or was never sent
  | "provider_down"       // the provider could not be reached or answered with a server error
  | "refused"             // anything else

/** What the person filling in the form is told. Never the provider's own words. */
const USER_MESSAGE: Record<VerifyReason, string> = {
  not_configured: "Text verification is not switched on yet. This is on our side, not yours.",
  credentials_rejected: "We could not send the code: our text-message service is not accepting our account right now. Nothing is wrong with your number. Please try again later.",
  service_not_found: "We could not send the code: our text-message service is not set up correctly. Nothing is wrong with your number. Please try again later.",
  invalid_number: "That number does not look right. Enter a US 10-digit mobile number, or an international number starting with + and the country code.",
  landline: "That number cannot receive text messages. Enter a mobile number.",
  too_many_attempts: "Too many codes were requested for this number. Wait 10 minutes, then try again.",
  trial_account: "We cannot text this number yet. This is a limit on our side, not a problem with your number.",
  blocked: "Text messages to this number are blocked by the carrier or region. Try another mobile number.",
  wrong_code: "That code is not right. Check the latest text message and try again.",
  expired: "That code has expired or was already used. Press Send code to get a new one.",
  provider_down: "The text-message service did not answer. Please try again in a minute.",
  refused: "We could not complete the verification. Please try again in a minute.",
}

/** Twilio's numeric error code -> our reason. https://www.twilio.com/docs/api/errors */
function reasonFor(status: number, code: number, message: string, checking: boolean): VerifyReason {
  if (status === 401 || code === 20003 || code === 20005 || code === 20006) return "credentials_rejected"
  if (code === 20404 || status === 404) return checking ? "expired" : "service_not_found"
  if (code === 60200 || code === 21211 || code === 21614 || code === 60033) return "invalid_number"
  if (code === 60205) return "landline"
  if (code === 60203 || code === 60202 || code === 20429 || status === 429) return "too_many_attempts"
  if (code === 21608 || code === 60238 || /unverified|trial account/i.test(message)) return "trial_account"
  if (code === 60410 || code === 60605 || code === 21612 || code === 60220) return "blocked"
  if (status >= 500) return "provider_down"
  return "refused"
}

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyReason; message: string; http: number }

const fail = (reason: VerifyReason): VerifyResult => ({
  ok: false, reason, message: USER_MESSAGE[reason],
  // 503: ours to fix. 400: the person can fix it. 429: wait.
  http: reason === "too_many_attempts" ? 429
    : ["invalid_number", "landline", "wrong_code", "expired", "blocked"].includes(reason) ? 400 : 503,
})

async function call(c: Config, path: string, form: Record<string, string>, checking: boolean): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; result: VerifyResult }> {
  let res: Response
  try {
    res = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(c.service)}/${path}`, {
      method: "POST",
      headers: { Authorization: basic(c), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    console.error("[phone-verify] provider not reached", { step: path })
    return { ok: false, result: fail("provider_down") }
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.ok) return { ok: true, body }
  const code = Number(body.code) || 0, message = String(body.message || "")
  const reason = reasonFor(res.status, code, message, checking)
  // The provider's own message stays here, in the server log. It names the account, so it never goes to a browser.
  console.error("[phone-verify] refused", { step: path, status: res.status, code, reason, message: message.slice(0, 200) })
  return { ok: false, result: fail(reason) }
}

/** Text a code to `phone` (E.164). */
export async function sendVerificationCode(phone: string): Promise<VerifyResult> {
  const c = config()
  if (!c) return fail("not_configured")
  const r = await call(c, "Verifications", { To: phone, Channel: "sms" }, false)
  return r.ok ? { ok: true } : r.result
}

/** Is `code` the one that was texted to `phone`? */
export async function checkVerificationCode(phone: string, code: string): Promise<VerifyResult> {
  const c = config()
  if (!c) return fail("not_configured")
  const r = await call(c, "VerificationCheck", { To: phone, Code: code }, true)
  if (!r.ok) return r.result
  return r.body.status === "approved" ? { ok: true } : fail("wrong_code")
}

export type PhoneVerifyStatus = {
  state: "ok" | "not_configured" | "credentials_rejected" | "service_not_found" | "trial_account" | "provider_down"
  /** What to do about it, for whoever runs the deployment. No value of any setting is ever included. */
  fix: string
  /** The shape of what is stored, so a pasted mistake can be seen without seeing the secret. */
  settings: { accountId: "ok" | "missing" | "wrong_shape"; secret: "ok" | "missing" | "wrong_shape"; service: "ok" | "missing" | "wrong_shape"; hadStraySpacesOrQuotes: boolean; using: "auth_token" | "api_key" | "none" }
}

/**
 * Does the provider accept what is stored, and does the Verify service exist? Two read-only requests; no text message is sent
 * and nothing is charged. Safe to show publicly: it reports states and shapes, never a value.
 */
export async function phoneVerifyStatus(): Promise<PhoneVerifyStatus> {
  const raw = [process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET, process.env.TWILIO_VERIFY_SERVICE_SID, process.env.TWILIO_SERVICE_SID]
  const hadStraySpacesOrQuotes = raw.some(v => v !== undefined && v !== clean(v))
  const accountSid = clean(process.env.TWILIO_ACCOUNT_SID), token = clean(process.env.TWILIO_AUTH_TOKEN)
  const keySid = clean(process.env.TWILIO_API_KEY_SID), keySecret = clean(process.env.TWILIO_API_KEY_SECRET)
  const service = clean(process.env.TWILIO_VERIFY_SERVICE_SID) || clean(process.env.TWILIO_SERVICE_SID)
  const usingKey = !!(keySid && keySecret)
  const shape = (v: string, re: RegExp) => (!v ? "missing" : re.test(v) ? "ok" : "wrong_shape") as "ok" | "missing" | "wrong_shape"
  const settings: PhoneVerifyStatus["settings"] = {
    accountId: shape(accountSid, /^AC[0-9a-fA-F]{32}$/),
    secret: usingKey ? (shape(keySid, /^SK[0-9a-fA-F]{32}$/) === "ok" && keySecret.length >= 16 ? "ok" : "wrong_shape") : shape(token, /^[0-9a-fA-F]{32}$/),
    service: shape(service, /^VA[0-9a-fA-F]{32}$/),
    hadStraySpacesOrQuotes,
    using: usingKey ? "api_key" : token ? "auth_token" : "none",
  }
  const c = config()
  if (!c) return { state: "not_configured", settings, fix: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID on the deployment, then redeploy." }

  const get = async (url: string) => {
    try { const r = await fetch(url, { headers: { Authorization: basic(c) }, signal: AbortSignal.timeout(12000) }); return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> } }
    catch { return { status: 0, body: {} as Record<string, unknown> } }
  }
  const account = await get(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.accountSid)}.json`)
  if (account.status === 0 || account.status >= 500) return { state: "provider_down", settings, fix: "The text-message provider did not answer. Try again in a minute." }
  if (account.status === 401 || account.status === 403 || account.status === 404) {
    const hint = settings.accountId !== "ok" ? "TWILIO_ACCOUNT_SID is not an account id (it starts with AC and has 34 characters)."
      : settings.secret !== "ok" ? (usingKey ? "The API key pair does not have the right shape (the key id starts with SK)." : "TWILIO_AUTH_TOKEN is not an auth token (32 letters and digits). An API key secret, a test token or a clipped paste will not work there.")
      : "TWILIO_AUTH_TOKEN does not belong to this account id, or it was replaced in the provider's console after it was copied."
    return { state: "credentials_rejected", settings, fix: `${hint} Copy the Account SID and the live Auth Token again from the Twilio console (Account Info), save both on the deployment, then redeploy.` }
  }
  const svc = await get(`https://verify.twilio.com/v2/Services/${encodeURIComponent(c.service)}`)
  if (svc.status === 404) return { state: "service_not_found", settings, fix: "The Verify service id does not exist on this account. In the Twilio console open Verify, Services, copy the Service SID (it starts with VA) into TWILIO_VERIFY_SERVICE_SID, then redeploy." }
  if (svc.status === 401 || svc.status === 403) return { state: "credentials_rejected", settings, fix: "The account answered but refused the Verify service. Check that the Verify service belongs to this account id." }
  if (svc.status === 0 || svc.status >= 500) return { state: "provider_down", settings, fix: "The text-message provider did not answer. Try again in a minute." }
  if (String(account.body.type || "").toLowerCase() === "trial") {
    return { state: "trial_account", settings, fix: "The credentials work, but this is a trial account: it can only text numbers that were verified in the Twilio console. Upgrade the account so new people can receive their code." }
  }
  return { state: "ok", settings, fix: "" }
}
