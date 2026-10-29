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
// The replay runs the page's real code (sliced from public/kompas/app.js: the intake, AI Answer, the derive and answer
// request fields, recentQA) and the server's real code (deriveByCode and questionForAnswer from src/lib/kompasAnswer.ts,
// which the service calls). Only the network and the model are stood in for. Each case below is one the owner hit live
// or one the review of 398f299 proved.
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
const loadedTs = new Map()
function loadTs(path) {
  if (loadedTs.has(path)) return loadedTs.get(path)
  const out = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const mod = { exports: {} }
  loadedTs.set(path, mod.exports)
  const dir = path.split('/').slice(0, -1).join('/')
  const localRequire = (spec) => {
    if (spec.startsWith('.')) {
      const rel = spec.replace(/^\.\//, '').replace(/\.js$/, '')
      return loadTs(`${dir}/${rel.endsWith('.ts') ? rel : rel + '.ts'}`)
    }
    return require(spec)
  }
  vm.runInNewContext(out, { module: mod, exports: mod.exports, require: localRequire, console })
  return mod.exports
}
const A = ts ? loadTs('src/lib/kompasAnswer.ts') : null
const R = ts ? loadTs('src/lib/kompasDesktopResponse.ts') : null
const P = ts ? loadTs('src/lib/kompasInterviewPrecision.ts') : null
// The service's code without its comments, so a rule moved into a comment does not count as wired.
const service = read('src/lib/kompasAnswerService.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`\\])\/\/.*$/gm, '$1')

// ---------------------------------------------------------------- the page's own code, from public/kompas/app.js
const app = read('public/kompas/app.js')
function slice(start, end) {
  const a = app.indexOf(start), b = app.indexOf(end, a)
  if (a < 0 || b < 0) throw new Error(`public/kompas/app.js no longer has "${start}" ... "${end}"`)
  return app.slice(a, b)
}
// The answer button runs the ONE aiAnswer the replay tests: a second declaration later in the file would win in the
// browser and leave this replay testing dead code.
const ONCE = ['const Q_CUE =', 'async function aiAnswer(', 'function pressQuestion(', 'function composeIntake(', 'function hasAnswer(', 'function dropPage(',
  'function recentQA(', 'function deriveBody(', 'function questionFields(', 'const SIGN_OFF =', 'function closingSentence(', 'function askSentence(']
const PLACEHOLDER = /^(Preparing…|Ready|Cleared\.|No question yet|Deriving|Answering what|From what was heard)/
const PAGE = (() => {
  for (const d of ONCE) if (app.split(d).length !== 2) throw new Error(`public/kompas/app.js must declare "${d}" exactly once`)
  if (!app.includes('$("answerBtn").onclick = () => aiAnswer(false);')) throw new Error('the AI Answer button no longer runs aiAnswer(false)')
  return [
    slice('const Q_CUE =', '\nlet lastQ'),
    slice('// ── Question intake', '// ── end question intake ──'),
    slice('function recentQA(', '\nfunction askingLevel('),
    slice('function shortFollowUp(', 'const armsAuto'),
    slice('function pressQuestion(', '$("answerBtn")'),
    slice('async function aiAnswer(', '$("screenBtn")'),
    slice('function hasAnswer(', '\n// Takes an empty page'),
    slice('function dropPage(', '\n// Copy / Export'),
  ].join('\n')
})()

// The engine's answers. In the first replay the candidate then reads them aloud (the page's echo filter drops his
// lines); in the others he answers in his own words, so only the server can tell his reply from the next question.
const ECHOED = [
  [/past projects/i, 'I secure banking platforms, integrating SIEM tools and automating endpoint rollouts across the estate.'],
  [/dependency confusion/i, 'Dependency confusion happens when a build resolves an internal package name from a public registry, so a public package with the same name as an internal one gets pulled into the build.'],
  [/multiple security tools/i, 'I correlate the findings on one asset and one root cause, deduplicate them into a single tracked vulnerability, and keep each tool as evidence.'],
]
const OWN_WORDS = [
  [/dependency confusion/i, 'It is a supply-chain attack: an attacker publishes a look-alike module to npm under your private name, and the resolver prefers the higher version from the registry.'],
  // An answer that restates its question's setup: on a re-ask of that page, the setup must not read as his reply.
  [/partner traffic/i, 'The payments API sits behind a gateway and talks to three internal services, so I would rate limit the partner traffic per key at the gateway.'],
  [/.*/, 'I would start from the evidence, contain first, then fix the cause and prove it with a test.'],
]

function livePage(engine = ECHOED) {
  const asked = [], errors = []
  const s = {
    aiBusy: false, aiBusySince: 0, autoTimer: null, transcriptionEpoch: 0, transcriptionFailedEpoch: -1, BUILD: 'baseline',
    running: false, captures: [], finals: new Set(), flushing: false, heardSeq: 0, answeredSeq: 0, transcript: [], source: 'You',
    cards: [{ question: 'Ready', answer: ['Press Start — both your mic and the call audio are on by default.'] }], idx: 0,
    box: { value: '' },
    pendingHeard() { return s.transcript.filter((t) => t.seq > s.answeredSeq) },
    updatePending() {}, flushHeard: async () => {}, setChat() {}, logEvent() {}, renderCard() {}, toTop() {},
    animateCard() {}, clearTimeout() {}, plainAnswer: (a) => (Array.isArray(a) ? a.join(' ') : String(a)), questionSource: () => s.source,
    // A crash inside AI Answer lands in status(..., "err"): that fails the replay instead of passing silently.
    status(msg, kind) { if (kind === 'err') errors.push(String(msg)) },
  }
  s.$ = (id) => (id === 'manualInput' ? s.box : { classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, title: '', textContent: '' })
  s.addCard = (q, answer) => { const c = { question: q, answer }; s.cards.push(c); s.idx = s.cards.length - 1; return c }
  // generateAnswer as the page runs it, with the network and the model stood in for: the page's derive request goes to
  // the server's real code gates, then the page's answer request fields go to the server's real answer question.
  s.generateAnswer = async (heard, card, opts = {}) => {
    let derivedQ = opts.derived || '', derivedBy = opts.derived ? (opts.derivedBy || 'kept') : ''
    if (opts.consolidated && !derivedQ) {
      const body = s.deriveBody(heard, card, opts)
      const code = A.deriveByCode(String(body.question).slice(0, 5000), body.history, body.reask === true)
      if (code === null) {
        const kept = String(card.question || '').trim()
        if (kept && !PLACEHOLDER.test(kept)) { derivedQ = kept; derivedBy = 'ai' }
        else { if (!s.dropPage(card)) { card.answer = []; card.question = 'No question yet' } return }
      } else if (code === '') {
        errors.push(`the code could not form a question and the model would have to: ${JSON.stringify(body.question)}`)
        return
      } else { derivedQ = code; derivedBy = 'code'; card.question = code }
    }
    const f = s.questionFields(heard, derivedQ, derivedBy, opts)
    const told = A.questionForAnswer(String(f.question).slice(0, 4000), String(f.derived || '').slice(0, 2000), f.pinned === true, f.again === true, s.recentQA(card))
    const said = (engine.find(([re]) => re.test(told)) || [null, ''])[1]
    card.answer = said || "An answer in his own words."; card.streaming = false
    asked.push({ q: card.question, told, opts, card, derivedBy })
  }
  vm.createContext(s)
  vm.runInContext(PAGE, s)
  const hear = (text, who = 'You') => s.transcript.push({ seq: ++s.heardSeq, who, text, at: Date.now() })
  const press = async () => {
    await vm.runInContext('aiAnswer(false)', s)
    if (errors.length) throw new Error(`AI Answer failed during the replay: ${errors.join(' | ')}`)
  }
  return { s, asked, hear, press }
}
const told = (asked) => asked.at(-1).told
const notGlued = (q) => ok(!/context keywords|on screen\)|^Lane \(/i.test(q), `a page label reached the question: "${q}"`)

if (!A || !R) failures.push('typescript is not installed, so the replay could not run (npm ci installs it)')
else {
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
  eq(told(asked), 'Could you explain what dependency confusion is?', 'the question the model is told to answer')
  ok(asked.at(-1).opts.reask !== true, 'a new question is answered as new, not as a re-press of the old page')

  hear("Dependency confusion is when the build pulls a public package with the same name as an internal one.")
  hear("How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?")
  hear("Yes, so...")
  hear("I would say like uh")
  await press()
  eq(asked.at(-1).q, 'How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?', 'the latest question')
  eq(told(asked), asked.at(-1).q, 'and the model is told the same question')

  hear("Are you working on any projects currently")
  hear("Yeah, yeah, I'm still working with the city.")
  hear("Alright, could you, do you mind elaborating a little bit on that, your responsibilities")
  await press()
  ok(/elaborating/i.test(asked.at(-1).q), `the responsibilities question was answered (got "${asked.at(-1).q}")`)
  ok(!/still working with the city/i.test(asked.at(-1).q + told(asked)), `his own reply is not part of the question (got "${told(asked)}")`)

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
  ok(/responsibilities/i.test(asked.at(-1).q) && /responsibilities/i.test(told(asked)), `the question on screen is the one re-asked (got "${told(asked)}")`)
  ok(!/dependency|multiple security tools/i.test(told(asked)), `no older question rides along (got "${told(asked)}")`)
  notGlued(told(asked))
  eq(s.cards.length, kept.length + 1, 'on the next page')
  kept.forEach((a, i) => eq(s.cards[i].answer, a, `page ${i} keeps its answer`))

  hear("I do have a hard stop, but again, I wanted to thank you for taking the time out of your day.")
  hear("Thank you.")
  const n = asked.length, p = s.cards.length
  await press()
  eq(asked.length, n, 'the closing small talk is not answered')
  eq(s.cards.length, p, 'and leaves no blank page')

  // the book: every answered page still holds its own question and its own answer
  for (const { q, card } of asked) { eq(card.question, q, 'a page keeps its question') }
})

await check('asks that do not open like a question are new questions, answered as asked', async () => {
  const { asked, hear, press } = livePage(OWN_WORDS)
  hear("How would you secure self-hosted CI runners?")
  await press()
  hear("I would look at how the runners get their tokens and make them ephemeral.")
  hear("Got it. My question is how you'd isolate a compromised runner from the other teams")
  await press()
  ok(/isolate a compromised runner/i.test(told(asked)) && !/self-hosted/i.test(told(asked)), `"my question is..." (got "${told(asked)}")`)
  ok(asked.at(-1).opts.reask !== true, 'a new page, not a re-ask of the runner question')
  hear("We would put each team's runners in their own network segment.")
  hear("Okay. The other thing I wanted to ask is when you'd rotate the signing keys")
  await press()
  ok(/rotate the signing keys/i.test(told(asked)) && !/isolate/i.test(told(asked)), `"the other thing I wanted to ask is..." (got "${told(asked)}")`)
  hear("Every ninety days and on any suspected exposure.")
  hear("The real question is why the build trusted the public registry in the first place")
  await press()
  ok(/why the build trusted the public registry/i.test(told(asked)), `"the real question is why..." (got "${told(asked)}")`)
  hear("Because nobody pinned the scope.")
  hear("Okay. Describe how you'd revoke a leaked signing key.")
  await press()
  ok(/Describe how you'd revoke a leaked signing key/.test(told(asked)) && !/public registry/.test(told(asked)), `"Okay. Describe..." is judged by its own sentence (got "${told(asked)}")`)
  ok(asked.at(-1).opts.reask !== true, 'and is a new page')
  eq(A.cutQuestion('You: My question is what would you do if the vendor refuses to patch'), 'What would you do if the vendor refuses to patch', '"my question is what would you do" keeps its wh-word')
  ok(/design you'd use for key rotation/.test(A.questionToAnswer('', "I want to understand the design you'd use for key rotation. Keep it short.", true)), 'a typed request keeps its subject, not only "Keep it short."')
})

await check('his own answer in his own words is never glued in front of the next question', async () => {
  const { asked, hear, press } = livePage(OWN_WORDS)
  hear("Alright, could you explain what dependency confusion is?")
  await press()
  hear("Dependency confusion is when the build pulls a public package with the same name as an internal one.")
  hear("How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?")
  await press()
  eq(asked.at(-1).q, 'How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?', 'the card')
  eq(told(asked), asked.at(-1).q, 'the question the model is told to answer')
  // He starts answering before the press: his first words are not the question.
  hear("How would you prioritise patching across three hundred servers?")
  hear("So the first thing is when the scanners disagree, which is what we saw at the bank.")
  await press()
  eq(told(asked), 'How would you prioritise patching across three hundred servers?', 'his first words after the question')
  // When the model forms the question, the answer step still knows his reply from setup.
  const history = [{ q: 'Could you explain what dependency confusion is?', a: OWN_WORDS[0][1] }]
  ok(!/Dependency confusion is when/.test(A.questionForAnswer('You: Dependency confusion is when the build pulls a public package with the same name as an internal one.\nYou: How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?', 'How would you handle multiple tools reporting one vulnerability as separate findings?', false, false, history)), 'the answer step keeps his reply out of a model-formed question')
  // A sentence that reads the last answer aloud is his, even when the page's echo filter let it through.
  eq(A.cutQuestion('You: An attacker publishes a look-alike module to npm under your private name and the resolver prefers it.\nYou: What would your CI pipeline check before installing packages?', A.previousTurn(history)), 'What would your CI pipeline check before installing packages?', 'his reading of the last answer')
})

await check('the interviewer\'s setup stays with the question, on a new question and on a re-ask', async () => {
  const { asked, hear, press } = livePage(OWN_WORDS)
  hear("How would you handle multiple security tools reporting the same underlying vulnerability as separate findings?")
  await press()
  hear("The security tools report the same vulnerability twice as separate findings every week.")
  hear("How do you stop the duplicates coming back?")
  await press()
  ok(/report the same vulnerability twice/i.test(told(asked)) && /stop the duplicates/i.test(told(asked)), `a same-topic follow-up keeps its setup (got "${told(asked)}")`)
  hear("Alright, could you explain what dependency confusion is?")
  await press()
  hear("Building on that. Dependency confusion is a real risk in our Python builds as well.")
  hear("What would you change in the pip configuration first?")
  await press()
  ok(/Python builds/i.test(told(asked)) && /pip configuration/i.test(told(asked)), `announced setup is kept even when it names the last subject (got "${told(asked)}")`)
  hear("Dependency confusion is something we saw in our npm builds.")
  hear("How would you detect it?")
  await press()
  ok(/npm builds/i.test(told(asked)) && /detect it/i.test(told(asked)), `"detect it" keeps what "it" is (got "${told(asked)}")`)
  hear("The payments API sits behind a gateway and talks to three internal services.")
  hear("How would you rate limit the partner traffic?")
  await press()
  ok(/payments API sits behind a gateway/i.test(told(asked)) && /rate limit the partner traffic/i.test(told(asked)), `setup before the question (got "${told(asked)}")`)
  hear("Mostly during the end of month batch.")
  await press()
  eq(asked.at(-1).opts.reask, true, 'a narrowing re-asks')
  ok(/payments API sits behind a gateway/i.test(told(asked)) && /rate limit the partner traffic/i.test(told(asked)), `the re-ask keeps the setup of the page it re-asks (got "${told(asked)}")`)
})

await check('a sign-off gets no answer; a thank-you followed by a question or a narrowing is not a sign-off', async () => {
  const { s, asked, hear, press } = livePage(OWN_WORDS)
  hear("Could you elaborate on your responsibilities in your current role?")
  await press()
  hear("Thanks for the overview. What drove the move to Azure? Just the high level.")
  await press()
  ok(/What drove the move to Azure/.test(told(asked)), `a question after a thank-you (got "${told(asked)}")`)
  const n0 = asked.length
  hear("Next steps for the migration, the rollback plan specifically.")
  await press()
  eq(asked.length, n0 + 1, '"next steps for the migration" narrows the question, it does not sign off')
  for (const closing of [
    ["I do have a hard stop, but thank you for taking the time today.", "Thanks, you too."],
    ["Alright, I think we're right at time, so let's wrap up here."],
    ["I think that's it from my side, the recruiter will reach out."],
    ["Have a great weekend!"],
  ]) {
    const n = asked.length, p = s.cards.length
    for (const line of closing) hear(line)
    await press()
    eq(asked.length, n, `the sign-off "${closing.join(' / ')}" is not answered`)
    eq(s.cards.length, p, 'and leaves no page')
  }
})

await check('with the call audio on, each press answers the interviewer\'s latest question', async () => {
  const { s, asked, hear, press } = livePage(OWN_WORDS)
  s.source = 'Them'
  hear("Can you walk me through how you'd contain a ransomware outbreak on the file servers?", 'Them')
  hear("Yeah so I would first isolate the hosts.")
  await press()
  ok(/contain a ransomware outbreak/i.test(told(asked)) && !/isolate the hosts/i.test(told(asked)), `the interviewer's question (got "${told(asked)}")`)
  hear("Okay, and what about the backups?", 'Them')
  hear("Right, the backups are immutable.")
  await press()
  ok(/what about the backups/i.test(told(asked)) && !/immutable/i.test(told(asked)), `the follow-up (got "${told(asked)}")`)
  ok(asked.at(-1).opts.reask !== true, 'on its own page')
})

await check('a typed question gets its own page and is answered whole; re-asking it never reaches an older question', async () => {
  const { s, asked, hear, press } = livePage(OWN_WORDS)
  hear("Tell me about a security incident you handled end to end.")
  await press()
  const first = s.cards[1].answer
  s.box.value = 'What is Kerberos?'
  await press()
  eq(asked.at(-1).q, 'What is Kerberos?', 'the typed question')
  eq(s.cards.length, 3, 'its own page')
  eq(s.cards[1].answer, first, 'the earlier page is untouched')
  hear("Mostly inside an Active Directory forest.")
  await press()
  eq(asked.at(-1).opts.reask, true, 'a narrowing re-asks the typed page')
  ok(/Kerberos/.test(told(asked)) && !/security incident/i.test(told(asked)), `and never the older heard question (got "${told(asked)}")`)
})
}

await check('a new question never aborts another page\'s answer', () => {
  const head = slice('async function generateAnswerRequest(', 'new AbortController()')
  eq((head.match(/\.abort\(/g) || []).length, 1, 'the request start aborts exactly one earlier request')
  ok(/if \(card\.req\) \{ try \{ card\.req\.abort\(\); \} catch \{\} \}/.test(head), 'and it is this page\'s own')
  ok(!/the newest question always wins/.test(app), 'the global "newest question wins" abort is back')
})

// ---------------------------------------------------------------- 2. the server reads the question it is given
if (A && R) {
  await check('the server cut takes the interviewer\'s ask from mixed mic lines', () => {
    eq(A.cutQuestion('You: Alright, could you explain what dependency confusion is?\nYou: So yeah, Dependency'), 'Could you explain what dependency confusion is?', 'dependency confusion')
    eq(A.cutQuestion('You: How would you design\nYou: a SIEM pipeline for payments?'), 'How would you design a SIEM pipeline for payments?', 'a question split across two segments')
    eq(A.cutQuestion('You: I do have a hard stop, but again, I wanted to thank you for taking the time out of your day to\nYou: Thank you.\nYou: and'), '', 'closing small talk')
    eq(A.cutQuestion('You: Could you explain it?\nYou (context keywords): So yeah, dependency\nCurrent question (on screen): Could you explain it?'), 'Could you explain it?', 'page labels are not words of the question')
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
    ok(/never a person's name, and the candidate keeps the title the resume gives: never speak as a CISO or any title the resume does not hold/.test(A.DIRECTOR_OPENING), 'the role-not-person rule')
    ok(/level === "director" \? DIRECTOR_OPENING : ""/.test(service), 'the Director level\'s prompt carries it')
  })
  await check('the page and the server know the same asks that do not open like a question', () => {
    const phrase = (src) => (/const ASK_PHRASE = (\/.*\/[a-z]*);?\r?\n/.exec(src) || [])[1]
    ok(phrase(app) && phrase(app) === phrase(read('src/lib/kompasAnswer.ts')), 'ASK_PHRASE differs between public/kompas/app.js and src/lib/kompasAnswer.ts')
  })
  await check('the service answers through the functions this replay runs', () => {
    eq((service.match(/deriveByCode\(/g) || []).length, 2, 'both derive paths use deriveByCode')
    eq((service.match(/deriveByCode\((?:str\(body\.question, 5000\)|heard), body\.history, body\.reask === true\)/g) || []).length, 2, 'and pass it the page\'s history and re-ask flag')
    ok(/let question = latestInterviewerAsk\(questionForAnswer\(heardAll, asked, body\.pinned === true, again, body\.history\)\)/.test(service), 'questionForAnswer still anchors the answer and the reviewed latest-ask isolator applies afterwards')
    ok(P && P.latestInterviewerAsk('Previous answer. Are you familiar with policy deviations?') === 'Are you familiar with policy deviations?', 'the new ask is isolated from the previous answer')
    ok(P && P.latestInterviewerAsk('How do you assess business impact? How do you verify root cause?') === 'How do you assess business impact? How do you verify root cause?', 'two genuine parts of the same question remain intact')
    ok(!/\b(?:cutQuestion|questionToAnswer|cleanQuestion|plainlyNoQuestion)\(/.test(service), 'no second, untested path to the question')
  })
}

if (failures.length) {
  console.error(`\nKOMPAS BASELINE CONTRACT FAILED (${failures.length} of ${checks.length + (A ? 0 : 1)}). The build stops here so production keeps the last good deploy.\n`)
  for (const f of failures) console.error('  ✖ ' + f)
  console.error('\nThese hold the owner\'s baseline (scripts/kompas-baseline.mjs). Fix the change, or change a check only when the owner changes its rule.\n')
  process.exit(1)
}
console.log(`Kompas baseline contract: ${checks.length} checks hold.`)
