// Owner, 27 Oct 2026, two live faults held still:
// 1. "the carousel like a book from one to another still weren't working ... the data from previous request & response
//    is appearing half ass generation or completely invisible. It should be a clear function from start to end."
//    A new question aborted whatever was still streaming (that page kept half its answer), pressing AI Answer again
//    wiped the page it re-asked to "…" and rewrote it in place, a level change aborted other pages' answers, and a
//    press with no question left a blank "No question yet" page in the book.
// 2. Screen Answer on desktop 0.7 showed "Couldn't capture the screen — Could not start video source."
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const fnSrc = (name) => { let s = app.indexOf(`function ${name}(`); assert.ok(s >= 0, name); if (app.slice(s - 6, s) === 'async ') s -= 6; return app.slice(s, app.indexOf('\n}', s) + 2) }

test('a new question replaces only its own page\'s request; other pages finish in the background', () => {
  assert.doesNotMatch(app, /the newest question always wins/)
  assert.match(app, /if \(card\.req\) \{ try \{ card\.req\.abort\(\); \} catch \{\} \}\r?\n  const ctl = new AbortController\(\); answerCtl = ctl; card\.req = ctl; inflight\.add\(ctl\);/)
  assert.match(app, /\} finally \{ inflight\.delete\(ctl\);/)
  const reset = fnSrc('resetLiveState')
  assert.match(reset, /for \(const c of inflight\) \{ try \{ c\.abort\(\); \} catch \{\} \}/)   // leaving the session stops every page's request
  const regen = fnSrc('regenerateForAudience')
  assert.doesNotMatch(regen, /answerCtl\.abort\(\)/)                                          // a level change touches only this page
  assert.match(regen, /answerCtl === previous\) answerCtl = null;/)
})

