// MFit MCP tools (approved idea 19; owner, 23 Oct 2026: "add all").
//
// Mistake this prevents: an AI client acting for one person reaching another person's data, or reaching anything
// that leaves MFit on the person's behalf. Two rules are enforced here, not by convention:
//   1. Identity never comes from tool arguments. Every schema below forbids extra properties, so a `userId` or a
//      file path outside the caller's own folder cannot be passed in; the caller is the verified Bearer identity.
//   2. No tool sends, submits, applies, emails or posts. Every tool is a read, except `tailor_resume`, which writes a
//      new resume into the caller's own Files and nothing else. The backend interface has no method that could send.
//
// Pure module: no Next.js, no `@/` imports, so node:test can load it directly (scripts/tests/mcp-server.test.mjs).

/** The verified caller. Built by the server from the Bearer token, never from a tool argument. */
export type McpCaller = {
  userId: string
  /** The caller's own `Authorization` header, forwarded to the wrapped MFit route. Never returned or logged. */
  authorization: string
  /** The client address, forwarded so a wrapped route's per-IP limit counts this client, not one shared bucket. */
  clientIp: string
}

export type JobInput = { id?: string; title: string; description: string }

/**
 * What the tools may ask of MFit. There is deliberately no send, submit, apply, email or post method here:
 * a tool cannot call what does not exist. `scripts/tests/mcp-server.test.mjs` pins this list.
 */
export interface McpBackend {
  searchJobs(caller: McpCaller, input: { query: string; location?: string; remote?: boolean; contract?: boolean; limit: number }): Promise<unknown>
  listResumes(caller: McpCaller): Promise<unknown>
  matchScore(caller: McpCaller, input: { resume: string; jobs: JobInput[] }): Promise<unknown>
  tailorResume(caller: McpCaller, input: { resume: string; jobDescription: string; role?: string; company?: string; mode: "quick" | "full" }): Promise<unknown>
  listApplications(caller: McpCaller, input: { limit: number; kind?: string }): Promise<unknown>
  getPortals(caller: McpCaller, input: { firm?: string; url?: string; cyberOnly?: boolean; limit: number }): Promise<unknown>
}

export const BACKEND_METHODS = ["searchJobs", "listResumes", "matchScore", "tailorResume", "listApplications", "getPortals"] as const

/** A failure the model should see and can correct (bad input, missing resume, sign-in expired). */
export class ToolError extends Error {}

// ── A small JSON Schema subset, validated here so no schema package is needed ─────────────────────────────────

type Schema =
  | { type: "string"; description?: string; minLength?: number; maxLength?: number; enum?: string[] }
  | { type: "boolean"; description?: string }
  | { type: "integer"; description?: string; minimum: number; maximum: number }
  | { type: "array"; description?: string; minItems?: number; maxItems: number; items: ObjectSchema }
  | ObjectSchema
type ObjectSchema = { type: "object"; description?: string; properties: Record<string, Schema>; required?: string[]; additionalProperties: false }

function check(schema: Schema, value: unknown, at: string): string | null {
  switch (schema.type) {
    case "string":
      if (typeof value !== "string") return `${at} must be text`
      if (schema.minLength !== undefined && value.trim().length < schema.minLength) return `${at} is too short`
      if (schema.maxLength !== undefined && value.length > schema.maxLength) return `${at} is longer than ${schema.maxLength} characters`
      if (schema.enum && !schema.enum.includes(value)) return `${at} must be one of: ${schema.enum.join(", ")}`
      return null
    case "boolean":
      return typeof value === "boolean" ? null : `${at} must be true or false`
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) return `${at} must be a whole number`
      return value < schema.minimum || value > schema.maximum ? `${at} must be between ${schema.minimum} and ${schema.maximum}` : null
    case "array":
      if (!Array.isArray(value)) return `${at} must be a list`
      if (schema.minItems !== undefined && value.length < schema.minItems) return `${at} needs at least ${schema.minItems} item(s)`
      if (value.length > schema.maxItems) return `${at} takes at most ${schema.maxItems} items`
      for (let i = 0; i < value.length; i++) { const e = check(schema.items, value[i], `${at}[${i}]`); if (e) return e }
      return null
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return `${at} must be an object`
      const record = value as Record<string, unknown>
      for (const key of Object.keys(record)) {
        if (!Object.hasOwn(schema.properties, key)) return `${at === "arguments" ? "" : at + "."}${key} is not an accepted field`
      }
      for (const key of schema.required || []) if (record[key] === undefined) return `${at === "arguments" ? "" : at + "."}${key} is required`
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (record[key] === undefined) continue
        const e = check(sub, record[key], at === "arguments" ? key : `${at}.${key}`)
        if (e) return e
      }
      return null
    }
  }
}

