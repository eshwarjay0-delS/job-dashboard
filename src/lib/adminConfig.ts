import { readFile, writeFile, mkdir } from "fs/promises"
import { createHmac, timingSafeEqual, randomBytes } from "crypto"
import path from "path"

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PostLink { id: string; url: string; label: string; date: string; enabled: boolean }
export interface JobSourceCfg { id: string; label: string; enabled: boolean; note?: string }

export interface AdminConfig {
  postLinks: PostLink[]      // LinkedIn/recruiter post links → feed the Contract board's Posts tab
  jobSources: JobSourceCfg[] // toggle which job APIs the boards query
  updatedAt: string
}

const DIR = path.join(process.cwd(), "data")
const FILE = path.join(DIR, "admin-config.json")

const DEFAULTS: AdminConfig = {
  postLinks: [],
  jobSources: [
    { id: "jsearch", label: "JSearch — LinkedIn / Indeed / Glassdoor", enabled: true, note: "Needs RAPID_API_KEY" },
    { id: "adzuna", label: "Adzuna", enabled: true, note: "Needs ADZUNA_APP_ID + ADZUNA_APP_KEY" },
    { id: "usajobs", label: "USAJobs (federal)", enabled: true, note: "Needs USAJOBS_API_KEY" },
    { id: "themuse", label: "The Muse", enabled: true },
    { id: "sample", label: "Sample fallback (when no keys)", enabled: true },
  ],
  updatedAt: "",
}

// ── Config store (JSON file; no secrets ever written here) ──────────────────────
export async function readAdminConfig(): Promise<AdminConfig> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8"))
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function writeAdminConfig(patch: Partial<AdminConfig>): Promise<AdminConfig> {
  const current = await readAdminConfig()
  const next: AdminConfig = { ...current, ...patch, updatedAt: new Date().toISOString() }
  await mkdir(DIR, { recursive: true }).catch(() => {})
  await writeFile(FILE, JSON.stringify(next, null, 2), "utf8")
  return next
}

// ── API-key presence (NEVER returns values — booleans only) ─────────────────────
export const KNOWN_KEYS: { id: string; label: string }[] = [
  { id: "RAPID_API_KEY", label: "RapidAPI / JSearch — primary job source" },
  { id: "ADZUNA_APP_ID", label: "Adzuna App ID" },
  { id: "ADZUNA_APP_KEY", label: "Adzuna App Key" },
  { id: "USAJOBS_API_KEY", label: "USAJobs" },
  { id: "THE_MUSE_API_KEY", label: "The Muse" },
  { id: "ANTHROPIC_API_KEY", label: "Anthropic — résumé tailoring" },
  { id: "OPENROUTER_API_KEY", label: "OpenRouter — cover letters / Nexus" },
  { id: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL" },
  { id: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase service role key" },
]

export function apiKeyStatus(): { id: string; label: string; set: boolean }[] {
  return KNOWN_KEYS.map(k => ({ ...k, set: !!process.env[k.id] }))
}

// ── Admin session token (httpOnly cookie value) ─────────────────────────────────
// Requires ADMIN_SESSION_SECRET or ADMIN_PASSWORD env var — see .env.local for local dev.
const SECRET = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ""

export function makeAdminToken(): string {
  // If no secret is configured, return a random token that can never be guessed
  // or reproduced — effectively disabling persistent admin sessions until env is set.
  if (!SECRET) return randomBytes(32).toString("hex")
  return createHmac("sha256", SECRET).update("mf-admin-v1").digest("hex")
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token || !SECRET) return false
  const expected = makeAdminToken()
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
