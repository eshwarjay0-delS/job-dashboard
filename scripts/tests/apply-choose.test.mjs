// Apply on the website chooses the resume the way the WhatsApp bot does (src/lib/library-choose.ts), files what it makes
// in Files (src/lib/tailor-file.ts) and answers from POST /api/resumes/choose. Owner, 20 Oct 2026: "Just like how
// WhatsApp resume apply is working ... the resume will be automatically selected ... by automatically grabbing the JD
// from the job postings". Stand-ins for storage, the AI and the user; the modules run for real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
  const module = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8')
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process, console, Buffer, setTimeout, require: id => id in mocks ? mocks[id] : require(id),
  })
  return module.exports
}

const USERS = path.join('/data', 'user-resumes'), USER_DIR = path.join(USERS, 'u1')
const P = (...a) => path.join(USER_DIR, ...a)
const POST = `The client is looking for a skilled Security Analyst in New York, NY.\nRole: Security Analyst\nDuration: 12 Months\nTechnical skills: EC2, Docker, Java, Kotlin and SQL.\nMust have strong analytical skills and the ability to work independently.`
const CYBER = P('a@x.com', 'Identity and Access Management', 'Cyber Security Analyst.docx')
const AI = P('a@x.com', 'AI Security and Governance', 'AI plus AppSec.docx')
const OTHER = P('b@y.com', 'AppSec Engineer', 'AppSec.docx')
const lib = () => [
  { path: AI, email: 'a@x.com', folder: 'AI Security and Governance', name: 'AI plus AppSec', title: 'AI Security Engineer', depth: 0, keywords: ['burp suite', 'owasp'], at: 9 },
  { path: CYBER, email: 'a@x.com', folder: 'Identity and Access Management', name: 'Cyber Security Analyst', depth: 0, keywords: ['splunk'], at: 5 },
  { path: OTHER, email: 'b@y.com', folder: 'AppSec Engineer', name: 'AppSec', depth: 0, keywords: ['owasp'], at: 3 },
]

function world({ agent = null, candidates = lib() } = {}) {
  const logs = []
  const mocks = {
    '@/lib/storage': { readPath: async p => (candidates.some(c => c.path === p) ? Buffer.from(`resume of ${candidates.find(c => c.path === p).email}`) : null), blob: {} },
    '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/llm': { resolveKeys: () => ({}), keysFor: async () => ({ gemini: 'g' }) },
    '@/lib/keywords': { extractKeywords: () => ['burp suite', 'owasp'] },
    '@/lib/resumeOrganization': { resumeEmails: t => [...new Set(t.match(/[\w.]+@[\w.]+\.\w+/g) || [])] },
    '@/lib/resume-library': { jobKeyOf: jd => (jd === POST ? 'job-1' : `job-${String(jd).length}`) },
    '@/lib/resume-library-store': { readShelf: async () => ({ uses: {} }), relOf: (dir, abs) => path.relative(dir, abs).split(path.sep).join('/') },
    '@/lib/library-pick-store': { libraryOf: async () => ({ index: {}, counts: { 'a@x.com': 2, 'b@y.com': 1 } }), candidatesFor: async (dir, email) => candidates.filter(c => c.email === email) },
    '@/lib/library-pick': load('src/lib/library-pick.ts'),
    '@/lib/role-match': load('src/lib/role-match.ts'),
    '@/lib/library-agent': { agentPick: async () => agent, logPick: async (u, e) => { logs.push({ u, ...e }) } },
  }
  return { choose: load('src/lib/library-choose.ts', mocks), logs }
}

