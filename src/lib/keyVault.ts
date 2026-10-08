/**
 * The API keys the admin keeps from the Admin page, and which features may use each provider's key.
 *
 * The owner, 2026-10-07: "give me placeholder to update any API-key I want. And also select and edit checklist which apps or
 * features can use that API right there."
 *
 * What it prevents: a key that can only be changed by opening the hosting project and redeploying, and a key that every
 * feature may spend from because nothing says otherwise.
 *
 *   A KEY stored here replaces the one in the deployment's settings for that provider, on every server instance within
 *   half a minute and with no redeploy. Removing it puts the deployment's own key back in use.
 *
 *   The CHECKLIST says which features may use a provider's key, wherever that key is kept. A feature that is not ticked is
 *   served by the other providers, exactly as if this one had no key. A person's own key (from their Settings) is theirs and
 *   is never touched by any of this.
 *
 * How a key is kept: sealed with AES-256-GCM before it reaches storage, under a key derived from a secret that only the
 * deployment holds (KEY_VAULT_SECRET when set, otherwise the storage account's own secret). The provider's name is bound into
 * the seal, so a sealed key cannot be moved under another provider. A key is never sent back to a browser: the page is told
 * where a key is kept, its last four characters when it is kept here, and when it was stored. With no secret to seal with,
 * nothing is stored and the page says so.
 *
 * Reading never throws. If storage cannot be read, the last keys known to this server instance stay in use, and before any
 * were known, the deployment's own.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"

export const VAULT_PROVIDERS = ["openai", "groq", "openrouter", "anthropic", "gemini"] as const
export type VaultProvider = (typeof VAULT_PROVIDERS)[number]
export const PROVIDER_NAME: Record<VaultProvider, string> = { openai: "OpenAI", groq: "Groq", openrouter: "OpenRouter", anthropic: "Anthropic", gemini: "Gemini" }

/**
 * The checklist. An id is the label a call carries (`purpose` in callLLM); a Kompas feature is prefixed with its app.
 * `elsewhere` marks a feature that runs on the Kompas deployment, not on this one: ticking it would hand the key stored here
 * across to that deployment, which otherwise uses its own. No such feature is listed until the handing-over exists: a tick
 * that does nothing is not offered.
 */
export type Feature = { id: string; app: "marketfit" | "kompas"; label: string; elsewhere?: true }
export const FEATURES: Feature[] = [
  { id: "resume-tailor", app: "marketfit", label: "Writing a resume for a job" },
  { id: "resume-change", app: "marketfit", label: "Changes asked for after a resume is written" },
  { id: "resume-keywords", app: "marketfit", label: "Finding the keywords in a job post" },
  { id: "resume-coverage", app: "marketfit", label: "Checking how well a resume covers a job" },
  { id: "job-details", app: "marketfit", label: "Reading the role and company from a job post" },
  { id: "field-edit", app: "marketfit", label: "Rewriting one field" },
  { id: "interview-prep", app: "marketfit", label: "Interview practice" },
  { id: "other", app: "marketfit", label: "Everything else (cover letters, scores, chat)" },
  { id: "kompas:flow", app: "kompas", label: "Flow: speaking to write" },
  { id: "kompas:transcribe", app: "kompas", label: "Transcribe: a talk or a recording into text" },
]
const FEATURE_IDS = new Set(FEATURES.map(f => f.id))

/**
 * What a provider's key may be used for until the admin says otherwise.
 *
 * OpenAI: the resume tailor only, which is what the owner asked for when the key was added ("for Resume tailoring only for
 * now", 2026-10-05). Every other provider: everything that runs on this deployment, as before this file existed, Kompas Flow
 * and Transcribe included. Nothing is handed to the Kompas deployment until it is ticked: it has keys of its own.
 */
export const OPENAI_DEFAULT = ["resume-tailor", "resume-change", "resume-keywords"]
export function defaultUse(provider: VaultProvider): string[] {
  return provider === "openai" ? [...OPENAI_DEFAULT] : FEATURES.filter(f => !f.elsewhere).map(f => f.id)
}

