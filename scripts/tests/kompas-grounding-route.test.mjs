import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = new URL('../../', import.meta.url)

function harness(options = {}) {
  const calls = []
  let dossiers = 0, vaults = 0
  const mocks = {
    '@/lib/authBoundary': { authenticatedUser: async () => ({ id: 'test-user' }) },
    '@/lib/llm': { keysFor: async () => { vaults++; return { openrouter: 'test-key' } }, resolveKeys: () => ({}) },
    '@/lib/rateLimit': { checkRateLimit: () => ({ ok: true }) },
    '@/lib/dossier': { dossierContext: async () => { dossiers++; return options.hungDossier ? new Promise(() => {}) : 'OLD GENERATED INCIDENT' } },
    '@/lib/sttLedger': { hashUserId: () => 'test-hash' },
    '@/lib/llmLedger': { scheduleLlmRecord: () => {} },
  }
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const module = { exports: {} }
    cache.set(file, module.exports)
    const js = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    runInNewContext(js, {
      module, exports: module.exports, process: { env: {} }, console,
      setTimeout, clearTimeout, AbortController, AbortSignal, Response, TextEncoder, TextDecoder, ReadableStream,
      fetch: async (_url, options) => {
        const body = JSON.parse(options.body)
        calls.push(body)
        if (body.stream) {
          return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: 'I check the certificate chain.' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n')
        }
        return Response.json({ choices: [{ message: { content: 'I check the certificate chain.' } }] })
      },
      require: (id) => mocks[id] || (id.startsWith('@/') ? load('src/' + id.slice(2) + '.ts') : require(id)),
    }, { filename: file })
    return module.exports
  }
  const route = load('src/app/api/kompas/answer/route.ts')
  const { NextRequest } = require('next/server')
  return {
    calls, get dossiers() { return dossiers }, get vaults() { return vaults },
    post: (body) => route.POST(new NextRequest('http://localhost/api/kompas/answer', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })),
  }
}

test('the actual answer route sends active resume and JD to the model, without remote dossier reads', async () => {
  const h = harness()
  const response = await h.post({ question: 'How do you troubleshoot TLS certificate errors?', config: {
    resume: 'Current role: Senior Security Engineer at Example Bank. '.repeat(8) + 'Maintained PKI and Venafi TPP.',
    jd: 'TCS requires highly available Root CA, Issuing CA, CRL, OCSP, HSM and Venafi automation.',
  } })
  assert.equal(response.status, 200)
  const prompt = h.calls[0].messages[1].content
  assert.match(prompt, /Maintained PKI and Venafi TPP/)
  assert.match(prompt, /TCS requires highly available Root CA/)
  assert.match(prompt, /never evidence of personal history/)
  assert.doesNotMatch(prompt, /OLD GENERATED INCIDENT/)
  assert.equal(h.dossiers, 0)
  assert.ok((await response.json()).meta.timing.total_ms >= 0)
})

test('derive gate rejects filler and extracts the latest question with no model, vault or dossier call', async () => {
  const h = harness()
  const quiet = await (await h.post({ deriveOnly: true, question: 'You: Okay.' })).json()
  assert.equal(quiet.noQuestion, true)
  const ask = await (await h.post({ deriveOnly: true,
    question: 'You: Yes so I checked the old service. Okay, so how do you configure certificate discovery in Venafi?',
  })).json()
  assert.match(ask.derived, /^How do you configure certificate discovery in Venafi/)
  assert.equal(h.calls.length, 0)
  assert.equal(h.dossiers, 0)
  assert.equal(h.vaults, 0)
})

test('streaming carries the same grounding and measures preparation and first content', async () => {
  const h = harness()
  const response = await h.post({ stream: true, question: 'What is vCert?', config: {
    resume: 'I administer Venafi TPP and automate certificates with vCert. '.repeat(5), jd: 'PKI Architect at TCS.',
  } })
  const stream = await response.text()
  assert.match(response.headers.get('content-type'), /event-stream/)
  assert.match(stream, /"type":"delta"/)
  assert.match(stream, /"preparation_ms":\d+/)
  assert.match(stream, /"first_ms":\d+/)
  assert.match(h.calls[0].messages[1].content, /PKI Architect at TCS/)
  assert.equal(h.dossiers, 0)
})

test('coding requests receive runnable code instructions rather than a narrative-only plan', async () => {
  const h = harness()
  const response = await h.post({ question: 'Give me a Python program for prime numbers.', config: { resume: 'Python automation.' } })
  assert.equal((await response.json()).meta.kind, 'code')
  assert.match(h.calls[0].messages[1].content, /complete and runnable/)
})


test('missing active sources cannot make a live turn wait indefinitely for the dossier', async () => {
  const h = harness({ hungDossier: true })
  const began = Date.now()
  const response = await h.post({ question: 'What is a certificate?' })
  assert.equal(response.status, 200)
  assert.ok(Date.now() - began < 1200)
  assert.equal(h.dossiers, 1)
})

test('a slow remote anchor lookup yields to live generation within its deadline', async () => {
  const scope = { AbortSignal, setTimeout, clearTimeout, KompasLevels: {
    sessionLevelsKey: () => 'session-key', maturityKey: () => 'maturity-key',
  }, fetch: async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })
  }) }
  runInNewContext(readFileSync(new URL('public/kompas/anchors.js', root), 'utf8'), scope)
  scope.KompasAnchors.db.get = async () => null
  const began = Date.now()
  const result = await scope.KompasAnchors.load('What is a certificate?', 'PKI', 'resume', 'session')
  assert.equal(result.source, 'miss')
  assert.ok(Date.now() - began < 800)
})


test('a blocked local anchor database cannot hold the live answer path', async () => {
  const scope = { AbortSignal, setTimeout, clearTimeout, KompasLevels: {
    sessionLevelsKey: () => 'session-key', maturityKey: () => 'maturity-key',
  } }
  runInNewContext(readFileSync(new URL('public/kompas/anchors.js', root), 'utf8'), scope)
  scope.KompasAnchors.db.get = () => new Promise(() => {})
  const began = Date.now()
  const result = await scope.KompasAnchors.load('What is a certificate?', 'PKI', 'resume', 'session')
  assert.equal(result.source, 'miss')
  assert.ok(Date.now() - began < 800)
})


test('asking about a protocol status code does not become a coding exercise', async () => {
  const h = harness()
  const response = await h.post({ question: 'What is HTTP status code 403?', config: { resume: 'API security.' } })
  assert.notEqual((await response.json()).meta.kind, 'code')
})
