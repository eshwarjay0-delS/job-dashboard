// A non-streaming {question} used to return HTTP 403 OPENROUTER_FORBIDDEN
// when the first OpenRouter model was blocked. The route tries three models
// and then Groq, and the caller never sees 403.
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
const GROQ = 'Revocation is the list I check before I trust a certificate.'

function loadRoute(mode) {
  const models = []
  const providers = []
  const mocks = {
    '@/lib/llm': {
      keysFor: async () => ({ openrouter: 'test-key', groq: 'groq-test' }),
      resolveKeys: () => ({ openrouter: 'test-key', groq: 'groq-test' }),
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
      fetch: async (url, options) => {
        const body = JSON.parse(options.body)
        if (String(url).includes('groq.com')) {
          return Response.json({ choices: [{ message: { content: GROQ } }] })
        }
        models.push(body.model)
        if (body.provider) providers.push({ model: body.model, provider: body.provider })
        const blocked = mode === 'groq' || (mode === 'third' && body.model !== 'google/gemini-2.5-flash')
        if (blocked) {
          return new Response(JSON.stringify({ error: { message: 'No endpoints available matching your data policy', code: 403 } }), { status: 403, headers: { 'content-type': 'application/json' } })
        }
        return Response.json({ choices: [{ message: { content: ANSWER } }], usage: { prompt_tokens: 8, completion_tokens: 24 } })
      },
      require: (id) => {
        if (mocks[id]) return mocks[id]
        if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts')
        if (id.startsWith('.')) {
          const base = posix.normalize(posix.join(posix.dirname(rel), id))
          for (const candidate of [base, base + '.ts', base + '.tsx', base + '.js']) {
            try { readFileSync(new URL(candidate, root)); return load(candidate) } catch { /* next */ }
          }
          return load(base + '.ts')
        }
        return require(id)
      },
    }, { filename: rel })
    return module.exports
  }
  const route = load('src/app/api/answer/route.ts')
  const { NextRequest } = require('next/server')
  return {
    models,
    providers,
    post(body) {
      return route.POST(new NextRequest('https://job-dashboard-fawn.vercel.app/api/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }))
    },
  }
}

const ask = {
  question: 'How does certificate revocation work?',
  config: { interviewer: 'engineer', level: 'engineer', length: 'balanced', resume: 'Senior Security Engineer. PKI, certificate issuance, and revocation.' },
}

test('a 403 on the first models falls through and the caller gets answer text', async () => {
  const third = loadRoute('third')
  const response = await third.post(ask)
  const body = await response.json()
  assert.equal(response.status, 200)
  const oss = third.providers.find((row) => row.model === 'openai/gpt-oss-120b')
  assert.ok(oss, 'gpt-oss was requested')
  assert.deepEqual(oss.provider.only, ['groq', 'fireworks', 'cerebras', 'together'])
  assert.equal(oss.provider.order, undefined)
  assert.deepEqual(third.models.slice(0, 3), [
    'meta-llama/llama-3.3-70b-instruct',
    'openai/gpt-oss-120b',
    'google/gemini-2.5-flash',
  ])
  assert.match(JSON.stringify(body), /certificate/)
  assert.equal(body.code, undefined)

  const groq = loadRoute('groq')
  const fallback = await groq.post(ask)
  const fallbackBody = await fallback.json()
  assert.equal(fallback.status, 200)
  assert.equal(fallbackBody.code, undefined)
  assert.match(JSON.stringify(fallbackBody), /Revocation is the list/)
  assert.doesNotMatch(JSON.stringify(fallbackBody), /OPENROUTER_FORBIDDEN|Sign in again/)
})