type StoredKey = { sealed: string; last4: string; setAt: string }
export type VaultDoc = { v: 1; keys: Partial<Record<VaultProvider, StoredKey>>; use: Partial<Record<VaultProvider, string[]>>; updatedAt: string }
const EMPTY: VaultDoc = { v: 1, keys: {}, use: {}, updatedAt: "" }
const PATH = "admin/key-vault.json"
const TTL_MS = 30_000

// ─────────────────────────────────────────── sealing ────────────────────────────────────────────

/** The 32 bytes keys are sealed under, or null when this deployment holds nothing to derive them from. */
export function vaultSecret(env: Record<string, string | undefined> = process.env): Buffer | null {
  const own = (env.KEY_VAULT_SECRET || "").trim()
  const from = own.length >= 32 ? own : (env.R2_SECRET_ACCESS_KEY || "").trim()
  if (from.length < 16) return null
  return Buffer.from(hkdfSync("sha256", from, "marketfit-key-vault-v1", "api-keys", 32))
}

export function sealKey(provider: VaultProvider, plain: string, secret: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", secret, iv)
  cipher.setAAD(Buffer.from(provider))
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [iv, body, cipher.getAuthTag()].map(b => b.toString("base64url")).join(".")
}

/** The key back, or null when the seal does not open: another secret, another provider, or a changed byte. */
export function openKey(provider: VaultProvider, sealed: string, secret: Buffer): string | null {
  try {
    const [iv, body, tag] = String(sealed).split(".").map(part => Buffer.from(part, "base64url"))
    if (!iv || !body || !tag || iv.length !== 12 || tag.length !== 16) return null
    const decipher = createDecipheriv("aes-256-gcm", secret, iv)
    decipher.setAAD(Buffer.from(provider))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")
  } catch { return null }
}

// ─────────────────────────────────────────── what may be saved ────────────────────────────────────────────

const PREFIX: Record<VaultProvider, RegExp | null> = { openai: /^sk-(?!ant-|or-)/, groq: /^gsk_/, openrouter: /^sk-or-/, anthropic: /^sk-ant-/, gemini: null }

/** A pasted key, trimmed and checked. The reason for a refusal names the problem and never repeats the key. */
export function cleanKey(provider: VaultProvider, raw: unknown): { ok: true; key: string } | { ok: false; why: string } {
  const key = typeof raw === "string" ? raw.trim() : ""
  if (key.length < 20 || key.length > 400) return { ok: false, why: "That does not look like a whole key: it is too short or too long." }
  if (/[^\x21-\x7e]/.test(key)) return { ok: false, why: "A key has no spaces, line breaks or unusual characters. Paste it again, alone." }
  // A key from another provider saved here would fail every call with a rejected-key error that names the wrong provider.
  const other = VAULT_PROVIDERS.find(p => p !== provider && PREFIX[p] && PREFIX[p]!.test(key))
  if (other && !(PREFIX[provider] && PREFIX[provider]!.test(key))) return { ok: false, why: `That looks like a ${PROVIDER_NAME[other]} key, not a ${PROVIDER_NAME[provider]} key.` }
  return { ok: true, key }
}

/** A checklist as sent by the page: known features only, each once, in the catalogue's order. */
export function cleanUse(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const asked = new Set(raw.filter((v): v is string => typeof v === "string" && FEATURE_IDS.has(v)))
  return FEATURES.map(f => f.id).filter(id => asked.has(id))
}

export const isVaultProvider = (v: unknown): v is VaultProvider => typeof v === "string" && (VAULT_PROVIDERS as readonly string[]).includes(v)

// ─────────────────────────────────────────── what this server instance knows ────────────────────────────────────────────

let doc: VaultDoc = EMPTY
let plain: Partial<Record<VaultProvider, string>> = {}
let readAt = 0
let reading: Promise<boolean> | null = null
// Does this instance hold a checklist it can trust: one read from storage, or none because there is no storage here at all?
// False from a cold start until the first read answers, and for as long as storage keeps failing (review, 2026-10-08).
let known = false
const RETRY_MS = 3000