test('the resume is the one titled for the job, whatever the keywords or the folder say; the choice is logged only when asked', async () => {
  const { choose, logs } = world()
  const c = await choose.chooseResume({ userDir: USER_DIR, userId: 'u1', email: 'a@x.com', jd: POST, log: false })
  assert.equal(c.kind, 'ok')
  assert.equal(c.picked.candidate.path, CYBER)
  assert.equal(c.rel, 'a@x.com/Identity and Access Management/Cyber Security Analyst.docx')
  assert.equal(c.why, "because its title matches the job's role: Security Analyst")
  assert.equal(c.titled, 1); assert.equal(c.role, 'Security Analyst')
  assert.equal(logs.length, 0, 'looking at a posting is not using the resume')
  await choose.logChoice({ userDir: USER_DIR, userId: 'u1', email: 'a@x.com', jd: POST, choice: c })
  assert.equal(logs.length, 1)
  assert.deepEqual({ used: logs[0].used, code: logs[0].code, role: logs[0].role, titled: logs[0].titled, agree: logs[0].agree }, { used: c.rel, code: c.rel, role: 'Security Analyst', titled: 1, agree: null })
  // Logged by default (the bot's way).
  await choose.chooseResume({ userDir: USER_DIR, userId: 'u1', email: 'a@x.com', jd: POST })
  assert.equal(logs.length, 2)
})

test('a resume named is used; one that is not there says what is; "another one" avoids the last; an email with none says so', async () => {
  const { choose } = world()
  const named = await choose.chooseResume({ userDir: USER_DIR, userId: 'u1', email: 'a@x.com', jd: POST, prefer: { hint: 'AI Security Engineer' }, log: false })
  assert.equal(named.picked.candidate.path, AI); assert.equal(named.why, 'because you asked for it')
  const lost = await choose.chooseResume({ userDir: USER_DIR, userId: 'u1', email: 'a@x.com', jd: POST, prefer: { hint: 'Kubernetes Platform' }, log: false })
  assert.equal(lost.kind, 'unnamed'); assert.ok(lost.have.includes('Cyber Security Analyst'))
  const other = await choose.chooseResume({ userDir: USER_DIR, userId: 'u1', email: 'a@x.com', jd: POST, prefer: { avoid: 'a@x.com/Identity and Access Management/Cyber Security Analyst.docx' }, log: false })
  assert.equal(other.picked.candidate.path, AI); assert.match(other.why, /another one/)
  assert.equal((await choose.chooseResume({ userDir: USER_DIR, userId: 'u1', email: 'nobody@z.com', jd: POST, log: false })).kind, 'none')
})

test('the agent chooses inside the titled resumes; with none titled nothing is left out', async () => {
  const both = [...lib(), { path: P('a@x.com', 'SOC Analyst', 'Cyber Security Analyst Cloud.docx'), email: 'a@x.com', folder: 'SOC Analyst', name: 'Cyber Security Analyst Cloud', title: 'Cyber Security Analyst', depth: 0, keywords: ['aws'], at: 4 }]
  const { choose } = world({ candidates: both, agent: { index: 1, why: 'the cloud one', by: 'm' } })
  const c = await choose.chooseResume({ userDir: USER_DIR, userId: 'u1', email: 'a@x.com', jd: POST, log: false })
  assert.equal(c.pool.length, 2, 'both resumes titled Cyber Security Analyst, not the AI one')
  assert.equal(c.picked.candidate.name, 'Cyber Security Analyst Cloud', "the agent's pick inside them")
  const none = world({ candidates: lib().filter(r => !/Analyst/.test(r.name)) })
  const n = await none.choose.chooseResume({ userDir: USER_DIR, userId: 'u1', email: 'a@x.com', jd: POST, log: false })
  assert.equal(n.why, '', 'no resume titled for it: chosen by the skills, and not said to be by title')
})

test('with no email given, the email with a resume titled for the job is the one', async () => {
  const { choose } = world()
  assert.equal(await choose.bestEmailFor(USER_DIR, ['b@y.com', 'a@x.com'], POST), 'a@x.com')
  assert.equal(await choose.bestEmailFor(USER_DIR, ['b@y.com'], POST), 'b@y.com')
  assert.equal(await choose.bestEmailFor(USER_DIR, [], POST), '')
  const appsec = 'Application Security Engineer\nRole: Application Security Engineer\nOWASP, Burp Suite, threat modeling and secure code review for our web applications.'
  assert.equal(await choose.bestEmailFor(USER_DIR, ['a@x.com', 'b@y.com'], appsec), 'b@y.com')
})

