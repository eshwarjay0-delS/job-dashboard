// The MCP tools' backend: thin wrappers over MFit's existing routes, called in-process with the caller's own
// Bearer token, so each route still does its own sign-in check, ownership check and rate limit.
//
// Mistake this prevents: an MCP tool reaching data that is not the caller's, or leaking server internals.
//   - A resume is named by a path RELATIVE to the caller's own Files folder. It is resolved only inside
//     <resumesBase>/<caller.userId>/, must be a .docx, and cannot climb out ("..", absolute paths, NUL, backslashes).
//   - Absolute server paths in route answers are turned back into relative names, and anything outside the
//     caller's folder is dropped rather than shown.
//   - The tailor capability token (it opens the file with no sign-in) is never returned to the AI client.
//   - Only these route calls exist: jobs GET, resumes GET, apply/match POST, tailor POST, apply/activity GET.
//     Nothing here can send, submit, apply, email or post.
//
// Pure module: node:path only, routes injected, so node:test can load it directly.
import path from "node:path"
import { ToolError, type JobInput, type McpBackend, type McpCaller } from "./tools.ts"

type RouteHandler = (request: Request) => Promise<Response>
export type Portal = { firm: string; url: string; hq: string; specialties: string; size: string; notes: string; cyber: boolean; cyberCore: boolean }

export type RouteBackendOptions = {
  /** USER_RESUMES_DIR: each person's Files live at <resumesBase>/<userId>/. */
  resumesBase: string
  /** Builds the in-process request for a wrapped route (a NextRequest in production). */
  makeRequest: (pathAndQuery: string, init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string }) => Request
  routes: { jobs: RouteHandler; resumes: RouteHandler; match: RouteHandler; tailor: RouteHandler; activity: RouteHandler }
  portals: readonly Portal[]
  detectAts: (url: string) => string
  automationPath: (url: string) => string
}

/** The caller's own Files folder. */
const userRoot = (base: string, userId: string) => path.resolve(base, userId)

/** A relative resume name → its absolute path inside the caller's own folder, or null when it is not one. */
export function resolveResumeRef(base: string, userId: string, ref: unknown): string | null {
  if (typeof ref !== "string" || !ref || ref.length > 300 || ref.includes("\0") || ref.includes("\\")) return null
  if (!userId || /[\\/\0]|^\.\.?$/.test(userId)) return null
  if (path.isAbsolute(ref) || ref.split("/").some(part => part === ".." || part === ".")) return null
  if (!ref.toLowerCase().endsWith(".docx")) return null
  const root = userRoot(base, userId)
  const resolved = path.resolve(root, ref)
  return resolved.startsWith(root + path.sep) ? resolved : null
}

/** An absolute path from a route → the caller's relative name for it, or null when it is not in their folder. */
export function resumeRefOf(base: string, userId: string, absolute: unknown): string | null {
  if (typeof absolute !== "string" || !absolute || !userId) return null
  const root = userRoot(base, userId)
  const resolved = path.resolve(absolute)
  if (!resolved.startsWith(root + path.sep)) return null
  return path.relative(root, resolved).split(path.sep).join("/")
}

const cut = (v: unknown, n: number) => String(v ?? "").slice(0, n)
const list = (v: unknown, n: number) => (Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, n) : []) as string[]

