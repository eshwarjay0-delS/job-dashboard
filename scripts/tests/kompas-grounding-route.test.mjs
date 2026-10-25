import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = new URL('../../', import.meta.url)

function harness(options = {}) {
  const calls = []
  let dossiers = 0, vaults = 0
  const mocks = {
    '@/lib/authBoundary': { authenticatedUser: async () => ({ id: 'test-user' }) },
    '@/lib/llm': { keysFor: async () => { vaults++; return { openrouter: 'test-key' } }, resolveKeys: () => ({}) },
    '@/lib/rateLimit': { checkRateLimit: () => ({ ok: true }) },
    '@/lib/dossier': { dossierContext: async () => { dossiers++; return options.hungDossier ? new Promise(() => {}) : 'OLD GENERATED INCIDENT' } },
    '@/lib/sttLedger': { hashUserId: () => 'test-hash' },
    '@/lib/llmLedger': { scheduleLlmRecord: () => {} },
  }
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const module = { exports: {} }
    cache.set(file, module.exports)
    const js = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    runInNewContext(js, {
      module, exports: module.exports, process: { env: {} }, console,
      setTimeout, clearTimeout, AbortController, AbortSignal, Response, TextEncoder, TextDecoder, ReadableStream,
      fetch: async (_url, options) => {
        const body = JSON.parse(options.body)
        calls.push(body)
        if (body.stream) {
          return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: options.modelAnswer || 'I check the certificate chain.' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n')
        }
        return Response.json({ choices: [{ message: { content: options.modelAnswer || 'I check the certificate chain.' } }] })
      },
      require: (id) => mocks[id] || (id.startsWith('@/') ? load('src/' + id.slice(2) + '.ts') : require(id)),
    }, { filename: file })
    return module.exports
  }
  const route = load('src/app/api/kompas/answer/route.ts')
  const { NextRequest } = require('next/server')
  return {
    calls, get dossiers() { return dossiers }, get vaults() { return vaults },
    post: (body) => route.POST(new NextRequest('http://localhost/api/kompas/answer', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })),
  }
}

test('the actual answer route sends active resume and JD to the model, without remote dossier reads', async () => {
  const h = harness()
  const response = await h.post({ question: 'How do you troubleshoot TLS certificate errors?', config: {
    resume: 'Current role: Senior Security Engineer at Example Bank. '.repeat(8) + 'Maintained PKI and Venafi TPP.',
    jd: 'TCS requires highly available Root CA, Issuing CA, CRL, OCSP, HSM and Venafi automation.',
  } })
  assert.equal(response.status, 200)
  const prompt = h.calls[0].messages[1].content
  assert.match(prompt, /Maintained PKI and Venafi TPP/)
  assert.match(prompt, /TCS requires highly available Root CA/)
  assert.match(prompt, /never evidence of personal history/)
  assert.doesNotMatch(prompt, /OLD GENERATED INCIDENT/)
  assert.equal(h.dossiers, 0)
  assert.ok((await response.json()).meta.timing.total_ms >= 0)
})

test('derive gate rejects filler and extracts the latest question with no model, vault or dossier call', async () => {
  const h = harness()
  const quiet = await (await h.post({ deriveOnly: true, question: 'You: Okay.' })).json()
  assert.equal(quiet.noQuestion, true)
  const ask = await (await h.post({ deriveOnly: true,
    question: 'You: Yes so I checked the old service. Okay, so how do you configure certificate discovery in Venafi?',
  })).json()
  assert.match(ask.derived, /^How do you configure certificate discovery in Venafi/)
  assert.equal(h.calls.length, 0)
  assert.equal(h.dossiers, 0)
  assert.equal(h.vaults, 0)
})