/** Null when `args` satisfies `schema`; otherwise a sentence the model can act on. */
export function validateArguments(schema: ObjectSchema, args: unknown): string | null {
  return check(schema, args ?? {}, "arguments")
}

// ── Tool definitions ───────────────────────────────────────────────────────────────────────────────────────────

type Annotations = { title: string; readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }
type ToolDef = {
  name: string
  description: string
  inputSchema: ObjectSchema
  annotations: Annotations
  run: (backend: McpBackend, caller: McpCaller, args: Record<string, unknown>) => Promise<unknown>
}

const RESUME_REF: Schema = {
  type: "string", minLength: 1, maxLength: 300,
  description: "A resume from list_resumes, as its `resume` value (a path inside your own MFit Files, such as \"Cyber/My Resume.docx\").",
}
const read = (title: string, openWorld = false): Annotations => ({ title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: openWorld })
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)

const TOOLS: ToolDef[] = [
  {
    name: "search_jobs",
    description: "Search live job listings across MFit's aggregated sources (JSearch for LinkedIn/Indeed/Glassdoor, Jobright, Greenhouse, Ashby, RemoteOK, Remotive, Arbeitnow, Infosecjobs, USAJobs). Read only. When no live source answers, the result says it is sample data.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["query"],
      properties: {
        query: { type: "string", minLength: 1, maxLength: 200, description: "Role or keywords, e.g. \"application security engineer\"." },
        location: { type: "string", maxLength: 100, description: "City, state or \"Remote\"." },
        remote: { type: "boolean", description: "Only remote roles." },
        contract: { type: "boolean", description: "Only contract roles (W2, C2C, contractor)." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "How many to return (default 20)." },
      },
    },
    annotations: read("Search jobs", true),
    run: (b, c, a) => b.searchJobs(c, {
      query: String(a.query).trim(), location: str(a.location),
      remote: a.remote === true || undefined, contract: a.contract === true || undefined,
      limit: typeof a.limit === "number" ? a.limit : 20,
    }),
  },
  {
    name: "list_resumes",
    description: "List the resumes in your own MFit Files. Use a returned `resume` value with get_match_score or tailor_resume. Read only.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: read("List my resumes"),
    run: (b, c) => b.listResumes(c),
  },
  {
    name: "get_match_score",
    description: "Score one of your resumes against up to 20 job descriptions: the percentage of the listing's keywords your resume already covers, with matched and missing keywords. This is keyword overlap, never a hiring probability. Read only.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["resume", "jobs"],
      properties: {
        resume: RESUME_REF,
        jobs: {
          type: "array", minItems: 1, maxItems: 20, description: "The jobs to score against.",
          items: {
            type: "object", additionalProperties: false, required: ["title", "description"],
            properties: {
              id: { type: "string", maxLength: 200, description: "Your own label for the job, echoed back." },
              title: { type: "string", minLength: 1, maxLength: 300 },
              description: { type: "string", minLength: 1, maxLength: 20000, description: "The job description text." },
            },
          },
        },
      },
    },
    annotations: read("Get match score"),
    run: (b, c, a) => b.matchScore(c, {
      resume: String(a.resume),
      jobs: (a.jobs as JobInput[]).map((j, i) => ({ id: str(j.id) || String(i + 1), title: j.title, description: j.description })),
    }),
  },
  {
    name: "tailor_resume",
    description: "Tailor one of your resumes to a job description. MFit writes the tailored resume as a new Word file in your own Files (filed by role and company) and reports keyword coverage before and after, and what changed. It never sends, uploads or applies anywhere. Each new tailored resume uses MFit points as it does on the website.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["resume", "job_description"],
      properties: {
        resume: RESUME_REF,
        job_description: { type: "string", minLength: 50, maxLength: 30000, description: "The full job description." },
        role: { type: "string", maxLength: 120, description: "Job title, used to name and file the new resume." },
        company: { type: "string", maxLength: 80, description: "Company, used to name and file the new resume." },
        mode: { type: "string", enum: ["quick", "full"], description: "\"full\" (default) or \"quick\"." },
      },
    },
    annotations: { title: "Tailor my resume", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: (b, c, a) => b.tailorResume(c, {
      resume: String(a.resume), jobDescription: String(a.job_description).trim(),
      role: str(a.role), company: str(a.company), mode: a.mode === "quick" ? "quick" : "full",
    }),
  },
  {
    name: "list_applications",
    description: "Your application pipeline in MFit, newest first: searches, viewed and saved jobs, portals opened, tailored resumes and applications you recorded as submitted. Read only.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, description: "How many events (default 25)." },
        kind: { type: "string", enum: ["search", "view", "save", "open_portal", "submitted", "tailor"], description: "Only this kind of event." },
      },
    },
    annotations: read("List my applications"),
    run: (b, c, a) => b.listApplications(c, { limit: typeof a.limit === "number" ? a.limit : 25, kind: str(a.kind) }),
  },
  {
    name: "get_portal",
    description: "Look up staffing-firm job portals from MFit's directory: portal URL, the applicant-tracking platform it runs on and how MFit classifies it (ats-direct, portal-custom or manual). Filter by firm name, or pass a job or portal URL to identify its platform. Read only.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        firm: { type: "string", maxLength: 120, description: "Part of a firm's name, e.g. \"TEK\"." },
        url: { type: "string", maxLength: 2000, description: "A job or portal URL to classify." },
        cyber_only: { type: "boolean", description: "Only firms that place cybersecurity roles." },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "How many firms (default 25)." },
      },
    },
    annotations: read("Get job portal"),
    run: (b, c, a) => b.getPortals(c, { firm: str(a.firm), url: str(a.url), cyberOnly: a.cyber_only === true || undefined, limit: typeof a.limit === "number" ? a.limit : 25 }),
  },
]

