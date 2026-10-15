// What the setup conversation has been told so far, kept on the server per person, and the facts it is asked against.
// The rules are in onboarding.ts. Nothing here is put in the sign-in cookie.
import { createClient } from "@/lib/supabase/server"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { blob } from "@/lib/storage"
import { isAdminEmail } from "@/lib/owner"
import { waDisplayNumber } from "@/lib/whatsapp"
import { phoneStepAvailable } from "@/lib/identityStatus"
import { nextStep, validSetup, type Facts, type Setup, type Step } from "@/lib/onboarding"

const keyOf = (userId: string): string => `onboarding/${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`
/** Words kept from the resume for the person's dossier. Not part of the conversation, so they sit beside it. */
export type Kept = { skills: string[]; keywords: string[] }
const wordsKey = (userId: string): string => `onboarding/${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.words.json`

export async function readSetup(userId: string): Promise<Setup> {
  try { const raw = await blob.getText(keyOf(userId)); return raw ? validSetup(JSON.parse(raw)) : {} } catch { return {} }
}
export async function writeSetup(userId: string, setup: Setup): Promise<void> {
  await blob.put(keyOf(userId), JSON.stringify(validSetup(setup)))
}
export async function readWords(userId: string): Promise<Kept> {
  try {
    const raw = JSON.parse((await blob.getText(wordsKey(userId))) || "{}") as Partial<Kept>
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((w): w is string => typeof w === "string" && !!w.trim()).slice(0, 200) : [])
    return { skills: list(raw.skills), keywords: list(raw.keywords) }
  } catch { return { skills: [], keywords: [] } }
}
export async function writeWords(userId: string, words: Kept): Promise<void> {
  await blob.put(wordsKey(userId), JSON.stringify({ skills: words.skills.slice(0, 200), keywords: words.keywords.slice(0, 200) }))
}

export type ProfileRow = { full_name: string | null; title: string | null; location: string | null; linkedin: string | null; phone_verified: boolean | null; open_to_roles: string[] | null; profile_complete: boolean | null }
export type Loaded = {
  user: { id: string; email: string | null; name: string }
  supabase: Awaited<ReturnType<typeof createClient>>
  profile: ProfileRow | null
  setup: Setup
  facts: Facts
  /** Phone availability or exemption: "admin", "unavailable" (a code cannot be sent right now), or "". */
  whatsappNumber: string
  phoneNote: string
  step: Step
}

/** Everything a step of the conversation is decided from, or null when nobody is signed in. */
export async function loadSetup(): Promise<Loaded | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const [{ data: profile }, setup] = await Promise.all([
    supabase.from("profiles").select("full_name,title,location,linkedin,phone_verified,open_to_roles,profile_complete").eq("id", user.id).maybeSingle(),
    readSetup(user.id),
  ])
  const row = (profile || null) as ProfileRow | null
  const admin = !!user.email_confirmed_at && isAdminEmail(user.email)
  // Availability changes the explanation, never the verification requirement.
  const available = row?.phone_verified || admin ? true : await phoneStepAvailable()
  let inboxes = 0
  if (serviceClientAvailable()) {
    try {
      const { data } = await createServiceClient().rpc("identity_list_google_workspace_accounts", { p_user_id: user.id })
      inboxes = Array.isArray(data) ? data.length : 0
    } catch { /* the count is a convenience: the step can still be passed */ }
  }
  const facts: Facts = { phoneVerified: !!row?.phone_verified, phoneRequired: !admin, inboxes, complete: row?.profile_complete === true }
  const meta = (user.user_metadata || {}) as { full_name?: string; name?: string }
  return {
    user: { id: user.id, email: user.email ?? null, name: String(meta.full_name || meta.name || "").trim() },
    whatsappNumber: row?.phone_verified ? await waDisplayNumber().catch(() => "") : "",
    supabase, profile: row, setup, facts, phoneNote: admin ? "admin" : available ? "" : "unavailable", step: nextStep(setup, facts),
  }
}
