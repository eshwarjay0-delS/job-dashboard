// Which MarketFit account a WhatsApp number saves into.
//
// Why (13 Oct 2026): resumes made over WhatsApp never showed in Files. The bot saved under the deployment's default bot
// user, and Files shows the folder of the account that is signed in: two different places. The other way to join them,
// a text-message check of the mobile number, needs a provider that was not working on this deployment.
//
// So the person joins them from the two ends they already hold. Signed in, the WhatsApp page shows a code. They send
// "link <code>" to the bot from their own WhatsApp. Meta signs every message (the signature is checked before a message
// is read), so the number is proven; the code is proven by the sign-in. A code works once, for fifteen minutes, and a
// number may try five codes an hour: eight characters from thirty-two cannot be guessed at that rate.

import { randomBytes } from "crypto"

/** The few things this needs from storage. The real one is the blob store; a test hands in a Map. */
export type LinkStore = { getText(key: string): Promise<string | null>; put(key: string, data: string): Promise<void>; delete(key: string): Promise<void> }
export type Claim = { ok: true; userId: string } | { ok: false; why: "bad_code" | "too_many" }

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   // no I, O, 0 or 1: they are misread
export const CODE_MINUTES = 15
const TRIES_AN_HOUR = 5
const MOST_NUMBERS = 5

const digitsOf = (s: string): string => String(s || "").replace(/\D/g, "")
const codeKey = (code: string): string => `whatsapp/link-codes/${code}.json`
const linkKey = (digits: string): string => `whatsapp/links/${digits}.json`
const ownKey = (userId: string): string => `whatsapp/linked/${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`
const triesKey = (digits: string): string => `whatsapp/link-tries/${digits}.json`

/** A code as the person may type it ("k7qm 2xhd", "K7QM-2XHD") in its one stored form, or "" when it cannot be one. */
export function tidyCode(typed: string): string {
  const code = String(typed || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  return code.length === 8 && [...code].every(c => LETTERS.includes(c)) ? code : ""
}
export const showCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`

/** The joining of numbers to accounts, kept in the store it is handed. */
export function linksOver(blob: LinkStore) {
  async function readJson<T>(key: string, empty: T): Promise<T> {
    try { const raw = await blob.getText(key); return raw ? (JSON.parse(raw) as T) : empty } catch { return empty }
  }

  /** A new code for this account. The one before it stops working. */
  async function newLinkCode(userId: string): Promise<{ code: string; expiresAt: number }> {
    const own = await readJson<{ numbers: { digits: string; at: number }[]; code?: string }>(ownKey(userId), { numbers: [] })
    if (own.code) await blob.delete(codeKey(own.code)).catch(() => {})
    const bytes = randomBytes(8)
    const code = [...bytes].map(b => LETTERS[b % 32]).join("")
    const expiresAt = Date.now() + CODE_MINUTES * 60_000
    await blob.put(codeKey(code), JSON.stringify({ userId, expiresAt }))
    await blob.put(ownKey(userId), JSON.stringify({ ...own, code }))
    return { code, expiresAt }
  }


  /** The bot's side: this number sent this code. A right code joins the number to the account and is used up. */
  async function claimLinkCode(from: string, typed: string, now = Date.now()): Promise<Claim> {
    const digits = digitsOf(from)
    if (digits.length < 8) return { ok: false, why: "bad_code" }
    const tries = (await readJson<number[]>(triesKey(digits), [])).filter(t => now - t < 60 * 60_000)
    if (tries.length >= TRIES_AN_HOUR) return { ok: false, why: "too_many" }
    const code = tidyCode(typed)
    const held = code ? await readJson<{ userId?: string; expiresAt?: number } | null>(codeKey(code), null) : null
    if (!held?.userId || !held.expiresAt || held.expiresAt < now) {
      await blob.put(triesKey(digits), JSON.stringify([...tries, now])).catch(() => {})
      return { ok: false, why: "bad_code" }
    }
    await blob.delete(codeKey(code)).catch(() => {})
    // A number belongs to one account at a time: joining it here takes it off the account it was on.
    const before = await readJson<{ userId?: string } | null>(linkKey(digits), null)
    if (before?.userId && before.userId !== held.userId) await dropNumber(before.userId, digits)
    await blob.put(linkKey(digits), JSON.stringify({ userId: held.userId, at: now }))
    const own = await readJson<{ numbers: { digits: string; at: number }[]; code?: string }>(ownKey(held.userId), { numbers: [] })
    const numbers = [...own.numbers.filter(n => n.digits !== digits), { digits, at: now }].slice(-MOST_NUMBERS)
    for (const gone of own.numbers.filter(n => !numbers.some(k => k.digits === n.digits))) await blob.delete(linkKey(gone.digits)).catch(() => {})
    await blob.put(ownKey(held.userId), JSON.stringify({ numbers }))
    return { ok: true, userId: held.userId }
  }

  async function dropNumber(userId: string, digits: string): Promise<void> {
    const own = await readJson<{ numbers: { digits: string; at: number }[]; code?: string }>(ownKey(userId), { numbers: [] })
    await blob.put(ownKey(userId), JSON.stringify({ ...own, numbers: own.numbers.filter(n => n.digits !== digits) })).catch(() => {})
  }

  /** The account this number was joined to, or null. */
  async function linkedUserId(from: string): Promise<string | null> {
    const digits = digitsOf(from)
    if (digits.length < 8) return null
    const held = await readJson<{ userId?: string } | null>(linkKey(digits), null)
    return held?.userId ? String(held.userId) : null
  }

  /** The numbers joined to this account, shown by their last four digits only. */
  async function linkedNumbers(userId: string): Promise<{ ending: string; at: number }[]> {
    const own = await readJson<{ numbers: { digits: string; at: number }[] }>(ownKey(userId), { numbers: [] })
    return (own.numbers || []).map(n => ({ ending: n.digits.slice(-4), at: n.at }))
  }

  /** Take every number off this account. Files already saved stay where they are. */
  async function unlinkAll(userId: string): Promise<number> {
    const own = await readJson<{ numbers: { digits: string; at: number }[]; code?: string }>(ownKey(userId), { numbers: [] })
    for (const n of own.numbers || []) await blob.delete(linkKey(n.digits)).catch(() => {})
    if (own.code) await blob.delete(codeKey(own.code)).catch(() => {})
    await blob.put(ownKey(userId), JSON.stringify({ numbers: [] }))
    return (own.numbers || []).length
  }

  return { newLinkCode, claimLinkCode, linkedUserId, linkedNumbers, unlinkAll }
}