export const TOOL_NAMES = TOOLS.map(t => t.name)

/** The `tools/list` payload. */
export function listTools() {
  return TOOLS.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations }))
}

export type ToolCallResult = { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean }

const errorResult = (message: string): ToolCallResult => ({ content: [{ type: "text", text: message }], isError: true })

/**
 * Run one tool for the verified caller. Null when no tool has that name (the server answers that as a protocol
 * error). Bad input and expected failures come back as `isError` results the model can read and correct.
 */
export async function callTool(name: string, args: unknown, caller: McpCaller, backend: McpBackend): Promise<ToolCallResult | null> {
  const tool = TOOLS.find(t => t.name === name)
  if (!tool) return null
  const invalid = validateArguments(tool.inputSchema, args)
  if (invalid) return errorResult(`Invalid arguments: ${invalid}.`)
  try {
    const out = await tool.run(backend, caller, (args ?? {}) as Record<string, unknown>)
    const structured = out && typeof out === "object" && !Array.isArray(out) ? out as Record<string, unknown> : { result: out }
    return { content: [{ type: "text", text: JSON.stringify(structured) }], structuredContent: structured }
  } catch (e) {
    if (e instanceof ToolError) return errorResult(e.message)
    return errorResult("MFit could not complete this request. Try again shortly.")
  }
}
