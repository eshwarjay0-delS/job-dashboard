// A desktop AI Answer has no browser cookie and no bearer token. Skip-login
// still answers as the Houston owner. Admin stays closed to that owner.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { posix } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = new URL('../../', import.meta.url)
const ANSWER = 'I check certificate issuance and revocation before I trust a certificate.'

function loadRoute(file) {
  const calls = []
  const mocks = {
    '@/lib/llm': {
      keysFor: async () => ({ openrouter: 'test-key' }),
      resolveKeys: () => ({ openrouter: 'test-key', groq: '' }),
    },
    '@/lib/llmLedger': { scheduleLlmRecord: () => {} },
    '@/lib/dossier': { dossierContext: async () => '' },
    '@/lib/rateLimit': { checkRateLimit: () => ({ ok: true }) },
  }
  const cache = new Map()
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const module = { exports: {} }
    cache.set(rel, module.exports)
    const js = ts.transpileModule(readFileSync(new URL(rel, root), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    runInNewContext(js, {
      module, exports: module.exports, process: { env: {} }, console,
      setTimeout, clearTimeout, AbortController, AbortSignal, Response, TextEncoder, TextDecoder, ReadableStream, URL, Headers,
      fetch: async () => {
        const chunk = JSON.stringify({ choices: [{ delta: { content: ANSWER }, finish_reason: null }] })
        const end = JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 18 } })
        return new Response('data: ' + chunk + '\n\ndata: ' + end + '\n\ndata: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        })
      },
      require: (id) => {
        if (mocks[id]) return mocks[id]
        if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts')
        if (id.startsWith('.')) {
          const base = posix.normalize(posix.join(posix.dirname(rel), id))
          for (const candidate of [base, base + '.ts', base + '.tsx', base + '.js']) {
            try { readFileSync(new URL(candidate, root)); return load(candidate) } catch { /* try the next suffix */ }
          }
          return load(base + '.ts')
        }
        return require(id)
      },
    }, { filename: rel })
    return module.exports
  }
  const route = load(file)
  const { NextRequest } = require('next/server')
  return {
    calls,
    post(pathname, body) {
      return route.POST(new NextRequest('https://job-dashboard-fawn.vercel.app' + pathname, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'kompas://app',
          'x-kompas-client': 'desktop',
        },
        body: JSON.stringify(body),
      }))
    },
  }
}

test('a desktop request with no cookie and no token gets a full answer', async () => {
  const harness = loadRoute('src/app/api/answer/route.ts')
  const response = await harness.post('/api/answer', {
    question: 'Tell me about PKI.',
    pinned: true,
    stream: true,
    config: {
      interviewer: 'engineer',
      level: 'engineer',
      length: 'balanced',
      resume: 'Senior Security Engineer. PKI, certificate issuance, and revocation.',
    },
  })
  const body = await response.text()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /event-stream/)
  assert.match(body, /certificate issuance and revocation/)
  assert.doesNotMatch(body, /Sign in again/)
  assert.doesNotMatch(body, /signed_out/)

  const bridge = loadRoute('src/app/api/kompas/aside/route.ts')
  const aside = await bridge.post('/api/kompas/aside', {
    question: 'Tell me about PKI.',
    transcript: 'Interviewer: Tell me about PKI.',
  })
  const asideBody = await aside.text()
  assert.equal(aside.status, 200)
  assert.doesNotMatch(asideBody, /Sign in again/)

  const admin = readFileSync(new URL('../../src/lib/adminAccess.ts', import.meta.url), 'utf8')
  assert.match(admin, /if \(!user \|\| user\.synthetic\) return null/)
  const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /Sign in again, then press AI Answer/)
})
