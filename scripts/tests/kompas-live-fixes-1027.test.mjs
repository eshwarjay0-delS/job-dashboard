// His live session on 27 Oct 2026, held still: a level change gave the introduction, Prev/Next looked dead, the answer
// rode the bottom while generating, an invisible question held empty space on the desktop, "Shkivs" for SSH keys, the
// transcript read as a log instead of a chat, and answers waited on whichever host OpenRouter picked.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const app = read('public/kompas/app.js')
const fnSrc = (name) => { const s = app.indexOf(`function ${name}(`); return app.slice(s, app.indexOf('\n}', s) + 2) }

test('a level change answers the question already on the card, pinned and whole, on both paths', () => {
  const regen = fnSrc('regenerateForAudience')
  const calls = regen.match(/generateAnswer\([^;]+\);/g) || []
  assert.equal(calls.length, 4)
  for (const c of calls) { assert.match(c, /pinned: true/, c); assert.match(c, /derived: /, c) }
})

test('rendering never drags the pane down while an answer streams', () => {
  const render = fnSrc('renderCard')
  assert.doesNotMatch(render, /scrollTop = ul\.scrollHeight/)
  assert.match(render, /ul\.scrollTop = keep;/)
})

test('Prev and Next show where you are and look disabled at the ends', () => {
  const render = fnSrc('renderCard')
  assert.match(render, /\$\("cardCount"\)\.textContent = cards\.length > 1 \? `\$\{idx \+ 1\} of \$\{cards\.length\}` : ""/)
  assert.match(render, /\$\("prevBtn"\)\.disabled = idx <= 0/)
  assert.match(render, /\$\("nextBtn"\)\.disabled = idx >= cards\.length - 1/)
  const html = read('public/kompas/index.html')
  assert.ok(html.indexOf('id="prevBtn"') < html.indexOf('id="cardCount"') && html.indexOf('id="cardCount"') < html.indexOf('id="nextBtn"'))
  assert.match(read('public/kompas/styles.css'), /\.pill:disabled\{opacity:\.42/)
})

test('on the desktop a scrolled-away question takes no space, and a shown one is two lines', () => {
  const css = read('public/kompas/styles.css')
  assert.match(css, /#view-copilot \.card\.q-away \.q\{max-height:0!important;margin-bottom:0!important;padding-top:0!important;padding-bottom:0!important;border-bottom-width:0!important/)
  assert.match(css, /#view-copilot \.card \.q\{max-height:3\.1em\}/)
})

test('"Shkivs" and "cyber-arc" are repaired before they reach a question', () => {
  const s = app.indexOf('const PHRASE_FIXES')
  const table = vm.runInNewContext(app.slice(app.indexOf('[', s), app.indexOf('function fixPhrases')).trim().replace(/;\s*$/, ''))
  const fix = (t) => table.reduce((x, [re, rep]) => x.replace(re, rep), t)
  assert.equal(fix('How does CyberArk contribute to the protection of Shkivs?'), 'How does CyberArk contribute to the protection of SSH keys?')
  assert.equal(fix('Session recording and cyber-arc captured.'), 'Session recording and CyberArk captured.')
  assert.equal(fix('rotate the shkiv'), 'rotate the SSH key')
  assert.equal(fix('see the scale of the issue'), 'see the scale of the issue')
})

test('the live transcript reads as a chat: one bubble per turn, fillers folded in', () => {
  const dom = new JSDOM('<div id="drawerBody"><div class="muted small">Nothing heard yet.</div></div>')
  const ctx = vm.createContext({ document: dom.window.document, $: (id) => dom.window.document.getElementById(id), Date })
  vm.runInContext(app.slice(app.indexOf('const DRAWER_FILLER'), app.indexOf('function renderDrawer(')), ctx)
  const t0 = 1_000_000
  ctx.appendDrawer('You', 'Permanent.', t0)
  ctx.appendDrawer('You', 'and', t0 + 1000)
  ctx.appendDrawer('You', 'and Evaluate', t0 + 2000)
  ctx.appendDrawer('Them', 'How would you rotate SSH keys?', t0 + 3000)
  ctx.appendDrawer('You', 'and', t0 + 4000)
  ctx.appendDrawer('You', 'First I inventory them.', t0 + 60000)
  const rows = [...dom.window.document.querySelectorAll('#drawerBody .tl')].map((d) => d.className + ': ' + d.querySelector('span').textContent)
  assert.deepEqual(rows, ['tl you: Permanent. and and Evaluate', 'tl them: How would you rotate SSH keys?', 'tl you: and', 'tl you: First I inventory them.'])
})

test('every live answer call is routed to the lowest-latency host', () => {
  const route = read('src/lib/kompasAnswerService.ts')   // the engine moved here from the route on 27 Oct
  assert.match(route, /const LIVE_ROUTING = \{ allow_fallbacks: true, sort: "latency" \}/)
  assert.equal((route.match(/provider: LIVE_ROUTING/g) || []).length, 3)
  assert.doesNotMatch(route, /provider: \{ allow_fallbacks: true \}/)
})

// Owner, 27 Oct 2026: "never showcase any unnecessary things to user. Only show what was needed to him."
test('the live screen shows only what he needs: no build-progress bar, no timings, no engine notes', () => {
  const html = read('public/kompas/index.html')
  assert.doesNotMatch(html, /id="dossier"|dossierText|dossierFill/)
  assert.doesNotMatch(app, /showDossierProgress/)
  const said = (app.match(/status\((?:"[^"]*"|`[^`]*`)/g) || []).join('\n')
  for (const internal of [/no (?:AI|model) call/i, /first words in/, /two anchors/, /opening book/, /paid answer service/, /dossier/i, /sections will be used/, /core Q&A/])
    assert.doesNotMatch(said, internal)
  assert.match(said, /status\("Answered\."/)
})
