// Who a WhatsApp number writes as, and whether the bot answers it at all. The rules, and why, are in
// whatsapp-who-core.ts; here they are tied to the link store, the owner's settings and the database of verified numbers.
import { blob } from "@/lib/storage"
import { linkedUserIdChecked } from "@/lib/whatsapp-link"
import { ownerWhatsAppUserId, adminEmails } from "@/lib/owner"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { noticeDue, openToAll, type Notice, type RegisteredBy } from "@/lib/whatsapp-who-core"

export const FALLBACK_USER_ID = process.env.WHATSAPP_USER_ID || "demo"
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const digits = (from: string) => String(from || "").replace(/\D/g, "")

/**
 * Who this number writes as. `own` is true when the account was found for THIS number (it joined itself with a code, the
 * owner named it in settings, or its mobile number was verified); false when it is the default every unjoined number
 * shares. `saves` says whether what the bot makes is put in Files: for an account of its own, or when the deployment's
 * default is itself a real account.
 */
export type Who = { userId: string; own: boolean; saves: boolean }
/**
 * `who` is null when the number is not registered. `checked` is false when that could not be found out (the store or
 * the database did not answer): the person is then told so, and never told they are not registered.
 */
export type Sender = { who: Who | null; by: RegisteredBy | "open" | null; checked: boolean }

export async function resolveWhatsAppUser(from: string): Promise<Sender> {
  const who = (userId: string, own: boolean): Who => ({ userId, own, saves: own || UUID.test(userId) })
  let checked = true
  // A number that joined itself to an account with a code from the WhatsApp page (src/lib/whatsapp-link.ts).
  const linked = await linkedUserIdChecked(from)
  if (linked.userId) return { who: who(linked.userId, true), by: "code", checked: true }
  if (!linked.checked) checked = false
  // A number the owner listed in settings is answered without the binding (see src/lib/owner.ts for why).
  const owner = ownerWhatsAppUserId(from, FALLBACK_USER_ID)
  if (owner) {
    if (owner !== FALLBACK_USER_ID) return { who: who(owner, true), by: "owner", checked: true }
    // The owner's number with no account named beside it. Until 13 Oct 2026 it then wrote as the default bot user, so
    // nothing the bot made for the owner ever reached his Files ("Whatsapp edited resume needs store as the rules i have
    // stated to you!"; his Files held 0). The owner's account is the one that signs in with the owner's own address,
    // and both are named by him in settings: the number is joined to it without a step from him.
    const account = await ownerAccountId()
    return { who: account ? who(account, true) : who(owner, false), by: "owner", checked: true }
  }
  // A number whose mobile code was confirmed in setup (POST /api/identity/phone/confirm writes it to the database).
  if (serviceClientAvailable()) {
    try {
      const { data, error } = await createServiceClient().rpc("identity_resolve_whatsapp_user", { p_phone_e164: `+${digits(from)}` })
      if (!error && data) return { who: who(String(data), true), by: "verified", checked: true }
      if (error) { checked = false; console.error("[whatsapp] verified numbers not asked", String(error.message || "").slice(0, 200)) }
    } catch { checked = false /* the database is not reachable */ }
  }
  // Registered nowhere. It is answered only on a deployment that says it is open to everyone.
  if (openToAll(process.env.WHATSAPP_IDENTITY_BINDING_REQUIRED)) return { who: who(FALLBACK_USER_ID, false), by: "open", checked }
  return { who: null, by: null, checked }
}

// The one account that signs in with an address the owner listed in ADMIN_EMAILS. None when there is no such account
// yet, or more than one (then it cannot be known whose Files to use, and the number is joined with a code instead).
let ownerAccount: { id: string | null; at: number } | null = null
export async function ownerAccountId(): Promise<string | null> {
  if (ownerAccount && Date.now() - ownerAccount.at < 5 * 60_000) return ownerAccount.id
  let id: string | null = null
  try {
    const emails = adminEmails()
    if (emails.length && serviceClientAvailable()) {
      const { data } = await createServiceClient().from("profiles").select("id,email").in("email", emails).limit(3)
      const rows = (data || []).filter(r => UUID.test(String(r.id)))
      if (rows.length === 1) id = String(rows[0].id)
    }
  } catch { /* not known this time: asked again on the next message */ return null }
  ownerAccount = { id, at: Date.now() }
  return id
}

const noticeKey = (from: string) => `whatsapp/unregistered/${digits(from)}.json`

/**
 * May this notice be sent to this number now? When it may, it is written down as sent before the answer is given, so
 * messages that arrive one after another get one notice. (Two that arrive in the same instant can each get one: the
 * store has no way to say "only if nobody wrote first".) When the record cannot be read or kept, "you are not
 * registered" is not sent: better none than one for every message. "I could not check your number" is still sent,
 * since the store being down is exactly when a registered person needs to be told something.
 */
export async function claimNotice(from: string, kind: Notice, now = Date.now()): Promise<boolean> {
  if (digits(from).length < 8) return false
  try {
    const raw = await blob.getText(noticeKey(from))
    const last = (raw ? JSON.parse(raw) : {}) as Partial<Record<Notice, number>>
    if (!noticeDue(last, kind, now)) return false
    await blob.put(noticeKey(from), JSON.stringify({ ...last, [kind]: now }))
    return true
  } catch { return kind === "unchecked" }
}
