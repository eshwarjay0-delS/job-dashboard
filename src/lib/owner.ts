/**
 * The people who run this deployment, named in settings and never in code.
 *
 *   ADMIN_EMAILS            comma-separated Google emails. An admin can finish setup without a verified mobile number, so a broken
 *                           text-message provider cannot lock the owner out of the product.
 *   WHATSAPP_OWNER_NUMBERS  comma-separated numbers (digits with country code) the WhatsApp bot answers without the phone binding.
 *                           "13145550100" uses the deployment's default bot user; "13145550100=<user id>" names the account.
 *
 * Why (2026-10-05): phone verification and the database binding were both down (a wrong Twilio token and a wrong Supabase key on
 * the deployment), so nobody could link a number, and the owner could not use his own bot. A WhatsApp sender cannot be forged here:
 * Meta signs every webhook and the signature is checked before a message is read (WHATSAPP_APP_SECRET).
 */
const items = (v: string | undefined) => String(v || "").split(",").map(s => s.trim()).filter(Boolean)
const digits = (s: string) => s.replace(/\D/g, "")

export function isAdminEmail(email: string | null | undefined): boolean {
  const mine = String(email || "").trim().toLowerCase()
  return !!mine && items(process.env.ADMIN_EMAILS).some(e => e.toLowerCase() === mine)
}

/** The account a listed owner number writes as, or null when the sender is not listed. */
export function ownerWhatsAppUserId(from: string, fallbackUserId: string): string | null {
  const sender = digits(String(from || ""))
  if (sender.length < 8) return null
  for (const entry of items(process.env.WHATSAPP_OWNER_NUMBERS)) {
    const [number, userId] = entry.split("=").map(s => s.trim())
    if (digits(number) === sender) return userId || fallbackUserId
  }
  return null
}