test('pressing AI Answer again opens the next page and leaves the re-asked page as it was', () => {
  const press = fnSrc('aiAnswer')
  assert.match(press, /const page = addCard\(cur\.question, \["…"\]\);\r?\n\s+page\.heard = heard; page\.earlier = cur\.earlier \|\| ""; page\.formed = cur\.formed;\r?\n\s+showPressed\(page, heardOnly \? cur\.question : q\);\r?\n\s+return await generateAnswer\(heard, page,/)
  assert.doesNotMatch(press, /generateAnswer\(heard, cur,/)
  assert.match(press, /const page = hasAnswer\(c\) \? addCard\(c\.question, \["…"\]\) : c;/)
})

function pages(start, at) {
  const ctx = { cards: start.map((q) => ({ question: q, answer: [q + ' answer that is long enough'] })), idx: at, rendered: 0, topped: 0 }
  ctx.renderCard = () => { ctx.rendered++ }
  ctx.toTop = () => { ctx.topped++ }
  vm.createContext(ctx)
  vm.runInContext(`${fnSrc('hasAnswer')}\n${fnSrc('dropPage')}`, ctx)
  return ctx
}

test('an empty page leaves the book without moving the page you are reading', () => {
  let b = pages(['Q1', 'Q2', 'empty'], 2)                 // the empty page is in view: the one before it shows
  assert.equal(vm.runInContext('dropPage(cards[2])', b), true)
  assert.deepEqual([b.cards.map((c) => c.question), b.idx, b.topped], [['Q1', 'Q2'], 1, 1])
  b = pages(['Q1', 'empty', 'Q3'], 2)                     // reading Q3 while the page before it empties: Q3 stays in view, not scrolled
  vm.runInContext('dropPage(cards[1])', b)
  assert.deepEqual([b.cards[b.idx].question, b.topped], ['Q3', 0])
  b = pages(['empty', 'Q2'], 0)
  vm.runInContext('dropPage(cards[0])', b)
  assert.deepEqual([b.cards[b.idx].question, b.cards.length], ['Q2', 1])
  b = pages(['only'], 0)                                  // the live view always keeps one page
  assert.equal(vm.runInContext('dropPage(cards[0])', b), false)
  assert.equal(b.cards.length, 1)
  assert.equal(vm.runInContext('hasAnswer({ answer: ["…"] })', b), false)
  assert.equal(vm.runInContext('hasAnswer({ answer: "A finished answer.", streaming: true })', b), false)
  assert.equal(vm.runInContext('hasAnswer({ answer: ["A finished answer, line one."] })', b), true)
  assert.match(app, /if \(!dropPage\(card\)\) \{ card\.answer = \[\]; card\.question = "No question yet";/)
})

function streamCtx(results, desktop = { captureScreen: async () => '' }) {
  const calls = []
  const stopped = []
  const ctx = {
    window: { kompasDesktop: desktop }, calls, stopped, setTimeout: (f) => f(),
    navigator: { mediaDevices: { getDisplayMedia: async (c) => {
      calls.push(JSON.stringify(c))
      const r = results.shift()
      if (r instanceof Error) throw r
      return { getAudioTracks: () => [{ stop: () => stopped.push('audio') }], getVideoTracks: () => [{ readyState: 'live' }] }
    } } },
  }
  vm.createContext(ctx)
  vm.runInContext(fnSrc('screenStream'), ctx)
  return ctx
}
const named = (name, message) => Object.assign(new Error(message), { name })

test('Screen Answer retries a refused stream once, the way call audio asks, and lets its audio go', async () => {
  const ctx = streamCtx([named('NotReadableError', 'Could not start video source'), 'ok'])
  const s = await vm.runInContext('screenStream()', ctx)
  assert.ok(s.getVideoTracks().length)
  assert.deepEqual(ctx.calls, ['{"video":true,"audio":false}', '{"video":true,"audio":true}'])
  assert.deepEqual(ctx.stopped, ['audio'])
})

test('when Windows still refuses, the card says what happened and what to do; a cancel stays a cancel', async () => {
  let ctx = streamCtx([named('NotReadableError', 'Could not start video source'), named('NotReadableError', 'Could not start video source')])
  await assert.rejects(vm.runInContext('screenStream()', ctx), /Windows would not start screen capture in this Kompas window \(Could not start video source\)\. Close Kompas fully and open it again, then press Screen Answer\./)
  // An old desktop build (no native capture) says so: reopening it from the website only reopened the 7 Oct runtime.
  ctx = streamCtx([named('NotReadableError', 'Could not start video source'), named('NotReadableError', 'Could not start video source')], {})
  await assert.rejects(vm.runInContext('screenStream()', ctx), /older desktop build \(before 0\.8\) that cannot capture the screen \(Could not start video source\)\. Close it, then open Kompas once from the Kompas icon on your desktop\./)
  ctx = streamCtx([named('NotAllowedError', 'Permission denied')])
  await assert.rejects(vm.runInContext('screenStream()', ctx), (e) => e.name === 'NotAllowedError')
  assert.equal(ctx.calls.length, 1)
})

test('a refused native capture still tries the stream path', () => {
  const grab = fnSrc('grabFrame')
  assert.match(grab, /try \{ return await window\.kompasDesktop\.captureScreen\(\); \} catch \(e\) \{ nativeError = e; \}/)
  assert.match(grab, /s = await screenStream\(\);/)
  assert.doesNotMatch(grab, /getDisplayMedia\(\{ video: true, audio: false \}\)/)   // every stream request goes through screenStream
})

test('the update offer compares the page with its own stamp, so it shows only when there is an update', () => {
  assert.match(app, /fetch\("version\.json\?t=" \+ Date\.now\(\), \{ cache: "no-store" \}\)/)
  const html = readFileSync(new URL('../../public/kompas/index.html', import.meta.url), 'utf8')
  const stamp = (html.match(/window\.PERFACT_BUILD = "([^"]+)"/) || [])[1]
  const own = JSON.parse(readFileSync(new URL('../../public/kompas/version.json', import.meta.url), 'utf8')).build
  assert.equal(own, stamp)
})