// Loaded when the vault is read or written, not when this file is: the rules above are plain code (the tests load them bare).
const storage = () => import("./storage").then(m => m.blob)

function take(next: VaultDoc): void {
  const secret = vaultSecret()
  const opened: Partial<Record<VaultProvider, string>> = {}
  if (secret) for (const p of VAULT_PROVIDERS) { const k = next.keys[p]; const v = k ? openKey(p, k.sealed, secret) : null; if (v) opened[p] = v }
  doc = next; plain = opened
}

function readDoc(text: string | null): VaultDoc {
  if (!text) return EMPTY
  const raw = JSON.parse(text) as Partial<VaultDoc>
  const out: VaultDoc = { v: 1, keys: {}, use: {}, updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "" }
  for (const p of VAULT_PROVIDERS) {
    const k = raw.keys?.[p]
    if (k && typeof k.sealed === "string" && typeof k.last4 === "string" && typeof k.setAt === "string") out.keys[p] = { sealed: k.sealed, last4: k.last4.slice(-4), setAt: k.setAt }
    const use = cleanUse(raw.use?.[p])
    if (use) out.use[p] = use
  }
  return out
}

/**
 * Bring this instance up to date with storage, at most once in half a minute. Never throws. Answers whether the vault is
 * known: a failed read is tried again after three seconds, not after thirty, and until one succeeds `allows()` holds the
 * providers that cost money back, because this instance cannot know what the admin unticked.
 */
export async function loadVault(force = false): Promise<boolean> {
  if (!force && Date.now() - readAt < TTL_MS) return known
  reading ??= (async () => {
    let ok = false
    try {
      // A build with no storage module at all (a test, a script) has no vault to read. That is known, not unknown.
      const blob = await storage().catch(() => null)
      if (blob) take(readDoc(await blob.getText(PATH)))
      ok = true
    } catch (e) {
      // A deployment with no storage configured has no vault either. Any other failure leaves what is known as it was.
      ok = /not configured/i.test(String((e as Error)?.message || e))
    } finally {
      if (ok) known = true
      readAt = ok ? Date.now() : Date.now() - TTL_MS + RETRY_MS
      reading = null
    }
    return ok
  })()
  return reading
}

/**
 * For a call about to be made. Once the vault is known it is refreshed behind the call and never waited for, so a slow or
 * stalled storage account cannot hold up an answer whose keys are already in memory. Only an instance that has read nothing
 * yet waits, and for no longer than `waitMs`.
 */
export async function readyVault(waitMs = 1500): Promise<void> {
  if (known) { void loadVault(); return }
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([loadVault(), new Promise<void>(resolve => { timer = setTimeout(resolve, waitMs); (timer as { unref?: () => void }).unref?.() })])
  if (timer) clearTimeout(timer)
}

const HELD_BACK_UNREAD: ReadonlySet<VaultProvider> = new Set<VaultProvider>(["openai", "anthropic", "openrouter"])

/** The key the admin stored for this provider, when this instance has read it. */
export function vaultKey(provider: VaultProvider): string | undefined { return plain[provider] }

/** May this provider's key be used for this feature? The health check may always look at every key. */
export function allows(provider: VaultProvider, feature: string): boolean {
  if (feature === "status-check") return true
  // Fail closed where it costs money: an instance that has not managed to read the checklist does not spend a paid key on
  // the strength of the defaults. The free providers go on serving, so a storage fault does not stop the product.
  if (!known && HELD_BACK_UNREAD.has(provider)) return false
  return (doc.use[provider] ?? defaultUse(provider)).includes(FEATURE_IDS.has(feature) ? feature : "other")
}
/** Did the admin tick this feature for this provider, as opposed to it being allowed by default? */
export function ticked(provider: VaultProvider, feature: string): boolean {
  return !!doc.use[provider] && doc.use[provider]!.includes(feature)
}

// ─────────────────────────────────────────── the admin's changes ────────────────────────────────────────────

