// MFit MCP server core: Streamable HTTP transport, stateless, JSON responses (no SSE stream, no session id).
//
// Mistake this prevents: an unreviewed surface going live, or answering anyone who is not a signed-in MFit user.
// The order of refusals is fixed and tested (scripts/tests/mcp-server.test.mjs):
//   switched off            → 404, for every method, before anything else is read (MCP_ENABLED=1 turns it on)
//   foreign Origin          → 403 (DNS-rebinding and browser cross-site protection, as the MCP spec requires)
//   GET / DELETE / others   → 405 (no server-initiated stream, no sessions)
//   cookies, no Bearer,
//   or a token that is not
//   a live, short-lived
//   Supabase user token     → 401, before the body is parsed
// Only then is JSON-RPC read. Tokens are never logged and never put in a URL or a tool result.
//
// Pure module: no Next.js, no `@/` imports, so node:test can load it directly.
import { callTool, listTools, type McpBackend, type McpCaller } from "./tools.ts"

/** Newest first. A client asking for one of these gets it back; anything else gets the newest. */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"]
export const MAX_BODY_BYTES = 256 * 1024
/** Longest access-token lifetime accepted. Supabase's default is 3600 s; a long-lived token is refused. */
export const MAX_TOKEN_LIFETIME_SEC = 24 * 60 * 60
export const SERVER_INFO = { name: "mfit", title: "MFit", version: "0.1.0" }
const INSTRUCTIONS = "MFit tools act only on your own MFit account. They search jobs, list your resumes and applications, score matches, look up staffing portals and tailor a resume into your own Files. None of them sends, submits, applies, emails or posts anything."

type RateLimit = (key: string, opts: { max: number; windowMs: number }) => { ok: boolean; retryAfterSec?: number }

export type McpDeps = {
  /** Process environment. `MCP_ENABLED` must be exactly "1" for the endpoint to exist. */
  env: Record<string, string | undefined>
  /** Verifies the request's Bearer token with Supabase (the same check every other MFit route uses). */
  verify: (request: Request) => Promise<{ id: string } | null>
  backend: McpBackend
  rateLimit?: RateLimit
  now?: () => number
}

export const mcpEnabled = (env: Record<string, string | undefined>) => env.MCP_ENABLED === "1"

const NO_STORE = { "Cache-Control": "no-store" }
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...NO_STORE, ...headers } })

function unauthorized(message: string, tokenGiven: boolean) {
  // No resource_metadata yet: there is no MFit authorization server to point at (docs/mcp-surface.md, "What remains").
  const challenge = tokenGiven ? 'Bearer realm="mfit-mcp", error="invalid_token"' : 'Bearer realm="mfit-mcp"'
  return json({ error: message }, 401, { "WWW-Authenticate": challenge })
}

/**
 * Claims of a Supabase access token, checked before Supabase is asked: a user token (role "authenticated", a
 * subject, not anonymous) that has not expired and does not live longer than MAX_TOKEN_LIFETIME_SEC. This is a
 * pre-filter only; the signature is verified by Supabase in `deps.verify`. A refresh token or the service key fails.
 */
export function bearerClaimsOk(token: string, nowMs: number): boolean {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"))
    if (!payload || typeof payload !== "object") return false
    if (typeof payload.sub !== "string" || !payload.sub) return false
    if (payload.role !== "authenticated" || payload.is_anonymous === true) return false
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= nowMs) return false
    if (typeof payload.iat === "number" && payload.exp - payload.iat > MAX_TOKEN_LIFETIME_SEC) return false
    if (typeof payload.iat !== "number" && payload.exp * 1000 - nowMs > MAX_TOKEN_LIFETIME_SEC * 1000) return false
    return true
  } catch { return false }
}

function allowedOrigin(request: Request, env: Record<string, string | undefined>): boolean {
  const origin = request.headers.get("origin")
  if (origin === null) return true // desktop and server-side MCP clients send none
  const own = new URL(request.url).origin
  const extra = (env.MCP_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean)
  return origin === own || extra.includes(origin)
}

type JsonRpcId = string | number | null
type RpcMessage = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown; result?: unknown; error?: unknown }
const rpcError = (id: JsonRpcId, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } })
const rpcResult = (id: JsonRpcId, result: unknown) => ({ jsonrpc: "2.0", id, result })
const validId = (id: unknown): id is string | number => typeof id === "string" || (typeof id === "number" && Number.isFinite(id))