/** Route error text with any absolute path removed, so a server path never reaches the AI client. */
function scrub(message: unknown): string {
  return cut(message, 300).replace(/(?:[A-Za-z]:)?[\\/](?:[^\s"'`\\/]+[\\/])+[^\s"'`]*/g, "[file]")
}

export function createRouteBackend(o: RouteBackendOptions): McpBackend {
  async function call(caller: McpCaller, route: RouteHandler, method: "GET" | "POST", pathAndQuery: string, body?: unknown) {
    const headers: Record<string, string> = { authorization: caller.authorization, accept: "application/json", "x-forwarded-for": caller.clientIp }
    if (body !== undefined) headers["content-type"] = "application/json"
    const res = await route(o.makeRequest(pathAndQuery, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }))
    const data = await res.json().catch(() => null) as Record<string, unknown> | null
    if (res.status === 401) throw new ToolError("Your MFit sign-in was not accepted. Sign in again and reconnect.")
    if (res.status === 403 || res.status === 404) throw new ToolError(scrub(data?.error) || "Not found in your MFit Files.")
    if (res.status === 429) throw new ToolError(scrub(data?.error) || "Too many requests. Try again later.")
    if (!res.ok) throw new ToolError(scrub(data?.error) || `MFit could not complete this request (${res.status}).`)
    return data || {}
  }

  function ownResume(caller: McpCaller, ref: string): string {
    const abs = resolveResumeRef(o.resumesBase, caller.userId, ref)
    if (!abs) throw new ToolError("That resume is not in your MFit Files. Use a `resume` value from list_resumes.")
    return abs
  }

  return {
    async searchJobs(caller, input) {
      const q = new URLSearchParams({ q: input.query })
      if (input.location) q.set("location", input.location)
      if (input.remote) q.set("remote", "true")
      if (input.contract) q.set("type", "contract")
      const data = await call(caller, o.routes.jobs, "GET", `/api/jobs?${q}`)
      const jobs = (Array.isArray(data.jobs) ? data.jobs : []) as Record<string, unknown>[]
      const live = data.live === true
      return {
        live,
        sources: list(data.sources, 20),
        ...(live ? {} : { note: "No live source answered; these are MFit's sample listings, not current openings." }),
        ...(typeof data.notice === "string" ? { notice: cut(data.notice, 300) } : {}),
        jobs: jobs.slice(0, input.limit).map(j => ({
          id: cut(j.id, 200), title: cut(j.title, 300), company: cut(j.company, 200), location: cut(j.location, 200),
          remote: j.remote === true, salary: typeof j.salary === "string" ? cut(j.salary, 80) : null, posted: cut(j.posted, 40),
          url: cut(j.url, 2000), source: cut(j.source, 40), work_authorization: list(j.workAuth, 10), contract_types: list(j.contractTypes, 10),
          summary: cut(j.description, 600),
        })),
      }
    },

    async listResumes(caller) {
      const data = await call(caller, o.routes.resumes, "GET", "/api/resumes")
      const files = (Array.isArray(data.files) ? data.files : []) as Record<string, unknown>[]
      const resumes = files.flatMap(f => {
        const ref = resumeRefOf(o.resumesBase, caller.userId, f.filepath)
        return ref ? [{ resume: ref, name: cut(f.filename, 200), folder: cut(f.category, 200), updated_at: cut(f.uploadedAt, 40) }] : []
      })
      return { resumes }
    },

    async matchScore(caller, input) {
      const filepath = ownResume(caller, input.resume)
      const jobs = input.jobs.map((j: JobInput, i) => ({ id: j.id || String(i + 1), title: j.title, description: j.description }))
      const data = await call(caller, o.routes.match, "POST", "/api/apply/match", { filepath, jobs })
      const scores = (Array.isArray(data.scores) ? data.scores : []) as Record<string, unknown>[]
      return {
        resume: input.resume,
        note: "Score = share of the listing's keywords your resume already covers. Keyword overlap, not hiring probability.",
        scores: scores.map(s => ({
          id: cut(s.id, 200), title: cut(jobs.find(j => j.id === s.id)?.title, 300),
          score: typeof s.score === "number" ? s.score : null,
          matched: list(s.matched, 10), missing: list(s.missing, 10), certifications: list(s.certs, 10),
        })),
      }
    },

    async tailorResume(caller, input) {
      const filepath = ownResume(caller, input.resume)
      const data = await call(caller, o.routes.tailor, "POST", "/api/tailor", {
        jd: input.jobDescription, filepath, mode: input.mode,
        save: { role: input.role || "", company: input.company || "" },
      })
      const k = (data.keyword_analysis || {}) as Record<string, unknown>
      const saved = (data.saved || null) as Record<string, unknown> | null
      const savedRef = saved ? resumeRefOf(o.resumesBase, caller.userId, saved.filepath) : null
      const diff = (Array.isArray(data.diff) ? data.diff : []) as Record<string, unknown>[]
      return {
        based_on: input.resume,
        saved: savedRef ? { resume: savedRef, name: cut(saved?.name, 200), folder: cut(saved?.category, 200) } : null,
        ...(savedRef ? {} : { note: "The tailored resume was made but could not be filed in your Files. Open MFit to see it." }),
        unchanged: data.unchanged === true,
        partial: data.partial ? true : false,
        coverage: typeof data.coverage === "number" ? data.coverage : null,
        coverage_before: typeof k.coverage_before === "number" ? k.coverage_before : null,
        coverage_after: typeof k.coverage_after === "number" ? k.coverage_after : null,
        keywords: { already_had: list(k.matched, 40), added: list(k.added, 40), still_missing: list(k.missing, 40) },
        what_changed: list(data.what_changed, 15).map(s => cut(s, 300)),
        changes: diff.slice(0, 20).map(d => ({ section: cut(d.section, 80), before: cut(d.before, 400), after: cut(d.after, 400) })),
      }
    },

    async listApplications(caller, input) {
      const data = await call(caller, o.routes.activity, "GET", "/api/apply/activity")
      const events = (Array.isArray(data.events) ? data.events : []) as Record<string, unknown>[]
      return {
        events: events
          .filter(e => !input.kind || e.kind === input.kind)
          .slice(0, input.limit)
          .map(e => ({
            at: typeof e.at === "number" ? new Date(e.at).toISOString() : null,
            kind: cut(e.kind, 20), title: cut(e.title, 200), company: cut(e.company, 160), location: cut(e.location, 160),
            query: cut(e.query, 200), url: cut(e.url, 2000), resume: cut(e.resume, 200),
          })),
      }
    },

    async getPortals(_caller, input) {
      const firm = input.firm?.toLowerCase()
      const host = (u: string) => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "") } catch { return "" } }
      // A URL with no firm named looks up the firm that owns that portal's host, not the whole directory.
      const urlHost = input.url && !firm ? host(input.url) : ""
      const matches = o.portals
        .filter(p => !firm || p.firm.toLowerCase().includes(firm))
        .filter(p => !urlHost || (p.url !== "" && host(p.url) === urlHost))
        .filter(p => !input.cyberOnly || p.cyber)
      const out: Record<string, unknown> = {
        total: matches.length,
        portals: matches.slice(0, input.limit).map(p => ({
          firm: p.firm, portal_url: p.url || null, verified: Boolean(p.url),
          platform: p.url ? o.detectAts(p.url) : "unknown", automation_path: p.url ? o.automationPath(p.url) : "manual",
          hq: p.hq, specialties: p.specialties, size: p.size, notes: p.notes, cyber: p.cyber,
        })),
      }
      if (input.url) out.url = { url: input.url, platform: o.detectAts(input.url), automation_path: o.automationPath(input.url) }
      return out
    },
  }
}
