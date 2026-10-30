// Speed r6 (29 Oct 2026): the real answer route, model mocked, offline. Personal history streams sentence by sentence
// through the guard gate; an invented figure never reaches a delta; the final replace still runs the full guards.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { posix } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const req = createRequire(import.meta.url)
const ROOT = new URL('../../', import.meta.url)

function route({ pieces, env = {} }) {
  const seen = { modelCalls: 0 }
  const stubs = {
    '@/lib/authBoundary': { authenticatedUser: async () => ({ id: 'speed-user' }) },
    '@/lib/llm': { keysFor: async () => ({ openrouter: 'offline-key' }), resolveKeys: () => ({}) },
    '@/lib/rateLimit': { checkRateLimit: () => ({ ok: true }) },
    '@/lib/dossier': { dossierContext: async () => '' },
    '@/lib/sttLedger': { hashUserId: () => 'h' },
    '@/lib/llmLedger': { scheduleLlmRecord: () => {} },
  }
  const sse = (texts) => texts.map((t) => 'data: ' + JSON.stringify({ choices: [{ delta: { content: t } }] }) + '\n\n').join('') +
    'data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n'
  const loaded = new Map()
  const load = (file) => {
    if (loaded.has(file)) return loaded.get(file)
    const mod = { exports: {} }
    loaded.set(file, mod.exports)
    const js = ts.transpileModule(readFileSync(new URL(file, ROOT), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    runInNewContext(js, {
      module: mod, exports: mod.exports, process: { env }, console: { ...console, info: () => {} },
      setTimeout, clearTimeout, AbortController, AbortSignal, Response, TextEncoder, TextDecoder, ReadableStream,
      fetch: async (_u, init) => {
        seen.modelCalls++
        const body = JSON.parse(init.body)
        return body.stream ? new Response(sse(pieces)) : Response.json({ choices: [{ message: { content: pieces.join('') } }] })
      },
      require: (id) => stubs[id] || (id.startsWith('@/') ? load('src/' + id.slice(2) + '.ts')
        : id.startsWith('.') ? load(posix.normalize(posix.join(posix.dirname(file), id.replace(/\.ts$/, '')) + '.ts')) : req(id)),
    }, { filename: file })
    return mod.exports
  }
  const { POST } = load('src/app/api/kompas/answer/route.ts')
  const { NextRequest } = req('next/server')
  return { seen, post: async (body) => {
    const res = await POST(new NextRequest('http://localhost/api/kompas/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
    return (await res.text()).split('\n\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)))
  } }
}
const RESUME = 'Riley Moss\nEXPERIENCE\nCloud Security Engineer, Northwind Bank (2021 - present)\n' +
  '- Led incident response for a leaked API key: rotated the key in KMS, scoped the blast radius and wrote the post-incident review.\n' +
  '- Wrote Terraform guardrails that block public S3 buckets before deployment.\n'
const ASK = { stream: true, question: 'Tell me about a time you handled a leaked API key.', config: { resume: RESUME, level: 'engineer' } }
const PIECES = ['I rotated the leaked API key ', 'in KMS the same day. ', 'That cut response time by 75%. ', 'Then I wrote the post-incident review.']

test('personal history: a clean first sentence is shown before the final answer, the invented figure never is', async () => {
  const ev = await route({ pieces: PIECES }).post(ASK)
  const meta = ev.find((e) => e.type === 'meta')
  assert.equal(meta.streamPolicy, 'guarded-sentence')
  const deltas = ev.filter((e) => e.type === 'delta')
  const replaceAt = ev.findIndex((e) => e.type === 'replace')
  assert.ok(deltas.length >= 1, 'a sentence was released early')
  assert.ok(ev.indexOf(deltas[0]) < replaceAt, 'released before the final replace')
  assert.match(deltas[0].text, /rotated the leaked API key/)
  assert.ok(deltas.every((d) => !/75%/.test(d.text)), 'the invented figure is never streamed')
  assert.ok(deltas.every((d) => !/post-incident review/.test(d.text)), 'nothing after a failing sentence is streamed')
  assert.ok(replaceAt > 0 && !/75%/.test(ev[replaceAt].text), 'the final answer still has the figure removed')
  assert.ok(ev.find((e) => e.type === 'done').timing.visible_first_ms >= 0)
})
test('switch off: KOMPAS_SENTENCE_STREAM=0 holds everything to the final replace, as before', async () => {
  const ev = await route({ pieces: PIECES, env: { KOMPAS_SENTENCE_STREAM: '0' } }).post(ASK)
  assert.equal(ev.find((e) => e.type === 'meta').streamPolicy, 'guarded-final')
  assert.equal(ev.filter((e) => e.type === 'delta').length, 0)
  assert.ok(ev.some((e) => e.type === 'replace' && e.text))
})
test('a provider error streamed as text is never shown and never becomes the answer', async () => {
  const ev = await route({ pieces: ['Error: 429 Too Many Requests. ', 'Provider returned error.'] }).post(ASK)
  assert.ok(ev.filter((e) => e.type === 'delta').every((d) => !/error|429/i.test(d.text)))
  const finalText = ev.filter((e) => e.type === 'replace').map((e) => e.text).pop() || ''
  assert.doesNotMatch(finalText, /429|Provider returned error/i)
})
