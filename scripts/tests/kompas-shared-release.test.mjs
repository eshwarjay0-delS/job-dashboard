import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { mountKompasHtml } from '../../src/lib/kompas-shell.ts'
const require = createRequire(import.meta.url)
test('mount keeps all canonical scripts and loads them under the dashboard origin', () => {
  const source = '<html><head><script src="https://cdn.example/a.js"></script></head><body id="view-dashboard"><script src="feedback.js"></script><script src="qbank.js"></script></body></html>'
  const html = mountKompasHtml(source)
  assert.ok(html.includes('<base href="/kompas/">'))
  assert.ok(html.includes('src="feedback.js"'))
  assert.ok(html.includes('src="qbank.js"'))
  assert.ok(html.includes('src="https://cdn.example/a.js"'))
  const calls = []
  const window = { fetch: (input, opts) => { calls.push([input, opts]); return Promise.resolve() } }
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], { window, URL, Request, location: { origin: 'https://dashboard.test', href: 'https://dashboard.test/dashboard/kompas' } })
  window.fetch('/api/answer', { method: 'POST', body: 'question' })
  window.fetch('/version.json?t=1')
  window.fetch(new Request('https://dashboard.test/api/levels', { method: 'POST', body: 'anchors' }))
  window.fetch('https://other.test/api/public')
  assert.equal(calls[0][0].pathname, '/kompas/api/answer')
  assert.equal(calls[0][1].body, 'question')
  assert.equal(calls[1][0].pathname, '/kompas/version.json')
  assert.equal(calls[1][0].search, '?t=1')
  assert.equal(calls[2][0].url, 'https://dashboard.test/kompas/api/levels')
  assert.equal(calls[2][0].method, 'POST')
  assert.equal(calls[3][0], 'https://other.test/api/public')
})
test('all assets use the canonical release before stale public files', async () => {
  const rules = await require('../../next.config.js').rewrites()
  assert.equal(rules.beforeFiles.find(r=>r.source==='/dashboard/kompas').destination, '/api/kompas/shell')
  assert.ok(rules.beforeFiles.some(r=>r.source==='/kompas/:path+' && r.destination.endsWith('/:path+')))
})
test('upstream error pages cannot masquerade as a working shell', () => {
  assert.throws(()=>mountKompasHtml('<html><head></head><body>Not found</body></html>'))
})
