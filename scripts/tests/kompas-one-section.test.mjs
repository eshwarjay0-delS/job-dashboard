// Owner, 27 Oct 2026: "combine both You and question section. The You starts to appear whenever them speaking."
// The live line now sits inside the question box, and the interviewer heard back through the speakers is not "You".
// Runs the page's own functions sliced out of public/kompas/app.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const html = readFileSync(new URL('../../public/kompas/index.html', import.meta.url), 'utf8')
const fnSrc = (name) => { const s = app.indexOf(`function ${name}(`); assert.ok(s >= 0, name); return app.slice(s, app.indexOf('\n}', s) + 2) }
const stop = app.slice(app.indexOf('const INTAKE_STOP'), app.indexOf(';', app.indexOf('const INTAKE_STOP')) + 1)

function page({ themVoiced = false, streaming = false, collapsed = false } = {}) {
  const dom = new JSDOM(`<div class="card${collapsed ? ' q-away' : ''}" id="card"><div class="q"><span class="q-ico">💬</span><span class="q-body"><b>Question:</b> <span id="question">Q</span><span class="caption hidden" id="caption"><span class="cap-who" id="capWho">Them</span><span class="cap-text" id="capText"></span></span></span></div></div>`)
  const timers = []
  const ctx = {
    $: (id) => dom.window.document.getElementById(id), performance: { now: () => 100000 }, Date,
    captures: [{ who: 'Them', stopped: false, voiced: themVoiced, lastVoice: themVoiced ? 99900 : 0 }, { who: 'You', stopped: false }],
    cards: [{ question: 'Q', streaming }], idx: 0, capTimer: null, running: true,
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length }, clearTimeout: () => {},
    fixTerms: (t) => t, fixPhrases: (t) => t, follow: { on: false }, transcript: [], heardSeq: 0, answerCtl: null,
    drawer: [], logged: [], heardDraft: () => '', pendingHeard: () => [], status: () => {}, updatePending: () => {}, scheduleAuto: () => {}, flushing: false,
  }
  ctx.logEvent = (e) => ctx.logged.push(e)
  ctx.appendDrawer = (who, text) => ctx.drawer.push(who + ': ' + text)
  vm.createContext(ctx)
  vm.runInContext(['let themLines = [];', stop, fnSrc('intakeWords'), fnSrc('echoShare'), fnSrc('noteThem'), fnSrc('themSpeaking'), fnSrc('echoOfThem'), fnSrc('showCaption'), fnSrc('onTranscript')].join('\n'), ctx)
  return { ctx, dom, timers, doc: dom.window.document }
}

test('the line being said sits inside the question box, under the question', () => {
  const d = new JSDOM(html).window.document
  const q = d.querySelector('#card .q')
  assert.ok(q.contains(d.getElementById('caption')), 'the caption is part of the question section')
  assert.ok(q.contains(d.getElementById('question')))
  assert.equal(d.querySelectorAll('#caption').length, 1)
  const { ctx, doc } = page()
  vm.runInContext('showCaption("Them", "How would you rotate SSH keys", true)', ctx)
  assert.equal(doc.getElementById('capText').textContent, 'How would you rotate SSH keys')
  assert.equal(doc.getElementById('question').textContent, 'Q', 'the question stays')
  assert.ok(doc.querySelector('.q').classList.contains('live'))
})

test('while they are speaking, no You caption appears', () => {
  const { ctx, doc } = page({ themVoiced: true })
  vm.runInContext('showCaption("Them", "Walk me through your incident response", true)', ctx)
  vm.runInContext('showCaption("You", "walk me through", true)', ctx)
  assert.equal(doc.getElementById('capWho').textContent, 'Them')
  assert.equal(doc.getElementById('capText').textContent, 'Walk me through your incident response')
})

test('a You line that repeats what they just said is dropped; your own words are kept', () => {
  const { ctx } = page()
  vm.runInContext('onTranscript("Them", "How would you investigate certificate chain construction and revocation checks?")', ctx)
  vm.runInContext('onTranscript("You", "investigate certificate chain construction revocation")', ctx)
  assert.deepEqual(ctx.transcript.map((t) => t.who), ['Them'])
  assert.equal(ctx.logged.filter((e) => e.t === 'echo').length, 1)
  vm.runInContext('onTranscript("You", "I would start with the CAPI2 operational log on one failing endpoint")', ctx)
  assert.deepEqual(ctx.transcript.map((t) => t.who), ['Them', 'You'])
})

test('a You line that arrives while they are still talking is looked at again once their words are in', () => {
  const { ctx, timers } = page({ themVoiced: true })
  vm.runInContext('onTranscript("You", "rotate the SSH keys across the fleet")', ctx)
  assert.equal(ctx.transcript.length, 0, 'held, not added yet')
  assert.equal(timers.at(-1).ms, 2000)
  vm.runInContext('onTranscript("Them", "How would you rotate the SSH keys across the fleet?")', ctx)
  timers.at(-2).f()                                       // the second look: it was their sentence
  assert.deepEqual(ctx.transcript.map((t) => t.who), ['Them'])
})

test('a new question from them brings a tucked-away box back; your speech or a page still being written does not', () => {
  let p = page({ collapsed: true })
  vm.runInContext('showCaption("Them", "Next question", true)', p.ctx)
  assert.equal(p.doc.getElementById('card').classList.contains('q-away'), false)
  p = page({ collapsed: true })
  vm.runInContext('showCaption("You", "I would check the logs", true)', p.ctx)
  assert.equal(p.doc.getElementById('card').classList.contains('q-away'), true)
  p = page({ collapsed: true, streaming: true })
  vm.runInContext('showCaption("Them", "Next question", true)', p.ctx)
  assert.equal(p.doc.getElementById('card').classList.contains('q-away'), true)
})