test('streaming carries the same grounding and measures preparation and first content', async () => {
  const h = harness()
  const response = await h.post({ stream: true, question: 'What is vCert?', config: {
    resume: 'I administer Venafi TPP and automate certificates with vCert. '.repeat(5), jd: 'PKI Architect at TCS.',
  } })
  const stream = await response.text()
  assert.match(response.headers.get('content-type'), /event-stream/)
  assert.match(stream, /"type":"delta"/)
  assert.match(stream, /"preparation_ms":\d+/)
  assert.match(stream, /"first_ms":\d+/)
  assert.match(h.calls[0].messages[1].content, /PKI Architect at TCS/)
  assert.equal(h.dossiers, 0)
})

// Owner, 23 Oct 2026: answers are read and spoken, so a coding request is talked through in order, with no code shown.
// This replaced "coding requests receive runnable code instructions" (one fenced, runnable block).
test('coding requests are talked through step by step, with no code shown', async () => {
  const h = harness()
  const response = await h.post({ question: 'Give me a Python program for prime numbers.', config: { resume: 'Python automation.' } })
  assert.equal((await response.json()).meta.kind, 'code')
  const prompt = h.calls[0].messages[1].content
  assert.match(prompt, /say the solution the way you would talk it through/)
  assert.match(prompt, /the steps in the order the code runs/)
  assert.match(prompt, /No code blocks, no inline code, no symbols/)
  assert.doesNotMatch(prompt, /complete and runnable|ONE fenced block/)
})


test('missing active sources cannot make a live turn wait indefinitely for the dossier', async () => {
  const h = harness({ hungDossier: true })
  const began = Date.now()
  const response = await h.post({ question: 'What is a certificate?' })
  assert.equal(response.status, 200)
  assert.ok(Date.now() - began < 1200)
  assert.equal(h.dossiers, 1)
})

test('a slow remote anchor lookup yields to live generation within its deadline', async () => {
  const scope = { AbortSignal, setTimeout, clearTimeout, KompasLevels: {
    sessionLevelsKey: () => 'session-key', maturityKey: () => 'maturity-key',
  }, fetch: async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })
  }) }
  runInNewContext(readFileSync(new URL('public/kompas/anchors.js', root), 'utf8'), scope)
  scope.KompasAnchors.db.get = async () => null
  const began = Date.now()
  const result = await scope.KompasAnchors.load('What is a certificate?', 'PKI', 'resume', 'session')
  assert.equal(result.source, 'miss')
  assert.ok(Date.now() - began < 800)
})


test('a blocked local anchor database cannot hold the live answer path', async () => {
  const scope = { AbortSignal, setTimeout, clearTimeout, KompasLevels: {
    sessionLevelsKey: () => 'session-key', maturityKey: () => 'maturity-key',
  } }
  runInNewContext(readFileSync(new URL('public/kompas/anchors.js', root), 'utf8'), scope)
  scope.KompasAnchors.db.get = () => new Promise(() => {})
  const began = Date.now()
  const result = await scope.KompasAnchors.load('What is a certificate?', 'PKI', 'resume', 'session')
  assert.equal(result.source, 'miss')
  assert.ok(Date.now() - began < 800)
})


test('asking about a protocol status code does not become a coding exercise', async () => {
  const h = harness()
  const response = await h.post({ question: 'What is HTTP status code 403?', config: { resume: 'API security.' } })
  assert.notEqual((await response.json()).meta.kind, 'code')
})


