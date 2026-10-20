// How often each resume was picked (kept in its folder's record), the record written for people to read beside it
// (_library.md), and the AI agent's answer read back. Owner, 19 Oct 2026: "have a MD file which basically tracks all the
// keywords ... every time those kind of resume frequency ... returns up high, you can just go to that MD file".
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { usedNow, shelfOnly, validLibrary, mergeLibraries, relabelEmail, libraryMarkdown, recordRun, emptyLibrary } from '../../src/lib/resume-library.ts'

const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
  const module = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8')
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process, console, Buffer, setTimeout,
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return module.exports
}

const APPSEC = 'a@x.com/AppSec Engineer/AppSec (tailored)__0123456789abcdef.docx'
const MINE = 'a@x.com/AppSec Engineer/My AppSec.docx'
const SOC = 'a@x.com/SOC Analyst/SOC.docx'

function library() {
  let lib = recordRun(emptyLibrary(), { path: APPSEC, email: 'a@x.com', category: 'AppSec Engineer', role: 'Application Security Engineer', company: 'Acme', depth: 1,
    jd: 'Application Security Engineer: Burp Suite, OWASP, threat modeling', asked: ['burp suite', 'owasp', 'threat modeling'], covers: ['burp suite', 'owasp', 'threat modeling'] }, Date.UTC(2026, 9, 18))
  lib = usedNow(usedNow(lib, MINE, Date.UTC(2026, 9, 17)), MINE, Date.UTC(2026, 9, 19))
  return usedNow(usedNow(lib, APPSEC, Date.UTC(2026, 9, 19)), SOC, Date.UTC(2026, 9, 19))
}

test('a pick is counted, kept through reading back, and each folder keeps only its own counts', () => {
  const lib = library()
  assert.equal(lib.uses[MINE].n, 2)
  assert.equal(lib.uses[APPSEC].n, 1)
  const back = validLibrary(JSON.parse(JSON.stringify(lib)))
  assert.deepEqual(back.uses, lib.uses)
  const appsec = shelfOnly(lib, 'a@x.com', 'AppSec Engineer')
  assert.deepEqual(Object.keys(appsec.uses).sort(), [APPSEC, MINE].sort())
  assert.ok(!appsec.uses[SOC], 'the SOC folder keeps its own count')
  // A path that tries to leave the library is not kept.
  assert.ok(!validLibrary({ version: 1, files: [], shelves: {}, uses: { '../x.docx': { n: 3, last: 1 }, '/etc/x': { n: 1, last: 1 } } }).uses)
})

test('two copies of a record joined count a pick once, and an email put right carries its counts', () => {
  const lib = library()
  assert.equal(mergeLibraries(lib, lib).uses[MINE].n, 2)
  const moved = relabelEmail({ ...lib, uses: { 'a@x.comlinkedin/AppSec Engineer/My AppSec.docx': { n: 4, last: 5 } } }, 'a@x.comlinkedin', 'a@x.com')
  assert.equal(moved.uses['a@x.com/AppSec Engineer/My AppSec.docx'].n, 4)
})

test('the readable record lists each resume with its keywords and picks, most picked first, and what the kind of job asks', () => {
  const md = libraryMarkdown(shelfOnly(library(), 'a@x.com', 'AppSec Engineer'), 'a@x.com', 'AppSec Engineer')
  assert.match(md, /^# AppSec Engineer/)
  assert.match(md, /Email: a@x\.com/)
  assert.match(md, /\| AppSec \(tailored\)__0123456789abcdef\.docx \| Application Security Engineer, Acme \| 2026-10-18 \| 1 \| 2026-10-19 \| burp suite, owasp, threat modeling \|/)
  assert.match(md, /\| My AppSec\.docx \| your own resume \| \| 2 \| 2026-10-19 \| \|/)
  assert.ok(!md.includes('SOC'), 'only this folder')
  assert.match(md, /## What this kind of job asks for/)
})

test('the agent must name one of the listed resumes, or its answer is not used', () => {
  const { parseAgentPick, agentPrompt } = load('src/lib/library-agent.ts', { '@/lib/storage': { blob: {} }, '@/lib/llm': {} })
  assert.deepEqual({ ...parseAgentPick('{"pick":2,"why":"same role"}', 3) }, { index: 1, why: 'same role' })
  assert.deepEqual({ ...parseAgentPick('```json\n{"pick": 1, "why": "x"}\n```', 2) }, { index: 0, why: 'x' })
  assert.equal(parseAgentPick('{"pick":4}', 3), null)
  assert.equal(parseAgentPick('{"pick":0}', 3), null)
  assert.equal(parseAgentPick('the second one', 3), null)
  const ranked = [
    { candidate: { path: '/u/a@x.com/AppSec Engineer/a.docx', folder: 'AppSec Engineer', name: 'AppSec', keywords: ['burp suite'], depth: 0, at: 1, email: 'a@x.com' }, shows: 1, of: 2 },
    { candidate: { path: '/u/a@x.com/SOC Analyst/s.docx', folder: 'SOC Analyst', name: 'SOC', keywords: ['splunk'], depth: 0, at: 2, email: 'a@x.com' }, shows: 0, of: 2 },
  ]
  const { user } = agentPrompt('AppSec role', ranked, { 'a@x.com/AppSec Engineer/a.docx': { n: 5, last: 1 } }, abs => abs.replace('/u/', ''))
  assert.match(user, /1\. title: AppSec \| file: AppSec \| folder: AppSec Engineer \| picked: 5 times \| shows 1 of 2 job keywords \| keywords: burp suite/)
  assert.match(user, /2\. title: SOC \| file: SOC \| folder: SOC Analyst/)
  assert.match(user, /^JOB TITLE: \(not stated\)/)
})

test('with one resume there is nothing to choose: no model is asked and no agreement is recorded', async () => {
  let asked = 0
  const { agentPick } = load('src/lib/library-agent.ts', { '@/lib/storage': { blob: {} }, '@/lib/llm': { callLLM: async () => { asked++; return { text: '{"pick":1}', model: 'm' } } } })
  const one = [{ candidate: { path: '/u/a.docx', folder: 'AppSec Engineer', name: 'a', keywords: [], depth: 0, at: 1, email: 'a@x.com' }, shows: 0, of: 0 }]
  assert.equal(await agentPick({ keys: { gemini: 'g' }, jd: 'x', ranked: one }), null)
  assert.equal(asked, 0)
})