async function handleMessage(msg: RpcMessage, caller: McpCaller, backend: McpBackend): Promise<object | null> {
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0") return rpcError(null, -32600, "Invalid Request")
  const isRequest = typeof msg.method === "string" && msg.id !== undefined
  if (typeof msg.method === "string" && msg.id === undefined) return null // a notification: nothing to answer
  if (!isRequest) return null // a response from the client to something we never ask: ignored
  if (!validId(msg.id)) return rpcError(null, -32600, "Invalid Request")
  const id = msg.id
  const params = (msg.params && typeof msg.params === "object" && !Array.isArray(msg.params) ? msg.params : {}) as Record<string, unknown>

  switch (msg.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : ""
      return rpcResult(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(asked) ? asked : SUPPORTED_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case "ping":
      return rpcResult(id, {})
    case "tools/list":
      return rpcResult(id, { tools: listTools() })
    case "tools/call": {
      if (typeof params.name !== "string") return rpcError(id, -32602, "Invalid params: name is required")
      const result = await callTool(params.name, params.arguments, caller, backend)
      return result ? rpcResult(id, result) : rpcError(id, -32602, `Unknown tool: ${params.name.slice(0, 80)}`)
    }
    default:
      return rpcError(id, -32601, "Method not found")
  }
}

/** One HTTP request to the MCP endpoint. The route file only wires real dependencies into this. */
export async function handleMcp(request: Request, deps: McpDeps): Promise<Response> {
  // 1. Switched off: the endpoint does not exist. Checked per request, so turning it off needs no redeploy of code.
  if (!mcpEnabled(deps.env)) return json({ error: "Not found" }, 404)

  // 2. Origin (MCP spec: servers must validate it).
  if (!allowedOrigin(request, deps.env)) return json({ error: "Origin not allowed" }, 403)

  // 3. Methods. Stateless JSON server: POST only. No CORS, so browsers on other sites cannot read responses.
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS", ...NO_STORE } })
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST, OPTIONS" })

  // 4. Authentication, before the body is read. Bearer only: a request carrying cookies is refused outright, so a
  //    browser's ambient MFit session can never authorise a tool call, and wrapped routes can never fall back to it.
  const authorization = request.headers.get("authorization")
  if (request.headers.get("cookie")) return unauthorized("This endpoint accepts an Authorization: Bearer token only, not cookies.", authorization !== null)
  const token = authorization?.match(/^Bearer ([A-Za-z0-9._~+/=-]+)$/)?.[1]
  if (!authorization || !token) return unauthorized("Sign in to MFit and send your access token as Authorization: Bearer <token>.", authorization !== null)
  const now = deps.now ? deps.now() : Date.now()
  if (!bearerClaimsOk(token, now)) return unauthorized("The access token is expired, long-lived or not an MFit user token.", true)
  let user: { id: string } | null = null
  try { user = await deps.verify(request) } catch { user = null }
  if (!user || typeof user.id !== "string" || !user.id) return unauthorized("The access token was not accepted.", true)

  // 5. Per-person rate limit (the wrapped routes keep their own limits as well).
  if (deps.rateLimit) {
    const rl = deps.rateLimit(`mcp:${user.id}`, { max: 120, windowMs: 60_000 })
    if (!rl.ok) return json({ error: "Too many requests. Try again shortly." }, 429, { "Retry-After": String(rl.retryAfterSec ?? 60) })
  }

  // 6. Transport checks.
  const version = request.headers.get("mcp-protocol-version")
  if (version !== null && !SUPPORTED_PROTOCOL_VERSIONS.includes(version)) return json({ error: `Unsupported MCP-Protocol-Version. Supported: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}` }, 400)
  if (!/^application\/json\b/i.test(request.headers.get("content-type") || "")) return json({ error: "Content-Type must be application/json" }, 415)
  const accept = request.headers.get("accept")
  if (accept !== null && !/application\/json|\*\/\*/i.test(accept)) return json({ error: "Accept must include application/json" }, 406)
  const declared = Number(request.headers.get("content-length") || 0)
  if (declared > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413)
  const text = await request.text()
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413)

  let body: unknown
  try { body = JSON.parse(text) } catch { return json(rpcError(null, -32700, "Parse error"), 400) }

  const caller: McpCaller = {
    userId: user.id,
    authorization,
    clientIp: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown",
  }

  // 7. JSON-RPC. A batch (allowed by the 2025-03-26 revision) is answered as a batch, capped at 20 messages.
  if (Array.isArray(body)) {
    if (!body.length || body.length > 20) return json(rpcError(null, -32600, "Invalid Request"), 400)
    const out: object[] = []
    for (const m of body) { const r = await handleMessage(m as RpcMessage, caller, deps.backend); if (r) out.push(r) }
    return out.length ? json(out) : new Response(null, { status: 202, headers: NO_STORE })
  }
  const reply = await handleMessage(body as RpcMessage, caller, deps.backend)
  return reply ? json(reply) : new Response(null, { status: 202, headers: NO_STORE })
}
