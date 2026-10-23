// UPI and PhonePe checkout through Razorpay, built switched off.
//
// What it prevents: taking money before the owner has a payment account, a key living in code, and a plan being sold
// at a price nobody set. The checkout is on only when the owner has put both Razorpay keys in the deployment's
// environment (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET). Without them every call answers "not switched on yet" and
// nothing is sent anywhere. With them, a plan whose price is still blank in src/lib/plan-catalog.ts is refused.
//
// Why Razorpay: nothing in the codebase takes payments yet (the Terms and Privacy pages name Stripe as template text
// only), and Razorpay offers UPI, which covers PhonePe and the other UPI apps, on its own hosted payment page. A
// visitor is sent to Razorpay's hosted page and comes back to /api/checkout/return, so no payment script runs on our
// pages and the security headers stay as they are. A payment is trusted only when Razorpay's signature checks out
// against the secret key. Granting the hours a payment bought is left to the owner (top-ups are admin-only, see
// src/lib/creditsLedger.ts), because how many hours a plan holds is also still blank.
//
// Everything that reaches the outside world is passed in (env, fetch, storage), so tests never take a payment.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { isPaid, isPriced, planById } from "./plan-catalog.ts"

type Env = Record<string, string | undefined>
export type CheckoutStore = {
  getText(key: string): Promise<string | null>
  put(key: string, data: string): Promise<void>
}
type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export const CHECKOUT_KEYS = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] as const
export const CHECKOUT_PROVIDER = "Razorpay"
export const CHECKOUT_METHODS = ["UPI", "PhonePe"]
export const CHECKOUT_OFF_MESSAGE = "Payments are not switched on yet. Nothing can be charged until the owner connects a payment account."
const PAYMENT_LINKS_URL = "https://api.razorpay.com/v1/payment_links"

export type CheckoutStatus = {
  enabled: boolean
  provider: typeof CHECKOUT_PROVIDER
  methods: string[]
  /** The names of the settings still missing. Names only: a value is never read back out. */
  missing: string[]
  message: string
}

/** On only when both Razorpay keys are set and look like Razorpay keys. Never returns a key's value. */
export function checkoutStatus(env: Env = process.env): CheckoutStatus {
  const missing: string[] = CHECKOUT_KEYS.filter(name => !String(env[name] || "").trim())
  const keyId = String(env.RAZORPAY_KEY_ID || "").trim()
  const malformed = keyId !== "" && !/^rzp_(live|test)_[A-Za-z0-9]+$/.test(keyId)
  const enabled = missing.length === 0 && !malformed
  const message = enabled
    ? `Checkout is on through ${CHECKOUT_PROVIDER}. UPI and PhonePe are offered for plans priced in rupees.`
    : malformed ? "Payments are not switched on: RAZORPAY_KEY_ID does not look like a Razorpay key id." : CHECKOUT_OFF_MESSAGE
  return { enabled, provider: CHECKOUT_PROVIDER, methods: CHECKOUT_METHODS, missing, message }
}

export type Reply = { status: number; body: Record<string, unknown> }

/**
 * Start a checkout for one plan: create a Razorpay payment link and hand back its address.
 * `userRef` is the one-way hash of the signed-in user's id (never an email); null means not signed in.
 */