test('what a tailor run makes is filed in Files from the resume it started from, one job one file, and the start is counted', async () => {
  const filed = [], used = []
  const mocks = {
    path,
    '@/lib/storage': { blob: { get: async k => (k === 'tailored/tok1.docx' ? Buffer.from('a@x.com tailored') : null) } },
    '@/lib/resume-library': { isTailoredName: n => /\(tailored\)/.test(n) },
    '@/lib/resume-library-store': {
      relOf: (dir, abs) => path.relative(dir, abs).split(path.sep).join('/'),
      saveTailored: async o => { filed.push(o); return { rel: 'a@x.com/General Security/Security Analyst - Acme (tailored)__0123456789abcdef.docx', abs: P('a@x.com', 'General Security', 'Security Analyst - Acme (tailored)__0123456789abcdef.docx'), email: 'a@x.com', category: 'General Security' } },
      markUsed: async (dir, abs) => { used.push(abs) },
    },
  }
  const { fileTailored } = load('src/lib/tailor-file.ts', mocks)
  const result = { token: 'tok1', keyword_analysis: { matched: ['splunk'], added: ['docker'], missing: ['kotlin'] } }
  const out = await fileTailored({ userDir: USER_DIR, base: CYBER, jd: POST, result, role: 'Security Analyst', company: 'Acme' })
  assert.deepEqual({ ...out }, { rel: 'a@x.com/General Security/Security Analyst - Acme (tailored)__0123456789abcdef.docx', filepath: P('a@x.com', 'General Security', 'Security Analyst - Acme (tailored)__0123456789abcdef.docx'), email: 'a@x.com', category: 'General Security', name: 'Security Analyst - Acme (tailored)' })
  assert.equal(filed.length, 1)
  assert.equal(filed[0].depth, 1, 'built on a resume the person wrote')
  assert.equal(filed[0].from, 'a@x.com/Identity and Access Management/Cyber Security Analyst.docx')
  assert.deepEqual([...filed[0].asked].sort(), ['docker', 'kotlin', 'splunk']); assert.deepEqual([...filed[0].covers].sort(), ['docker', 'splunk'])
  assert.deepEqual(used, [CYBER])
  // A resume made for another job is already a copy; a file that cannot be read back files nothing.
  await fileTailored({ userDir: USER_DIR, base: P('a@x.com', 'General Security', 'Other - Co (tailored)__1111111111111111.docx'), jd: POST, result, role: 'x' })
  assert.equal(filed[1].depth, 2)
  assert.equal(await fileTailored({ userDir: USER_DIR, base: CYBER, jd: POST, result: { token: 'gone' }, role: 'x' }), null)
})

test('the website tailor files only when asked to, and the choose route answers what Apply needs', () => {
  const tailor = readFileSync(new URL('../../src/app/api/tailor/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.ok(tailor.includes('const save = body.save && typeof body.save === "object"') && tailor.includes('saved ? { ...result, saved } : result'))
  const route = readFileSync(new URL('../../src/app/api/resumes/choose/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  for (const part of ['authenticatedUserId(request)', 'bestEmailFor(userDir, emails, jd)', 'existingForJob(userDir, email, jd)', 'log: false', 'if (body.log === true) await logChoice(']) assert.ok(route.includes(part), part)
  const apply = readFileSync(new URL('../../src/app/dashboard/apply/page.tsx', import.meta.url), 'utf8')
  assert.ok(!apply.includes("fetch('/api/resumes',{method:'POST',body:fd})"), 'Apply no longer uploads the tailored file as one more copy')
})
