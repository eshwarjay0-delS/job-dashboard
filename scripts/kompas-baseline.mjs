#!/usr/bin/env node
// KOMPAS BASELINE CONTRACT. Runs before every build ("prebuild" in package.json), so it gates both deploy paths (Vercel's
// own GitHub deploy and .github/workflows/deploy.yml). If any check fails the build fails and production stays on the
// last good deploy.
//
// Owner, 27 Oct 2026: "make it stay super duper relevant. The question that should be happening, and also the response
// should be super relevant, and make this a consistent build. Like if some AI or some person would change something in
// the future, that should not like fully demolish the app baseline feature like this. Never."
//
// What broke that day (read back from his desktop session log): every AI Answer press after the first was treated as a
// re-press of the page on screen, so the PREVIOUS question was formed again and answered; mic-only lines glued his own
// reply into the question; Director answers invented a "decision owner, Alice Smith" and made him the CISO.
//
// Change a check here only when the owner changes the rule it holds, and say so in the commit.
// Plain Node (18+): the server modules are compiled with the project's own TypeScript, so this runs on the Node 20
// that deploy.yml builds with.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = new URL('..', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')
const failures = []
const checks = []
const check = async (name, fn) => { checks.push(name); try { await fn() } catch (e) { failures.push(`${name}\n    ${e && e.message || e}`) } }
const eq = (got, want, what) => { if (got !== want) throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`) }
const ok = (v, what) => { if (!v) throw new Error(what) }

// ---------------------------------------------------------------- server modules, compiled in memory
let ts = null
try { ts = require('typescript') } catch { /* reported below */ }
function loadTs(path) {
  const out = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const mod = { exports: {} }
  vm.runInNewContext(out, { module: mod, exports: mod.exports, require, console })
  return mod.exports
}
const A = ts ? loadTs('src/lib/kompasAnswer.ts') : null
const R = ts ? loadTs('src/lib/kompasDesktopResponse.ts') : null

// ---------------------------------------------------------------- the page's own question intake, from public/kompas/app.js
const app = read('public/kompas/app.js')
function slice(start, end) {
  const a = app.indexOf(start), b = app.indexOf(end, a)
  if (a < 0 || b < 0) throw new Error(`public/kompas/app.js no longer has "${start}" ... "${end}"`)
  return app.slice(a, b)
}
function livePage() {
  const asked = []
  const s = {
    aiBusy: false, aiBusySince: 0, autoTimer: null, transcriptionEpoch: 0, transcriptionFailedEpoch: -1,
    running: false, captures: [], finals: new Set(), flushing: false, heardSeq: 0, answeredSeq: 0, transcript: [],
    cards: [{ question: 'Ready', answer: ['Press Start — both your mic and the call audio are on by default.'] }], idx: 0,
    box: { value: '' },
    pendingHeard() { return s.transcript.filter((t) => t.seq > s.answeredSeq) },
    updatePending() {}, flushHeard: async () => {}, setChat() {}, status() {}, logEvent() {}, renderCard() {}, toTop() {},
    animateCard() {}, clearTimeout() {}, plainAnswer: (a) => (Array.isArray(a) ? a.join(' ') : String(a)), questionSource: () => 'You',
  }
  s.$ = (id) => (id === 'manualInput' ? s.box : { classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, title: '', textContent: '' })
  s.addCard = (q, answer) => { const c = { question: q, answer }; s.cards.push(c); s.idx = s.cards.length - 1; return c }
  // The server, as the live engine does it: a pinned or typed question is answered whole; heard-only is cut by the
  // server's own cutQuestion, and nothing question-like is "no question" (the empty page leaves the book).
  // The engine's answer to each question, the way it explains it (the candidate then says it in his own words).
  const ENGINE = [
    [/past projects/i, 'I secure banking platforms, integrating SIEM tools and automating endpoint rollouts across the estate.'],
    [/dependency confusion/i, 'Dependency confusion happens when a build resolves an internal package name from a public registry, so a public package with the same name as an internal one gets pulled into the build.'],
    [/multiple security tools/i, 'I correlate the findings on one asset and one root cause, deduplicate them into a single tracked vulnerability, and keep each tool as evidence.'],
  ]
  const previousTurns = () => asked.slice(-2).map((x) => x.q + ' ' + (x.card && typeof x.card.answer === 'string' ? x.card.answer : '')).join(' ')
  s.generateAnswer = async (heard, card, opts) => {
    const q = String((opts && opts.derived) || (A ? A.cutQuestion(heard, previousTurns()) : heard) || '').trim()
    if (!q) {
      const kept = String(card.question || '')
      if (kept && !/^(Preparing…|Ready|Cleared\.|No question yet|Deriving|Answering what|From what was heard)/.test(kept)) { asked.push({ q: kept, opts, card }); card.answer = 'Answer to: ' + kept; return }
      if (!s.dropPage(card)) { card.answer = []; card.question = 'No question yet' }
      return
    }
    const said = (ENGINE.find(([re]) => re.test(q)) || [null, ''])[1]
    card.question = q; card.answer = 'Answer to: ' + q + (said ? ' ' + said : ''); card.streaming = false
    asked.push({ q, opts, card })
  }
  vm.createContext(s)
  vm.runInContext([
    app.slice(app.indexOf('const Q_CUE ='), app.indexOf(';', app.indexOf('const Q_CUE =')) + 1),
    slice('// ── Question intake', '// ── end question intake ──'),
    slice('function pressQuestion(', '$("answerBtn")'),
    slice('async function aiAnswer(', '$("screenBtn")'),
    slice('function hasAnswer(', '\n// Takes an empty page'),
    slice('function dropPage(', '\n// Copy / Export'),
  ].join('\n'), s)
  const hear = (text) => s.transcript.push({ seq: ++s.heardSeq, who: 'You', text, at: Date.now() })
  const press = async () => { await vm.runInContext('aiAnswer(false)', s) }
  return { s, asked, hear, press }
}

// ---------------------------------------------------------------- 1. every press answers the question just asked
await check('a mic-only interview: each press answers the question just asked, never an earlier one', async () => {
  const { s, asked, hear, press } = livePage()
  hear("Hi, yes, this is Alex from the hiring team, thanks for making the time.")
  hear("Yes, of course, thanks Alex, happy to talk.")
  await press()
  eq(asked.length, 0, 'small talk is not answered')
  eq(s.cards.length, 1, 'small talk leaves no page')

  hear("Could you just elaborate a little bit more on your past projects and experiences? Just give me a brief run through.")
  await press()
  ok(/past projects/i.test(asked.at(-1).q), `the first question was answered (got "${asked.at(-1).q}")`)

  hear("Yes, so I am a senior security engineer and most of my work is around banking platforms.")
  hear("I integrate the SIEM tools and automate the endpoint rollouts with Terraform.")
  hear("Alright, could you explain what dependency confusion is?")
  hear("So yeah, dependency")
  await press()
  eq(asked.at(-1).q, 'Could you explain what dependency confusion is?', 'the new question, not the earlier one')
  ok(asked.at(-1).opts.reask !== true, 'a new question is answered as new, not as a re-press of the old page')

  hear("Dependency confusion is when the build pulls a public package with the same name as an internal one.")
  hear("How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?")
  hear("Yes, so...")
  hear("I would say like uh")
  await press()
  eq(asked.at(-1).q, 'How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?', 'the latest question')

  hear("Are you working on any projects currently")
  hear("Yeah, yeah, I'm still working with the city.")
  hear("Alright, could you, do you mind elaborating a little bit on that, your responsibilities")
  await press()
  ok(/elaborating/i.test(asked.at(-1).q), `the responsibilities question was answered (got "${asked.at(-1).q}")`)
  ok(!/still working with the city/i.test(asked.at(-1).q), `his own reply is not part of the question (got "${asked.at(-1).q}")`)

  const before = asked.length, pages = s.cards.length
  await press()                                              // nothing new heard: the 21 Oct re-press rule
  eq(asked.length, before + 1, 'a press with nothing new re-asks')
  eq(asked.at(-1).opts.reask, true, 'and it is a re-ask')
  eq(s.cards.length, pages + 1, 'on the next page')

  // The interviewer narrows the question with no ask of its own: the 21 Oct re-press rule re-asks with it, next page.
  const kept = s.cards.map((c) => c.answer), before2 = asked.length
  hear("I mean mostly the cloud side of it, the AWS accounts and the IAM roles you own there.")
  await press()
  eq(asked.length, before2 + 1, 'a press after a clarification re-asks')
  eq(asked.at(-1).opts.reask, true, 'as a re-ask of the page on screen')
  ok(/responsibilities/i.test(asked.at(-1).q), `the question on screen is the one re-asked (got "${asked.at(-1).q}")`)
  eq(s.cards.length, kept.length + 1, 'on the next page')
  kept.forEach((a, i) => eq(s.cards[i].answer, a, `page ${i} keeps its answer`))

  hear("I do have a hard stop, but again, I wanted to thank you for taking the time out of your day.")
  hear("Thank you.")
  const n = asked.length, p = s.cards.length
  await press()
  eq(asked.length, n, 'the closing small talk is not answered')
  eq(s.cards.length, p, 'and leaves no blank page')

  // the book: every answered page still holds its own question and its own answer
  for (const { q, card } of asked) { eq(card.question, q, 'a page keeps its question'); ok(String(card.answer).startsWith('Answer to: ' + q), 'a page keeps its answer') }
})

await check('a typed question gets its own page and is answered whole', async () => {
  const { s, asked, press } = livePage()
  s.cards.push({ question: 'Tell me about a security incident you handled end to end', answer: 'At my bank I contained a credential theft across forty hosts.' }); s.idx = 1
  s.box.value = 'What is Kerberos?'
  await press()
  eq(asked.at(-1).q, 'What is Kerberos?', 'the typed question')
  eq(s.cards.length, 3, 'its own page')
  eq(s.cards[1].answer, 'At my bank I contained a credential theft across forty hosts.', 'the earlier page is untouched')
})

await check('the live page never aborts another page\'s answer when a new question starts', () => {
  ok(!/the newest question always wins/.test(app), 'the global "newest question wins" abort is back')
  ok(/if \(card\.req\) \{ try \{ card\.req\.abort\(\); \} catch \{\} \}/.test(app), 'only a page\'s own earlier request is replaced')
})

// ---------------------------------------------------------------- 2. the server reads the question it is given
if (!A || !R) failures.push('typescript is not installed, so the server checks could not run (npm ci installs it)')
else {
  await check('the server cut takes the interviewer\'s ask from mixed mic lines', () => {
    eq(A.cutQuestion('You: Alright, could you explain what dependency confusion is?\nYou: So yeah, Dependency'), 'Could you explain what dependency confusion is?', 'dependency confusion')
    eq(A.cutQuestion('You: How would you design\nYou: a SIEM pipeline for payments?'), 'How would you design a SIEM pipeline for payments?', 'a question split across two segments')
    eq(A.cutQuestion('You: I do have a hard stop, but again, I wanted to thank you for taking the time out of your day to\nYou: Thank you.\nYou: and'), '', 'closing small talk')
    const previous = 'Could you explain what dependency confusion is? Dependency confusion happens when a build resolves an internal package name from a public registry, so a public package with the same name as an internal one gets pulled into the build.'
    eq(A.cutQuestion('You: Dependency confusion is when the build pulls a public package with the same name as an internal one.\nYou: How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?', previous),
      'How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?', 'his answer to the previous question is not setup for the next one')
    ok(!/still working with the city/.test(A.cutQuestion("You: Are you working on any projects currently\nYou: Yeah, yeah, I'm still working with the city.\nYou: Alright, could you, do you mind elaborating a little bit on that, your responsibilities")), 'his reply stays out of the question')
  })
  await check('every listed part of a question is a part of the answer', () => {
    const parts = A.requestedParts('How would you distinguish DNS caching, overlapping routes, proxy selection, and NAC restrictions, and what evidence would confirm the root cause?').parts
    for (const item of ['DNS caching', 'overlapping routes', 'proxy selection', 'NAC restrictions']) ok(parts.some((p) => p.startsWith(item)), `"${item}" is a part`)
    eq(A.canonicalQuestion('IDOR', 2), 'What is IDOR? If it is an abbreviation, say what it stands for first.', 'a bare abbreviation is asked as "what is it"')
  })
  await check('each kind of question takes its lane (Master Rules §1)', () => {
    const lane = (q) => R.desktopQuestionKind(q)
    eq(lane('What is IDOR?'), 'definition', 'What is IDOR?')
    eq(lane('IDOR vs CSRF'), 'comparison', 'IDOR vs CSRF')
    eq(lane('Tell me about a difficult EPM rollout.'), 'experience', 'a real project story')
    eq(lane('How would you investigate lateral movement?'), 'implementation', 'a proposed approach, not a past incident')
    eq(lane('What logs did you check?'), 'experience', 'a follow-up continues the case')
    ok(/This asks for a fact about the candidate/.test(R.desktopResponsePolicy('engineer', 'Have you configured CyberArk EPM?').guidance), 'a direct fact is answered first')
  })
  await check('an introduction is the whole career, never one tool or project', () => {
    ok(/The answer's subject is the PERSON across the resume, not a favourite project, vendor or an invented success metric/.test(A.INTRO_CAREER_SPINE), 'the career-wide introduction contract')
    ok(/When the resume states the total years of experience, say that total in the opening sentence/.test(A.INTRO_CAREER_SPINE), 'total years first')
  })
  await check('Director answers never invent a person or give him a title he does not hold', () => {
    const svc = read('src/lib/kompasAnswerService.ts')
    ok(/never a person's name, and the candidate keeps the title the resume gives: never speak as a CISO or any title the resume does not hold/.test(svc), 'the role-not-person rule')
  })
}

if (failures.length) {
  console.error(`\nKOMPAS BASELINE CONTRACT FAILED (${failures.length} of ${checks.length + (A ? 0 : 1)}). The build stops here so production keeps the last good deploy.\n`)
  for (const f of failures) console.error('  ✖ ' + f)
  console.error('\nThese hold the owner\'s baseline (scripts/kompas-baseline.mjs). Fix the change, or change a check only when the owner changes its rule.\n')
  process.exit(1)
}
console.log(`Kompas baseline contract: ${checks.length} checks hold.`)
