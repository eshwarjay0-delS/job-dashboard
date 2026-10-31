import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
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
  const window = { fetch: (input, opts) => { calls.push([input, opts]); return Promise.resolve(new Response('')) } }   // the answer path reads the reply
  // The script must PARSE. From 11 Oct 16:51 to 12 Oct 2026 it did not (a stray "};" at its end), so none of it ran on the
  // live page: no Kompas call was routed to the engine from the dashboard address, and a session there could not start.
  const shim = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  assert.doesNotThrow(() => new vm.Script(shim), 'the mount script is valid JavaScript')
  // It also paints the credits pill, so it needs a page to look at. A bare one is enough here. Since 633c4a9d (13 Oct)
  // it also re-points the old Kompas.exe download links, so the page answers querySelectorAll with none.
  const document = { readyState: 'complete', getElementById: () => null, querySelectorAll: () => [], documentElement: {}, addEventListener() {} }
  vm.runInNewContext(shim, { window, URL, Request, document, MutationObserver: class { observe() {} }, setInterval() {}, location: { origin: 'https://dashboard.test', href: 'https://dashboard.test/dashboard/kompas' } })
  window.fetch('/api/answer', { method: 'POST', body: 'question' })
  window.fetch('/version.json?t=1')
  window.fetch(new Request('https://dashboard.test/api/levels', { method: 'POST', body: 'anchors' }))
  window.fetch('https://other.test/api/public')
  // Self-hosted since 14 Oct (67f59869): calls go to MarketFit's own /api/kompas/*, and the build check reads the
  // stamp written beside Kompas's index.html (a hand-kept root copy lagged a release on 23 Oct).
  assert.equal(calls[0][0].pathname, '/api/kompas/answer')
  assert.equal(calls[0][1].body, 'question')
  assert.equal(calls[1][0].pathname, '/kompas/version.json')
  assert.equal(calls[1][0].search, '?t=1')
  assert.equal(calls[2][0].url, 'https://dashboard.test/api/kompas/levels')
  assert.equal(calls[2][0].method, 'POST')
  assert.equal(calls[3][0], 'https://other.test/api/public')
})
test('all assets use the canonical release before stale public files', async () => {
  // The release is public/kompas itself (scripts/sync-kompas.mjs); every page entry goes through the shell, and no
  // rewrite sends Kompas files to another deployment any more.
  const rules = await require('../../next.config.js').rewrites()
  for (const source of ['/dashboard/kompas', '/kompas', '/kompas/index.html'])
    assert.equal(rules.beforeFiles.find(r=>r.source===source)?.destination, '/api/kompas/shell', source)
  const all = [...rules.beforeFiles, ...rules.afterFiles, ...rules.fallback]
  assert.ok(!all.some(r=>/^https?:/.test(r.destination)), 'no Kompas rewrite leaves this origin')
  // One release stamp: the build the page announces is the build the update check reads.
  const read = p => readFileSync(new URL('../../public/' + p, import.meta.url), 'utf8')
  const stamped = read('kompas/index.html').match(/window\.PERFACT_BUILD = "([^"]+)"/)[1]
  assert.equal(JSON.parse(read('kompas/version.json')).build, stamped)
})
test('upstream error pages cannot masquerade as a working shell', () => {
  assert.throws(()=>mountKompasHtml('<html><head></head><body>Not found</body></html>'))
})

test('canonical hosted workspace exposes shared chats without changing native assets or local session controls', () => {
  const source = readFileSync(new URL('../../public/kompas/index.html', import.meta.url), 'utf8')
  const mounted = mountKompasHtml(source)
  const dashboard = mounted.match(/<section[^>]*id="view-dashboard"[\s\S]*?<\/section>/)[0]
  assert.ok(!source.includes('id="mfSharedChats"'), 'packaged native source stays unchanged')
  assert.equal((dashboard.match(/id="mfSharedChats"/g) || []).length, 1)
  assert.match(dashboard, /href="\/dashboard\/kompas\/shared"/)
  assert.match(dashboard, /sessions sync across your signed-in devices/)
  assert.match(dashboard, /id="newSessionBtn"/)
  assert.match(dashboard, /id="sessionList"/)
  assert.equal((mountKompasHtml(mounted).match(/id="mfSharedChats"/g) || []).length, 1)
  const scripts = text => [...text.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(scripts(mounted), scripts(source))
  const catalog = readFileSync(new URL('../../src/app/dashboard/kompas/shared/page.tsx', import.meta.url), 'utf8')
  assert.match(catalog, /<a href="\/dashboard\/kompas">Back to Kompas workspace<\/a>/, 'shell return uses a full document navigation')
})