export async function startCheckout(input: {
  body: unknown
  env?: Env
  userRef: string | null
  origin: string
  fetchImpl: Fetch
  store: CheckoutStore
  now?: number
  random?: () => string
}): Promise<Reply> {
  const env = input.env ?? process.env
  const status = checkoutStatus(env)
  if (!status.enabled) return { status: 503, body: { error: status.message, enabled: false } }
  if (!input.userRef) return { status: 401, body: { error: "Sign in to buy a plan." } }

  const planId = input.body && typeof input.body === "object" ? (input.body as { planId?: unknown }).planId : undefined
  const plan = planById(planId)
  if (!plan || !isPaid(plan)) return { status: 400, body: { error: "Choose one of the paid plans." } }
  if (!isPriced(plan)) return { status: 409, body: { error: "This plan has no price yet, so it cannot be bought." } }

  const reference = `mfit_${plan.id}_${(input.random ?? (() => randomBytes(8).toString("hex")))()}`
  const amountMinor = Math.round(plan.price.amount * 100)
  const auth = Buffer.from(`${String(env.RAZORPAY_KEY_ID).trim()}:${String(env.RAZORPAY_KEY_SECRET).trim()}`).toString("base64")
  let link: { id?: unknown; short_url?: unknown }
  try {
    const res = await input.fetchImpl(PAYMENT_LINKS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: amountMinor,
        currency: plan.price.currency,
        accept_partial: false,
        description: `MarketFit ${plan.name}`,
        reference_id: reference,
        callback_url: `${input.origin.replace(/\/$/, "")}/api/checkout/return`,
        callback_method: "get",
        notes: { plan: plan.id },
      }),
    })
    // The provider's own error text is not passed on: it can name the account.
    if (!res.ok) return { status: 502, body: { error: "The payment provider did not answer. Nothing was charged." } }
    link = (await res.json()) as typeof link
  } catch {
    return { status: 502, body: { error: "The payment provider could not be reached. Nothing was charged." } }
  }
  if (typeof link.id !== "string" || typeof link.short_url !== "string" || !/^https:\/\//.test(link.short_url)) {
    return { status: 502, body: { error: "The payment provider sent back something unexpected. Nothing was charged." } }
  }
  await input.store.put(`payments/links/${reference}.json`, JSON.stringify({
    reference, linkId: link.id, planId: plan.id, userRef: input.userRef,
    amount: plan.price.amount, currency: plan.price.currency, createdAt: new Date(input.now ?? Date.now()).toISOString(),
  }))
  return { status: 200, body: { url: link.short_url } }
}

/** Razorpay signs a payment-link return as HMAC-SHA256(link_id|reference_id|status|payment_id) with the secret key. */
export function paymentLinkSignatureValid(p: { linkId: string; reference: string; status: string; paymentId: string; signature: string }, secret: string): boolean {
  if (!secret || !/^[0-9a-f]{64}$/i.test(p.signature)) return false
  const expected = createHmac("sha256", secret).update(`${p.linkId}|${p.reference}|${p.status}|${p.paymentId}`).digest()
  return timingSafeEqual(expected, Buffer.from(p.signature, "hex"))
}

/**
 * Where to send a visitor coming back from the payment page. A payment is recorded for the owner only when the
 * signature checks out, the link is one we created, and Razorpay says it is paid. Returns the page to redirect to.
 */
export async function finishCheckout(input: { query: URLSearchParams; env?: Env; store: CheckoutStore; now?: number }): Promise<string> {
  const env = input.env ?? process.env
  if (!checkoutStatus(env).enabled) return "/plans?payment=off"
  const q = input.query
  const p = {
    paymentId: q.get("razorpay_payment_id") || "",
    linkId: q.get("razorpay_payment_link_id") || "",
    reference: q.get("razorpay_payment_link_reference_id") || "",
    status: q.get("razorpay_payment_link_status") || "",
    signature: q.get("razorpay_signature") || "",
  }
  const shaped = /^pay_[A-Za-z0-9]+$/.test(p.paymentId) && /^plink_[A-Za-z0-9]+$/.test(p.linkId) && /^mfit_[a-z-]+_[0-9a-f]{16}$/.test(p.reference)
  if (!shaped || !paymentLinkSignatureValid(p, String(env.RAZORPAY_KEY_SECRET || "").trim())) return "/plans?payment=unverified"
  if (p.status !== "paid") return "/plans?payment=not-paid"

  const raw = await input.store.getText(`payments/links/${p.reference}.json`).catch(() => null)
  let record: { linkId?: string } | null = null
  try { record = raw ? JSON.parse(raw) : null } catch { record = null }
  if (!record || record.linkId !== p.linkId) return "/plans?payment=unverified"

  // Keyed by the payment id, so a reload of the return page records it once.
  await input.store.put(`payments/paid/${p.paymentId}.json`, JSON.stringify({
    ...record, paymentId: p.paymentId, status: p.status, paidAt: new Date(input.now ?? Date.now()).toISOString(), granted: false,
  }))
  return "/plans?payment=received"
}
