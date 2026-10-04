export { makeAdminToken, verifyAdminToken } from "./adminSession"
import { blob } from "@/lib/storage"

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PostLink { id: string; url: string; label: string; date: string; enabled: boolean }
export interface JobSourceCfg { id: string; label: string; enabled: boolean; note?: string }

export interface AdminConfig {
  postLinks: PostLink[]      // LinkedIn/recruiter post links → feed the Contract board's Posts tab
  jobSources: JobSourceCfg[] // toggle which job APIs the boards query
  updatedAt: string
}

const KEY = "admin-config.json"

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
    const raw = await blob.getText(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function writeAdminConfig(patch: Partial<AdminConfig>): Promise<AdminConfig> {
  const current = await readAdminConfig()
  const next: AdminConfig = { ...current, ...patch, updatedAt: new Date().toISOString() }
  await blob.put(KEY, JSON.stringify(next, null, 2))
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