export type VaultChange = { provider: VaultProvider; key?: string; remove?: boolean; use?: string[] }

/** Apply one change to a document. Pure: the secret and the time are handed in. */
export function changed(before: VaultDoc, change: VaultChange, secret: Buffer | null, now: number): VaultDoc {
  const next: VaultDoc = { v: 1, keys: { ...before.keys }, use: { ...before.use }, updatedAt: new Date(now).toISOString() }
  if (change.remove) delete next.keys[change.provider]
  if (change.key !== undefined) {
    if (!secret) throw new Error("no-secret")
    next.keys[change.provider] = { sealed: sealKey(change.provider, change.key, secret), last4: change.key.slice(-4), setAt: new Date(now).toISOString() }
  }
  if (change.use) next.use[change.provider] = change.use
  return next
}

// Saves on one instance go one at a time: each reads the document, changes one provider and writes it back, and two that
// overlapped would lose one change while both answered "saved". (Two instances can still overlap; the page also takes one
// save at a time, and the answer to every save is the document as stored, so a lost change shows at once.)
let saving: Promise<unknown> = Promise.resolve()

/** Save one change and take it into use on this instance at once. Other instances follow within half a minute. */
export function saveVault(change: VaultChange): Promise<void> {
  const run = saving.then(async () => {
    const blob = await storage()
    const before = readDoc(await blob.getText(PATH))
    const next = changed(before, change, vaultSecret(), Date.now())
    await blob.put(PATH, JSON.stringify(next))
    take(next); known = true; readAt = Date.now()
  })
  saving = run.catch(() => {})
  return run
}

/** Which secret keys are sealed under, so the page can say: the deployment's own, the storage account's, or none. */
export function sealedWith(env: Record<string, string | undefined> = process.env): "own" | "storage" | "none" {
  if ((env.KEY_VAULT_SECRET || "").trim().length >= 32) return "own"
  return (env.R2_SECRET_ACCESS_KEY || "").trim().length >= 16 ? "storage" : "none"
}

export type VaultRow = {
  provider: VaultProvider
  name: string
  /** Where the key in use is kept: stored from the Admin page, in the deployment's settings, or nowhere. */
  kept: "here" | "deployment" | "none"
  /** Stored here but the seal does not open with this deployment's secret: it has to be entered again. */
  unreadable: boolean
  last4: string | null
  setAt: string | null
  /** The deployment has a key of its own for this provider, which comes back into use if the stored one is removed. */
  deploymentHasKey: boolean
  use: string[]
  usingDefault: boolean
}

/** What the page shows. `deploymentHas` says whether the deployment's settings hold a key: this file does not read them. */
export function vaultRows(deploymentHas: (p: VaultProvider) => boolean): VaultRow[] {
  return VAULT_PROVIDERS.map(p => {
    const stored = doc.keys[p], readable = !!plain[p]
    return {
      provider: p, name: PROVIDER_NAME[p],
      kept: stored && readable ? "here" : deploymentHas(p) ? "deployment" : "none",
      unreadable: !!stored && !readable,
      last4: stored && readable ? stored.last4 : null,
      setAt: stored ? stored.setAt : null,
      deploymentHasKey: deploymentHas(p),
      use: doc.use[p] ?? defaultUse(p),
      usingDefault: !doc.use[p],
    }
  })
}

/** For tests: put a document in use as if it had been read from storage. */
export function useVaultDoc(next: VaultDoc | null, env: Record<string, string | undefined> = process.env): void {
  const secret = vaultSecret(env)
  const opened: Partial<Record<VaultProvider, string>> = {}
  const d = next ?? EMPTY
  if (secret) for (const p of VAULT_PROVIDERS) { const k = d.keys[p]; const v = k ? openKey(p, k.sealed, secret) : null; if (v) opened[p] = v }
  doc = d; plain = opened; readAt = Date.now(); known = true
}
/** For tests: an instance that has read nothing and whose storage is failing. */
export function forgetVault(): void { doc = EMPTY; plain = {}; known = false; readAt = Date.now() }