test('introductions present the supported career with room for substance and no JD fit pitch', async () => {
  for (const interviewer of ['engineer', 'director']) {
    const h = harness()
    const response = await h.post({ question: 'Tell me about yourself.', config: {
      interviewer, resume: 'I maintain PKI at Example Bank. Previously I investigated security incidents at Example Systems. '.repeat(5),
      jd: 'TCS seeks a PKI Architect.',
    } })
    const result = await response.json()
    assert.equal(result.meta.tier, 0)
    assert.ok(result.meta.words >= 240)
    const system = h.calls[0].messages[0].content
    const prompt = h.calls[0].messages[1].content
    assert.match(system, /PERSONAL INTRODUCTION/)
    assert.match(prompt, /major career stages in the resume/)
    assert.match(prompt, /first person, with direct statements of work and ownership/)
    assert.match(prompt, /Never close with a job application pitch/)
    assert.match(prompt, /named clients or employers, signature projects, documented achievements, and the impact/)
    assert.match(prompt, /a client is a client and an employer is an employer/)
    assert.match(prompt, /candidate's own actions and decisions, and the documented result or impact/)
    assert.match(prompt, /Be a little bold and humble/)
    assert.match(prompt, /acknowledge the team's role/)
    assert.match(prompt, /rather than inventing an achievement/)
    assert.doesNotMatch(prompt, /why this role fits|FINAL ROUND|If a second topic starts, stop/)
    assert.doesNotMatch(system, /About 75 words holds attention/)
  }
})

test('an explicit brief introduction still receives a shorter budget', async () => {
  const h = harness()
  const response = await h.post({ question: 'Give me a brief introduction about yourself.', config: { resume: 'I maintain PKI.' } })
  const result = await response.json()
  assert.equal(result.meta.tier, 0)
  assert.ok(result.meta.words < 180)
})


test('personal questions use evidence to make an impression without replaying the introduction', async () => {
  for (const question of ['What is your strongest achievement?', 'Tell me about a project you are proud of.', 'What was your biggest bottleneck?']) {
    const h = harness()
    const response = await h.post({ question, config: { resume: 'I maintained PKI at Example Bank and automated certificate renewal. '.repeat(5) } })
    assert.equal(response.status, 200)
    const system = h.calls[0].messages[0].content
    assert.match(system, /PERSONAL EVIDENCE OPPORTUNITY/)
    assert.match(system, /strongest relevant example supported by the resume/)
    assert.match(system, /candidate's own actions and decisions/)
    assert.match(system, /never disguise failure as success/)
    assert.match(system, /A narrow fact, yes or no, title or years question stays concise/)
  }
})

test('a general technical question does not receive a personal achievement pitch', async () => {
  const h = harness()
  const response = await h.post({ question: 'What is an OCSP responder?', config: { resume: 'I maintained PKI.' } })
  assert.equal(response.status, 200)
  const system = h.calls[0].messages[0].content
  assert.match(system, /TECHNICAL ANSWER BOUNDARY/)
  assert.doesNotMatch(system, /PERSONAL EVIDENCE OPPORTUNITY/)
})


test('an open-ended intro traverses the supported career, not a cached tool or the target JD', async () => {
  const h = harness({ modelAnswer: 'I work in security operations. [beat] I also assess applications. [breath] My focus is making controls operational.' })
  const resume = [
    'EXPERIENCE',
    'Example Bank — Endpoint Security Engineer | Jan 2025 – Present',
    '- Designed endpoint privilege policies with staged rollout and rollback.',
    '- Reviewed unsigned utility exceptions and their expiry.',
    'Example Health — Security Analyst | Feb 2023 – Dec 2024',
    '- Correlated SIEM alerts and investigated identity misuse.',
    '- Reviewed access permissions and reported remediation ownership.',
    'Example Labs — Application Security Tester | Jan 2022 – Jan 2023',
    '- Tested API authorization with separate users and tenants.',
    '- Documented verified vulnerabilities and retest outcomes.',
  ].join('\n')
  const response = await h.post({
    question: 'Big Intro',
    config: { interviewer: 'architect', resume, jd: 'Role urgently requires ONLY CodeQL SAST.', responseCalibration: 'three-level-v1' },
    prep: { identity: 'INVENTED_PERSONA', projects: 'INVENTED_PROJECT_SUPERHERO' },
    transcript: 'Old unrelated prompt: Give me only a CodeQL implementation story.',
    history: [{ q: 'Old irrelevant project', a: 'INVENTED_HISTORY_RESULT' }],
  })
  const result = await response.json()
  assert.equal(response.status, 200, JSON.stringify(result))
  assert.equal(result.meta?.tier, 0, JSON.stringify(result))
  const system = h.calls[0].messages[0].content
  const prompt = h.calls[0].messages[1].content
  assert.match(system, /INTENT FIRST/)
  assert.match(system, /CAREER-WIDE INTRODUCTION CONTRACT/)
  assert.match(prompt, /RESUME \(career-wide evidence across supported roles\)/)
  assert.match(prompt, /Endpoint privilege policies|endpoint privilege policies/)
  assert.match(prompt, /Correlated SIEM alerts/)
  assert.match(prompt, /Tested API authorization/)
  assert.match(prompt, /Example Bank/)
  assert.match(prompt, /Example Health/)
  assert.match(prompt, /Example Labs/)
  assert.doesNotMatch(prompt, /INVENTED_PERSONA|INVENTED_PROJECT_SUPERHERO|INVENTED_HISTORY_RESULT/)
  assert.doesNotMatch(prompt, /Role urgently requires ONLY CodeQL SAST/)
  assert.doesNotMatch(prompt, /Old unrelated prompt/)
  assert.doesNotMatch(prompt, /ANSWER LEVEL .*full build depth/)
  assert.doesNotMatch(result.text, /\[(?:beat|breath)\]|\(pause\)/i)
})

test('introduction to a technical topic is not classified as the candidate career introduction', async () => {
  const h = harness()
  const response = await h.post({ question: 'Give me an introduction to OAuth', config: {
    resume: 'Example Bank — Endpoint Security Engineer | Jan 2025 – Present',
  } })
  const result = await response.json()
  assert.notEqual(result.meta.tier, 0)
  const prompt = h.calls[0].messages[1].content
  assert.doesNotMatch(prompt, /CAREER-WIDE INTRODUCTION CONTRACT/)
})

test('a specific experience question must not turn into the full-career introduction', async () => {
  const h = harness()
  const response = await h.post({ question: 'Tell me about your experience with CyberArk EPM', config: {
    resume: 'Example Bank — Security Engineer | Jan 2025 – Present\n- Worked on CyberArk EPM.',
  } })
  const result = await response.json()
  assert.notEqual(result.meta.tier, 0)
  assert.doesNotMatch(h.calls[0].messages[1].content, /CAREER-WIDE INTRODUCTION CONTRACT/)
})


test('definitions exclude unrelated generated project stories and stay on the technical question', async () => {
  const h = harness()
  const response = await h.post({
    question: 'What is CSRF?',
    config: { resume: 'Example Labs — Application Security Tester | Jan 2022 – Jan 2023\n- Tested API authorization.' },
    prep: { identity: 'UNRELATED_IDENTITY_STORY', persona: 'UNRELATED_PERSONA_STORY', projects: 'UNRELATED_PROJECT_STORY' },
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.notEqual(result.meta.tier, 0)
  const prompt = h.calls[0].messages[1].content
  assert.doesNotMatch(prompt, /UNRELATED_IDENTITY_STORY|UNRELATED_PERSONA_STORY|UNRELATED_PROJECT_STORY/)
  assert.match(h.calls[0].messages[0].content, /INTENT FIRST/)
  assert.match(h.calls[0].messages[0].content, /TECHNICAL ANSWER BOUNDARY/)
})


// Fresh 30-fold source-aware answer-routing regression. These assertions inspect
// real answer-route decisions and prompts with a mocked model, not live answer
// quality. Every fold changes the input form and rotates the introduction ask,
// while checking all three audience levels against unrelated cached stories.
const foldForms = [
  s => s,
  s => s.toUpperCase(),
  s => '  ' + s + '  ',
  s => s.replaceAll(' ', '  '),
  s => s.replaceAll(' ', '\n'),
  s => s.replaceAll(' ', '\t'),
]
const foldIntroductions = [
  'Big Intro',
  'Tell me about yourself.',
  'Walk me through your career.',
  'Give me a brief introduction about yourself.',
  'Summarize your background.',
]
const foldResume = [
  'EXPERIENCE',
  'Example Bank — Endpoint Security Engineer | Jan 2025 – Present',
  '- Designed endpoint privilege policies with staged rollout and rollback.',
  '- Reviewed unsigned utilities, policy exceptions and expirations.',
  'Example Health — Security Analyst | Feb 2023 – Dec 2024',
  '- Correlated SIEM alerts and investigated identity activity.',
  '- Validated remediations and reviewed access permissions.',
  'Example Labs — Application Security Tester | Jan 2022 – Jan 2023',
  '- Tested API authorization with distinct users and tenants.',
  '- Reported confirmed authorization vulnerabilities and retested corrections.',
].join('\n')

for (let fold = 0; fold < 30; fold++) {
  test('fresh 30-fold intent regression ' + String(fold + 1).padStart(2, '0'), async () => {
    const form = foldForms[Math.floor(fold / 5)]
    const intro = foldIntroductions[fold % 5]
    for (const level of ['engineer', 'architect', 'director']) {
      for (const [name, original, expectedTier] of [
        ['career-intro', intro, 0],
        ['technical-intro', 'Give me an introduction to OAuth.', 2],
        ['scoped-experience', 'Tell me about your experience with CyberArk EPM.', 4],
        ['concept-definition', 'What is CSRF?', 2],
        ['engineering-implementation', 'How would you configure endpoint controls?', 2],
        ['personal-incident', 'Walk me through an incident you handled.', 1],
      ]) {
        const h = harness({modelAnswer:'I explain the supported context. [beat] I keep the decision connected to the question.'})
        const question = form(original)
        const response = await h.post({
          question,
          config: {
            level, interviewer: level, responseCalibration: 'three-level-v1',
            resume: foldResume,
            jd: 'SECRET_JOB_DESCRIPTION_FOCUS_ONLY_ON_CODEQL',
          },
          prep: {identity:'UNRELATED_GENERATED_IDENTITY', projects:'UNRELATED_GENERATED_PROJECT', persona:'UNRELATED_GENERATED_PERSONA'},
          transcript:'PREVIOUS_QUESTION_RANDOM_TOOL_CASE_STUDY',
          history:[{q:'Old unrelated incident',a:'OLD_UNRELATED_ACHIEVEMENT'}],
        })
        const payload = await response.json()
        assert.equal(response.status,200, 'fold '+fold+' '+name+' '+level+': '+JSON.stringify(payload))
        assert.equal(payload.meta?.tier,expectedTier,'fold '+fold+' '+name+' '+level+' classified incorrectly')
        const prompt=h.calls[0].messages[1].content
        const system=h.calls[0].messages[0].content
        assert.match(system,/INTENT FIRST/,'missing intent policy')
        if (name==='career-intro') {
          assert.match(prompt,/CAREER-WIDE INTRODUCTION CONTRACT/,'missing full-career policy')
          for(const employer of ['Example Bank','Example Health','Example Labs']) assert.ok(prompt.includes(employer),'missing career role '+employer)
          for(const evidence of ['Designed endpoint privilege policies','Correlated SIEM alerts','Tested API authorization']) assert.ok(prompt.includes(evidence),'missing breadth evidence '+evidence)
          assert.doesNotMatch(prompt,/UNRELATED_GENERATED_|OLD_UNRELATED_ACHIEVEMENT|PREVIOUS_QUESTION_RANDOM_TOOL_CASE_STUDY|SECRET_JOB_DESCRIPTION_FOCUS_ONLY_ON_CODEQL/)
          assert.doesNotMatch(payload.text||'',/\[(?:beat|breath)\]|\(pause\)/i)
        } else {
          assert.doesNotMatch(prompt,/CAREER-WIDE INTRODUCTION CONTRACT/)
          if (['technical-intro','concept-definition','engineering-implementation'].includes(name))
            assert.doesNotMatch(prompt,/UNRELATED_GENERATED_IDENTITY|UNRELATED_GENERATED_PROJECT|UNRELATED_GENERATED_PERSONA/)
        }
      }
    }
  })
}
