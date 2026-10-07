const items = (v: string | undefined) => String(v || "").split(",").map(s => s.trim()).filter(Boolean)
const digits = (s: string) => s.replace(/\D/g, "")

// This account is the product owner. Authorization still requires a real
// Supabase session; this value only classifies an already authenticated user.
const PRODUCT_OWNER_EMAIL = "eshwarjay0@gmail.com"

export function isAdminEmail(email: string | null | undefined): boolean {
  const mine = String(email || "").trim().toLowerCase()
  if (!mine) return false
  if (mine === PRODUCT_OWNER_EMAIL) return true
  return items(process.env.ADMIN_EMAILS).some(e => e.toLowerCase() === mine)
}
export function isOwnerEmail(email: string | null | undefined): boolean {
  return String(email || "").trim().toLowerCase() === PRODUCT_OWNER_EMAIL
}
export function ownerRole(email: string | null | undefined): "owner" | "user" { return isOwnerEmail(email) ? "owner" : "user" }
export function isOwnerWhatsApp(from: string): boolean { return ownerWhatsAppUserId(from, "-") !== null }
export function ownerWhatsAppUserId(from: string, fallbackUserId: string): string | null {
  if (!(process.env.WHATSAPP_APP_SECRET || "").trim()) return null
  const sender = digits(String(from || ""))
  if (sender.length < 8) return null
  for (const entry of items(process.env.WHATSAPP_OWNER_NUMBERS)) {
    const [number, userId] = entry.split("=").map(s => s.trim())
    if (digits(number) === sender) return userId || fallbackUserId
  }
  return null
}
