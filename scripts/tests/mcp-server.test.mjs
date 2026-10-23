// MFit MCP server (approved idea 19). Pins the four promises it ships on:
// it is off unless switched on, it refuses anyone not signed in, each tool returns only the caller's own data,
// and no tool can send, submit, apply, email or post.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { handleMcp, bearerClaimsOk, SUPPORTED_PROTOCOL_VERSIONS } from '../../src/lib/mcp/server.ts'
import { BACKEND_METHODS, TOOL_NAMES, listTools } from '../../src/lib/mcp/tools.ts'
import { createRouteBackend, resolveResumeRef, resumeRefOf } from '../../src/lib/mcp/backend.ts'

const NOW = Date.UTC(2026, 9, 23, 12, 0, 0)
const BASE = '/data/user-resumes'
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (claims) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.sig-${claims.sub || 'none'}`
const tokenFor = (sub, extra = {}) => jwt({ sub, role: 'authenticated', aud: 'authenticated', iat: NOW / 1000 - 60, exp: NOW / 1000 + 3540, ...extra })
const TOKEN_A = tokenFor('user-a')
const TOKEN_B = tokenFor('user-b')
const SIGNED = new Map([[TOKEN_A, 'user-a'], [TOKEN_B, 'user-b']])
const userOf = authorization => SIGNED.get(String(authorization || '').replace(/^Bearer /, '')) || null

// Each person's data, as the real routes would hold it. Paths are absolute, as the routes return them.
const DATA = {
  'user-a': {
    files: [`${BASE}/user-a/Cyber/A Resume.docx`, `${BASE}/user-a/A Base.docx`],
    events: [{ id: 'a1', at: NOW - 1000, kind: 'submitted', title: 'A AppSec Engineer', company: 'A Corp' }, { id: 'a2', at: NOW - 2000, kind: 'save', title: 'A Saved', company: 'A Two' }],
  },
  'user-b': {
    files: [`${BASE}/user-b/B Secret.docx`],
    events: [{ id: 'b1', at: NOW - 1000, kind: 'submitted', title: 'B Private Role', company: 'B Corp' }],
  },
}
const CAPABILITY_TOKEN = 'deadbeefcafef00d1234'

/** Fake versions of the five wrapped routes. Each authenticates by the forwarded Authorization header, as the real ones do. */
function fakeRoutes(log) {
  const guard = (name, handler) => async request => {
    const body = request.method === 'POST' ? await request.clone().text() : ''
    log.push({ route: name, method: request.method, url: request.url, body, authorization: request.headers.get('authorization') })
    const user = userOf(request.headers.get('authorization'))
    if (!user) return Response.json({ error: 'Sign in' }, { status: 401 })
    return handler(request, user)
  }
  const inside = (user, p) => typeof p === 'string' && p.startsWith(`${BASE}/${user}/`)
  return {
    jobs: guard('jobs', async () => Response.json({ jobs: [{ id: 'j1', title: 'AppSec Engineer', company: 'Acme', location: 'Remote', remote: true, description: 'x'.repeat(5000), url: 'https://boards.greenhouse.io/acme/1', source: 'greenhouse', workAuth: ['c2c'] }], live: true, sources: ['greenhouse'] })),
    resumes: guard('resumes', async (_r, user) => Response.json({ files: [
      ...DATA[user].files.map(f => ({ filepath: f, filename: f.split('/').pop().replace('.docx', ''), category: 'General', uploadedAt: '2026-10-01T00:00:00Z' })),
      // A misbehaving route answer naming someone else's file: the backend must drop it, not show it.
      { filepath: `${BASE}/someone-else/Leak.docx`, filename: 'Leak', category: 'General' },
    ] })),
    match: guard('match', async (request, user) => {
      const body = await request.json()
      if (!inside(user, body.filepath)) return Response.json({ error: `Resume not found at ${body.filepath}` }, { status: 404 })
      return Response.json({ ok: true, scores: body.jobs.map(j => ({ id: j.id, score: 50, matched: [`${user}-skill`], missing: [], certs: [] })) })
    }),
    tailor: guard('tailor', async (request, user) => {
      const body = await request.json()
      if (!inside(user, body.filepath)) return Response.json({ error: 'Forbidden' }, { status: 403 })
      return Response.json({
        token: CAPABILITY_TOKEN, score: 80, matched: { filepath: body.filepath }, what_changed: ['Summary rewritten'],
        keyword_analysis: { matched: ['owasp'], added: ['sast'], missing: [], coverage_before: 40, coverage_after: 90 }, coverage: 88,
        diff: [{ section: 'Summary', before: 'old', after: 'new' }],
        saved: { rel: 'x', filepath: `${BASE}/${user}/Tailored/Role - Co.docx`, email: `${user}@example.com`, category: 'Cyber', name: 'Role - Co' },
      })
    }),
    activity: guard('activity', async (_r, user) => Response.json({ events: DATA[user].events })),
  }
}

const PORTALS = [
  { firm: 'TEKsystems', url: 'https://careers.teksystems.com/us/en', hq: 'Hanover, MD', specialties: 'IT', size: 'Large', notes: '', cyber: true, cyberCore: false },
  { firm: 'Experis', url: '', hq: 'Milwaukee, WI', specialties: 'IT', size: 'Large', notes: 'unverified', cyber: false, cyberCore: false },
]

function setup({ env = { MCP_ENABLED: '1' }, rateLimit } = {}) {
  const log = []
  const verifyCalls = []
  const backend = createRouteBackend({
    resumesBase: BASE,
    makeRequest: (p, init) => new Request(new URL(p, 'https://mfit.test'), init),
    routes: fakeRoutes(log),
    portals: PORTALS,
    detectAts: u => (/greenhouse/.test(u) ? 'greenhouse' : /teksystems/.test(u) ? 'phenom' : 'custom'),
    automationPath: u => (/greenhouse/.test(u) ? 'ats-direct' : 'portal-custom'),
  })
  const deps = {
    env, backend, rateLimit, now: () => NOW,
    verify: async request => { verifyCalls.push(1); const id = userOf(request.headers.get('authorization')); return id ? { id } : null },
  }
  let id = 0
  const send = async (body, { token = TOKEN_A, headers = {}, method = 'POST', raw } = {}) => {
    const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }
    if (token) h.authorization = `Bearer ${token}`
    const init = { method, headers: h }
    if (method !== 'GET' && method !== 'HEAD') init.body = raw ?? JSON.stringify(body)
    return handleMcp(new Request('https://mfit.test/api/mcp', init), deps)
  }
  const rpc = async (method, params, opts) => {
    const res = await send({ jsonrpc: '2.0', id: ++id, method, params }, opts)
    return { status: res.status, body: res.status === 200 ? await res.json() : await res.text() }
  }
  const tool = async (name, args, opts) => (await rpc('tools/call', { name, arguments: args }, opts)).body.result
  return { send, rpc, tool, log, verifyCalls }
}

// ── 1. Off by default ─────────────────────────────────────────────────────────────────────────────────────────

test('the MCP endpoint does not exist unless MCP_ENABLED is exactly 1', async () => {
  for (const env of [{}, { MCP_ENABLED: '0' }, { MCP_ENABLED: 'true' }, { MCP_ENABLED: 'yes' }, { MCP_ENABLED: '' }]) {
    const s = setup({ env })
    for (const method of ['POST', 'GET', 'DELETE', 'OPTIONS', 'PUT', 'HEAD']) {
      const res = await s.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { method })
      assert.equal(res.status, 404, `${method} with ${JSON.stringify(env)}`)
    }
    assert.equal(s.verifyCalls.length, 0, 'nobody is even asked to sign in while it is off')
    assert.equal(s.log.length, 0, 'no wrapped route is reached while it is off')
  }
  const on = setup()
  assert.equal((await on.rpc('tools/list')).status, 200)
})

test('the route file reads the switch from the environment and sends every method through the gate', () => {
  const src = readFileSync(new URL('../../src/app/api/mcp/route.ts', import.meta.url), 'utf8')
  assert.match(src, /env: process\.env/)
  for (const m of ['POST', 'GET', 'DELETE', 'PUT', 'PATCH', 'HEAD', 'OPTIONS']) assert.match(src, new RegExp(`export const ${m} = handle\\b`))
  assert.doesNotMatch(src, /process\.env\.MCP_ENABLED/, 'the switch is decided in one place, the tested core')
})

// ── 2. Unauthenticated calls are refused ──────────────────────────────────────────────────────────────────────

test('calls without a valid MFit sign-in are refused before anything is read', async () => {
  const cases = [
    { name: 'no Authorization', token: null },
    { name: 'Basic credentials', token: null, headers: { authorization: 'Basic dXNlcjpwYXNz' } },
    { name: 'empty Bearer', token: null, headers: { authorization: 'Bearer ' } },
    { name: 'expired token', token: tokenFor('user-a', { exp: NOW / 1000 - 1 }) },
    { name: 'long-lived token', token: tokenFor('user-a', { iat: NOW / 1000 - 60, exp: NOW / 1000 + 30 * 86400 }) },
    { name: 'anonymous user', token: tokenFor('user-a', { is_anonymous: true }) },
    { name: 'service key', token: jwt({ role: 'service_role', iat: NOW / 1000, exp: NOW / 1000 + 3600 }) },
    { name: 'refresh token', token: 'v1.MjAyNi0xMC0yMw-opaque-refresh' },
    { name: 'forged signature', token: tokenFor('user-a', { jti: 'forged' }) },
  ]
  for (const c of cases) {
    const s = setup()
    const res = await s.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_applications', arguments: {} } }, { token: c.token, headers: c.headers })
    assert.equal(res.status, 401, c.name)
    assert.match(res.headers.get('www-authenticate') || '', /^Bearer realm="mfit-mcp"/, c.name)
    assert.equal(s.log.length, 0, `${c.name}: no route reached`)
    const text = await res.text()
    if (c.token) assert.ok(!text.includes(c.token), `${c.name}: the token is never echoed`)
  }
})

test('a browser cookie can never authorise a call, even alongside a valid Bearer token', async () => {
  const s = setup()
  const res = await s.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { headers: { cookie: 'sb-access-token=abc' } })
  assert.equal(res.status, 401)
  assert.equal(s.verifyCalls.length, 0)
})

test('a request from another website is refused; desktop clients without an Origin are served', async () => {
  const s = setup()
  assert.equal((await s.send({ jsonrpc: '2.0', id: 1, method: 'ping' }, { headers: { origin: 'https://evil.example' } })).status, 403)
  assert.equal((await s.send({ jsonrpc: '2.0', id: 1, method: 'ping' }, { headers: { origin: 'https://mfit.test' } })).status, 200)
  assert.equal((await s.send({ jsonrpc: '2.0', id: 1, method: 'ping' })).status, 200)
  assert.equal(s.log.length, 0)
})

test('token pre-check accepts only a live, short-lived Supabase user token', () => {
  assert.equal(bearerClaimsOk(TOKEN_A, NOW), true)
  assert.equal(bearerClaimsOk(tokenFor('u', { exp: NOW / 1000 }), NOW), false)
  assert.equal(bearerClaimsOk(tokenFor('u', { role: 'anon' }), NOW), false)
  assert.equal(bearerClaimsOk(tokenFor('', {}), NOW), false)
  assert.equal(bearerClaimsOk('not-a-jwt', NOW), false)
})

// ── Protocol ──────────────────────────────────────────────────────────────────────────────────────────────────

test('speaks MCP over Streamable HTTP: initialize, ping, tools/list, notifications, errors', async () => {
  const s = setup()
  const init = await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } })
  assert.equal(init.status, 200)
  assert.equal(init.body.result.protocolVersion, '2025-06-18')
  assert.deepEqual(init.body.result.capabilities, { tools: { listChanged: false } })
  const unknown = await s.rpc('initialize', { protocolVersion: '1999-01-01' })
  assert.equal(unknown.body.result.protocolVersion, SUPPORTED_PROTOCOL_VERSIONS[0])
  assert.deepEqual((await s.rpc('ping')).body.result, {})
  assert.equal((await s.send({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202)
  assert.equal((await s.rpc('resources/list')).body.error.code, -32601)
  assert.equal((await s.send(null, { raw: '{not json' })).status, 400)
  assert.equal((await s.send({}, { headers: { 'mcp-protocol-version': '1999-01-01' } })).status, 400)
  assert.equal((await s.send({}, { headers: { 'content-type': 'text/plain' } })).status, 415)
  assert.equal((await s.send({}, { method: 'GET' })).status, 405)
  assert.equal((await s.send({}, { method: 'DELETE' })).status, 405)
  assert.equal((await s.send(null, { raw: JSON.stringify({ x: 'y'.repeat(300 * 1024) }) })).status, 413)
  const batch = await s.send([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }])
  assert.deepEqual(await batch.json(), [{ jsonrpc: '2.0', id: 1, result: {} }])
})

test('the per-person rate limit is keyed by the verified user, not by anything the client sends', async () => {
  const keys = []
  const s = setup({ rateLimit: key => { keys.push(key); return { ok: keys.length < 3, retryAfterSec: 9 } } })
  assert.equal((await s.rpc('ping')).status, 200)
  assert.equal((await s.rpc('ping', {}, { token: TOKEN_B })).status, 200)
  const limited = await s.send({ jsonrpc: '2.0', id: 3, method: 'ping' })
  assert.equal(limited.status, 429)
  assert.deepEqual(keys, ['mcp:user-a', 'mcp:user-b', 'mcp:user-a'])
})

// ── 3. Each tool returns only the caller's data ───────────────────────────────────────────────────────────────

test('list_resumes shows only the caller\'s own files, as names relative to their own Files', async () => {
  const s = setup()
  const a = (await s.tool('list_resumes', {})).structuredContent
  assert.deepEqual(a.resumes.map(r => r.resume), ['Cyber/A Resume.docx', 'A Base.docx'])
  const b = (await s.tool('list_resumes', {}, { token: TOKEN_B })).structuredContent
  assert.deepEqual(b.resumes.map(r => r.resume), ['B Secret.docx'])
  const text = JSON.stringify([a, b])
  assert.ok(!text.includes(BASE), 'no absolute server path reaches the client')
  assert.ok(!text.includes('Leak'), 'a file outside the caller\'s folder is dropped')
})

test('list_applications returns only the caller\'s own pipeline', async () => {
  const s = setup()
  const a = (await s.tool('list_applications', {})).structuredContent.events
  assert.deepEqual(a.map(e => e.title), ['A AppSec Engineer', 'A Saved'])
  const b = (await s.tool('list_applications', {}, { token: TOKEN_B })).structuredContent.events
  assert.deepEqual(b.map(e => e.title), ['B Private Role'])
  const submitted = (await s.tool('list_applications', { kind: 'submitted', limit: 1 })).structuredContent.events
  assert.deepEqual(submitted.map(e => e.title), ['A AppSec Engineer'])
  // Every wrapped call carried the caller's own token, and only that.
  assert.deepEqual(s.log.map(l => l.authorization), [`Bearer ${TOKEN_A}`, `Bearer ${TOKEN_B}`, `Bearer ${TOKEN_A}`])
})

test('no argument can name another person: identity fields are rejected before any route is reached', async () => {
  const s = setup()
  for (const [name, args] of [
    ['list_applications', { userId: 'user-b' }],
    ['list_resumes', { user_id: 'user-b' }],
    ['get_match_score', { resume: 'A Base.docx', jobs: [{ title: 't', description: 'd' }], owner: 'user-b' }],
  ]) {
    const r = await s.tool(name, args)
    assert.equal(r.isError, true, name)
    assert.match(r.content[0].text, /not an accepted field/, name)
  }
  assert.equal(s.log.length, 0)
})

test('get_match_score and tailor_resume refuse another person\'s resume, however it is named', async () => {
  const s = setup()
  const jobs = [{ title: 'AppSec', description: 'OWASP SAST DAST threat modeling' }]
  for (const resume of ['../user-b/B Secret.docx', `${BASE}/user-b/B Secret.docx`, 'Cyber/../../user-b/B Secret.docx', '..\\user-b\\B Secret.docx', '../../user-resumes/user-b/B Secret.docx', 'A Base.pdf']) {
    const m = await s.tool('get_match_score', { resume, jobs })
    assert.equal(m.isError, true, resume)
    const t = await s.tool('tailor_resume', { resume, job_description: 'x'.repeat(80) })
    assert.equal(t.isError, true, resume)
  }
  assert.equal(s.log.length, 0, 'refused before any route is reached')
  // A bare name of B's file can only ever mean a file in A's own folder: it is looked up there, with A's token.
  await s.tool('get_match_score', { resume: 'B Secret.docx', jobs })
  assert.equal(s.log.length, 1)
  assert.equal(JSON.parse(s.log[0].body).filepath, `${BASE}/user-a/B Secret.docx`)
  assert.equal(s.log[0].authorization, `Bearer ${TOKEN_A}`)
  const ok = await s.tool('get_match_score', { resume: 'Cyber/A Resume.docx', jobs })
  assert.equal(ok.isError, undefined)
  assert.deepEqual(ok.structuredContent.scores[0].matched, ['user-a-skill'])
})

test('tailor_resume files into the caller\'s own Files and never hands out the capability token or server paths', async () => {
  const s = setup()
  const r = await s.tool('tailor_resume', { resume: 'A Base.docx', job_description: 'Application security engineer, OWASP, SAST, DAST. '.repeat(3), role: 'AppSec Engineer', company: 'Acme' })
  assert.equal(r.isError, undefined)
  assert.deepEqual(r.structuredContent.saved, { resume: 'Tailored/Role - Co.docx', name: 'Role - Co', folder: 'Cyber' })
  assert.equal(r.structuredContent.coverage_after, 90)
  const text = JSON.stringify(r)
  assert.ok(!text.includes(CAPABILITY_TOKEN), 'the unauthenticated download token stays server-side')
  assert.ok(!text.includes(BASE), 'no absolute path')
  assert.ok(!text.includes('@example.com'), 'the filing email is not echoed')
})

test('route errors never carry a server path to the client', async () => {
  const routes = fakeRoutes([])
  const backend = createRouteBackend({
    resumesBase: BASE, makeRequest: (p, init) => new Request(new URL(p, 'https://mfit.test'), init),
    routes: { ...routes, match: async () => Response.json({ error: `Resume not found at ${BASE}/user-a/x.docx` }, { status: 404 }) },
    portals: [], detectAts: () => 'custom', automationPath: () => 'manual',
  })
  await assert.rejects(backend.matchScore({ userId: 'user-a', authorization: `Bearer ${TOKEN_A}`, clientIp: '1.2.3.4' }, { resume: 'x.docx', jobs: [{ id: '1', title: 't', description: 'd' }] }),
    e => !String(e.message).includes(BASE) && /\[file\]/.test(e.message))
})

test('resume names resolve only inside the caller\'s own folder', () => {
  assert.equal(resolveResumeRef(BASE, 'user-a', 'Cyber/A.docx'), `${BASE}/user-a/Cyber/A.docx`)
  for (const ref of ['../user-b/x.docx', '/etc/passwd.docx', `${BASE}/user-b/x.docx`, 'a/./b.docx', 'x.doc', '', 'a\0.docx', 'a\\..\\b.docx', null, 42]) {
    assert.equal(resolveResumeRef(BASE, 'user-a', ref), null, String(ref))
  }
  assert.equal(resolveResumeRef(BASE, '../user-b', 'x.docx'), null)
  assert.equal(resolveResumeRef(BASE, '', 'x.docx'), null)
  assert.equal(resumeRefOf(BASE, 'user-a', `${BASE}/user-a/Cyber/A.docx`), 'Cyber/A.docx')
  assert.equal(resumeRefOf(BASE, 'user-a', `${BASE}/user-a-copy/A.docx`), null)
  assert.equal(resumeRefOf(BASE, 'user-a', `${BASE}/user-b/A.docx`), null)
})

test('search_jobs and get_portal answer with trimmed, labelled data', async () => {
  const s = setup()
  const jobs = (await s.tool('search_jobs', { query: 'appsec', remote: true, limit: 5 })).structuredContent
  assert.equal(jobs.live, true)
  assert.equal(jobs.jobs[0].summary.length, 600)
  assert.match(s.log[0].url, /\/api\/jobs\?q=appsec&remote=true$/)
  const portals = (await s.tool('get_portal', { firm: 'tek' })).structuredContent
  assert.deepEqual(portals.portals.map(p => [p.firm, p.platform]), [['TEKsystems', 'phenom']])
  const byUrl = (await s.tool('get_portal', { url: 'https://careers.teksystems.com/us/en/job/1' })).structuredContent
  assert.deepEqual(byUrl.portals.map(p => p.firm), ['TEKsystems'])
  assert.equal(byUrl.url.platform, 'phenom')
  const unverified = (await s.tool('get_portal', { firm: 'experis' })).structuredContent.portals[0]
  assert.equal(unverified.portal_url, null)
  assert.equal(unverified.verified, false)
})

// ── 4. No tool can trigger a send ─────────────────────────────────────────────────────────────────────────────

test('the tool list is exactly the approved read tools plus tailor_resume', async () => {
  assert.deepEqual(TOOL_NAMES, ['search_jobs', 'list_resumes', 'get_match_score', 'tailor_resume', 'list_applications', 'get_portal'])
  for (const t of listTools()) {
    assert.equal(t.inputSchema.additionalProperties, false, t.name)
    assert.equal(t.annotations.destructiveHint, false, t.name)
    assert.equal(t.annotations.readOnlyHint, t.name !== 'tailor_resume', t.name)
  }
  assert.deepEqual([...BACKEND_METHODS], ['searchJobs', 'listResumes', 'matchScore', 'tailorResume', 'listApplications', 'getPortals'])
  const s = setup()
  const listed = (await s.rpc('tools/list')).body.result.tools.map(t => t.name)
  assert.deepEqual(listed, TOOL_NAMES)
})

test('send, submit, apply, email and post tools do not exist and reach nothing', async () => {
  const s = setup()
  for (const name of ['send_email', 'gmail_send', 'submit_application', 'apply', 'apply_to_job', 'autofill_form', 'post_message', 'send_whatsapp', 'record_activity', 'start_crawl', '__proto__', 'constructor']) {
    const r = await s.rpc('tools/call', { name, arguments: {} })
    assert.equal(r.body.error.code, -32602, name)
  }
  assert.equal(s.log.length, 0)
})

test('running every tool reaches only the read routes and the tailor, never activity POST or any sender', async () => {
  const s = setup()
  await s.tool('search_jobs', { query: 'security' })
  await s.tool('list_resumes', {})
  await s.tool('get_match_score', { resume: 'A Base.docx', jobs: [{ title: 't', description: 'd' }] })
  await s.tool('tailor_resume', { resume: 'A Base.docx', job_description: 'y'.repeat(60) })
  await s.tool('list_applications', {})
  await s.tool('get_portal', {})
  const reached = new Set(s.log.map(l => `${l.method} ${l.route}`))
  assert.deepEqual([...reached].sort(), ['GET activity', 'GET jobs', 'GET resumes', 'POST match', 'POST tailor'])
})

test('the MCP code imports nothing that can send, submit, apply, email or post', () => {
  const files = [
    ...readdirSync(new URL('../../src/lib/mcp/', import.meta.url)).map(f => new URL(`../../src/lib/mcp/${f}`, import.meta.url)),
    new URL('../../src/app/api/mcp/route.ts', import.meta.url),
  ]
  const allowed = new Set([
    'node:path', './tools.ts', 'next/server', '@/lib/mcp/server', '@/lib/mcp/backend', '@/lib/authBoundary', '@/lib/paths',
    '@/lib/rateLimit', '@/lib/vendorPortals', '@/lib/ats-fingerprints', '@/app/api/jobs/route', '@/app/api/resumes/route',
    '@/app/api/apply/match/route', '@/app/api/tailor/route', '@/app/api/apply/activity/route',
  ])
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const [, spec] of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) assert.ok(allowed.has(spec), `${file.pathname} imports ${spec}`)
    assert.doesNotMatch(src, /fetch\(/, `${file.pathname} makes no outbound request of its own`)
  }
  const route = readFileSync(new URL('../../src/app/api/mcp/route.ts', import.meta.url), 'utf8')
  assert.match(route, /import \{ GET as activityGET \} from "@\/app\/api\/apply\/activity\/route"/)
  assert.doesNotMatch(route, /POST as activity/)
  assert.doesNotMatch(route, /GET as (match|tailor)|DELETE as|PUT as|PATCH as/)
})
