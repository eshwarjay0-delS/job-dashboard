// The owner's Endpoint Analyst session, 27 Oct 2026: every introduction opened "I'm a Citi Bank at Citi Bank", and prep wrote
// three projects with no employer and outcomes nobody wrote ("reducing endpoint policy violations by over 30%"), which
// answers then reached for out of the blue. Held still here with the resume's own header lines (the Word tab between place
// and dates is lost in the text, so "NYNOV 2024" arrives glued).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const K = await import('../../src/lib/kompasResume.ts')
const G = await import('../../src/lib/kompasGuards.ts')
const P = await import('../../src/lib/kompasPrepPack.ts')

const HEADS = [
  'Senior Endpoint Security | Citi Bank | New York, NYNOV 2024 – PRESENT',
  'Endpoint Security  | CVS Health | Irving, TXMAR 2023 – OCT 2024',
  'Digital Security Engineer | City of San Diego (DOE) | San Diego, CAAUG 2021 – FEB 2023',
  'Endpoint Security Engineer | Charter Communications | Stamford, CTFEB 2019 - JUL 2021',
  'Junior Security Specialist | Accenture | IndiaAPR 2017 – JAN 2019',
]
const resume = ['Eshwar Janjirala', 'PROFESSIONAL SUMMARY', 'I am a Endpoint Security Engineer with over 9+ years of experience.', 'PROFESSIONAL EXPERIENCE',
  ...HEADS.flatMap((h, i) => [h, `•Role ${i + 1} resolved escalated endpoint tickets within SLA.`, `•Role ${i + 1} analyzed HAR files.`])].join('\n')

test('glued place and dates, and titles without a title word, parse the same in both readers', () => {
  for (const roles of [K.resumeRoles(resume), G.resumeRoles(resume)]) {
    assert.deepEqual(roles.list.map((r) => r.org), ['Citi Bank', 'CVS Health', 'City of San Diego (DOE)', 'Charter Communications', 'Accenture'])
    assert.deepEqual(roles.list.map((r) => r.title), ['Senior Endpoint Security', 'Endpoint Security', 'Digital Security Engineer', 'Endpoint Security Engineer', 'Junior Security Specialist'])
    assert.deepEqual(roles.list.map((r) => r.dates), ['NOV 2024 – PRESENT', 'MAR 2023 – OCT 2024', 'AUG 2021 – FEB 2023', 'FEB 2019 - JUL 2021', 'APR 2017 – JAN 2019'])
  }
  const f = G.speakFacts({ resume })
  assert.equal(f.employer, 'Citi Bank'); assert.equal(f.title, 'Senior Endpoint Security')
})

test('a month is split off only where a place code or a lower-case word ran into it', () => {
  const one = (h) => K.resumeRoles(`EXPERIENCE\n${h}\nDid work.`).list[0]
  assert.equal(one('Security Analyst | Acme Bank | Austin, TXJan 2020 – Present').dates, 'Jan 2020 – Present')
  assert.equal(one('SUMMARY 2020 – 2021 | Security Analyst | Acme Bank').dates, '2020 – 2021')
})

test('an unclear header follows the order the resume uses for its other headers', () => {
  const r = K.resumeRoles(['EXPERIENCE', 'Cloud Security | Northwind | Remote | JAN 2022 – PRESENT', 'x', 'Security Engineer | Contoso | Remote | JAN 2020 – DEC 2021', 'y', 'Security Analyst | Fabrikam | Remote | JAN 2018 – DEC 2019', 'z'].join('\n'))
  assert.deepEqual(r.list.map((x) => [x.title, x.org]), [['Cloud Security', 'Northwind'], ['Security Engineer', 'Contoso'], ['Security Analyst', 'Fabrikam']])
  const old = K.resumeRoles('EXPERIENCE\nCigna Healthcare — IAM Team Lead | Texas | Sep 2023 – Present\nDid IAM work.')
  assert.deepEqual([old.list[0].org, old.list[0].title], ['Cigna Healthcare', 'IAM Team Lead'])
})

test('prep projects name a resume employer and keep only figures the resume states', () => {
  const projects = [
    { id: 'p1', name: 'Enterprise Endpoint Hardening', employer: '', role: 'Lead Engineer', impact: 'Implemented GPO, Intune and CyberArk Privilege Manager controls, reducing endpoint policy violations by over 30%.' },
    { id: 'p2', name: 'HAR triage', employer: 'Citi', role: 'Senior Endpoint Security', impact: 'Analyzed HAR files, cutting mean time to detect by 40%.' },
    { id: 'p3', name: 'Ticket SLA', employer: 'CVS Health', role: 'Endpoint Security', impact: 'Resolved escalated endpoint tickets within SLA across 9+ years of practice.' },
  ]
  const kept = P.groundPrepProjects(projects, resume)
  assert.deepEqual(kept.map((p) => [p.name, p.employer]), [['HAR triage', 'Citi Bank'], ['Ticket SLA', 'CVS Health']])
  assert.equal(kept[0].impact, 'Analyzed HAR files.')
  assert.equal(kept[1].impact, 'Resolved escalated endpoint tickets within SLA across 9+ years of practice.')
  assert.equal(P.withoutUnsourcedFigures('Cut alert volume by 40%.', G.allowedNumbers(resume)), '')
})

test('prep reads every role through the digest and returns grounded projects', () => {
  const route = readFileSync(new URL('../../src/app/api/kompas/prep/route.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(route, /str\(config\.resume, 6000\)/)
  assert.match(route, /resumeDigest\(String\(config\.resume\)/)
  assert.match(route, /"employer": "the employer exactly as the ROLES line writes it"/)
  assert.match(route, /projects: grounded,/)
  assert.match(route, /q\.answer = q\.answer\.map\(\(a\) => withoutUnsourcedFigures\(a, figures\)\)/)
  const digest = K.resumeDigest(resume, 'Endpoint Analyst\nHAR files', 9000)
  for (const e of ['Citi Bank', 'CVS Health', 'City of San Diego (DOE)', 'Charter Communications', 'Accenture']) assert.ok(digest.includes(e), e)
})

test('an introduction opens with the total years when the resume states them, and prep keeps tools with their employer', async () => {
  const A = await import('../../src/lib/kompasAnswer.ts')
  assert.match(A.INTRO_CAREER_SPINE, /When the resume states the total years of experience, say that total in the opening sentence with the current identity/)
  assert.match(A.INTRO_CAREER_SPINE, /Each tool, client and achievement belongs to the role it is listed under/)   // the baseline stays
  const route = readFileSync(new URL('../../src/app/api/kompas/prep/route.ts', import.meta.url), 'utf8')
  assert.match(route, /A tool, platform or client named together with an employer must be one that employer's section of the resume lists\./)
})

// Judged 27 Oct 2026, round r02 against r01: one-sentence "how would you distinguish A, B, C and D" asks got no parts list,
// a closing "without ..." condition took the question mark and the ask was dropped, workarounds weakened controls, and the
// number guard turned event IDs and hypothesis labels into "several".
test('a listed set inside one sentence becomes one part per item, and a closing condition keeps the ask', async () => {
  const A = await import('../../src/lib/kompasAnswer.ts')
  const tell = A.requestedParts('A Windows endpoint can access public websites but intermittently loses access to an internal application after switching from office Wi-Fi to VPN. How would you distinguish DNS caching, overlapping routes, proxy selection, and NAC restrictions, and what evidence would confirm the root cause?')
  assert.deepEqual(tell.parts.slice(1), ['DNS caching: the evidence that confirms or rules it out', 'overlapping routes: the evidence that confirms or rules it out', 'proxy selection: the evidence that confirms or rules it out', 'NAC restrictions: the evidence that confirms or rules it out'])
  const kept = A.requestedParts('If a desktop application fails under TLS inspection while browser access works, how would you distinguish certificate pinning, mutual TLS, trust-store differences, and protocol incompatibility without broadly bypassing inspection?')
  assert.equal(kept.parts.length, 5)
  assert.deepEqual(kept.constraints, ['without broadly bypassing inspection'])
  assert.deepEqual(A.requestedParts('How would you segment the incidents, isolate interacting causes, prioritize controlled tests, and decide what to roll back within 45 minutes?').parts.slice(1), ['segment the incidents', 'isolate interacting causes', 'prioritize controlled tests', 'decide what to roll back within 45 minutes'])
  assert.deepEqual(A.requestedParts('Choose a real Citi or CVS incident involving authentication, certificate errors, or HTTP inspection: what was your initial hypothesis, which exact evidence disproved or confirmed it, what did you personally change, and how did you verify both recovery and prevention of recurrence?').parts.slice(1), ['what was your initial hypothesis', 'which exact evidence disproved or confirmed it', 'what did you personally change', 'how did you verify both recovery and prevention of recurrence'])
  assert.equal(A.requestedParts('Using your Splunk, Sentinel, and QRadar experience, how would you correlate endpoint processes, authentication failures, proxy events, and incident tickets while accounting for clock skew, duplicate records, shared IP addresses, renamed devices, and missing identifiers?').parts.length, 10)
  assert.deepEqual(A.requestedParts('Compare IDOR and CSRF.').parts, ['Compare IDOR and CSRF'])   // two things stay one comparison
})

test('safety and exactness sit on the baseline rule for scenarios and for incident stories', async () => {
  const R = await import('../../src/lib/kompasDesktopResponse.ts')
  for (const q of ['An endpoint outage is approaching its SLA deadline. How would you select a safe workaround?', 'Choose a real Citi incident: what did you personally change?']) {
    const g = R.desktopResponsePolicy('engineer', q).guidance
    assert.match(g, /Containment never weakens a security control/, q)
    assert.match(g, /never a subnet-wide allow, a disabled policy, or an inspection bypass beyond the named destination/, q)
    assert.match(g, /name only tools that employer's resume section lists/, q)
  }
  assert.doesNotMatch(R.desktopResponsePolicy('engineer', 'Define IDOR versus CSRF.').guidance, /Containment never weakens|resume section lists/)
})

test('event IDs and hypothesis labels stay as written; claimed results are still guarded', () => {
  const allowed = G.allowedNumbers('9+ years')
  const keep = [
    'I check the Windows Event Security log for 4624 and 4625 entries to verify the token.',
    'I then review the Security event IDs 4768/4769 for the alias versus the hostname to confirm the fallback.',
    'I assign tasks numbered 1-3: 1 – capture packets on the subnet, 2 – verify token issuance in Okta, 3 – check Zscaler logs.',
    'We build a hypothesis matrix labeling 1 equals Intune policy, 2 equals EPM rule, 3 equals CA renewal.',
  ]
  for (const s of keep) assert.equal(G.applyGuards(s, null, allowed).text, s)
  assert.doesNotMatch(G.applyGuards('I reduced alert noise by 40% across 200 endpoints.', null, allowed).text, /40%|200/)
})

// Owner's Kompas Master Rules (27 Oct 2026), §1 and §2: each interviewer ask takes its own lane, an ambiguous "would you"
// takes the scenario lane, a direct fact is answered first, and a follow-up continues the same case.
test('the Master Rules intent table holds: every example takes its lane', async () => {
  const R = await import('../../src/lib/kompasDesktopResponse.ts')
  const lane = (q) => R.desktopQuestionKind(q)
  assert.equal(lane('What is IDOR?'), 'definition')
  assert.equal(lane('IDOR vs CSRF'), 'comparison')
  assert.equal(lane('How does Kerberos authentication work?'), 'definition')
  assert.equal(lane('Tell me about a difficult EPM rollout.'), 'experience')
  assert.equal(lane('How would you investigate lateral movement?'), 'implementation')
  assert.equal(lane('Actually, the hosts files were clean, and it only fails when the laptops are on VPN. What changes in your reasoning?'), 'implementation')
  assert.equal(lane('CyberArk EPM blocks a signed business application after an update. Would you allow it? Explain your decision process.'), 'implementation')
  assert.equal(lane('Drawing on your experience with both platforms, how would you distinguish a detection difference from missing telemetry?'), 'implementation')
  assert.equal(lane('Choose a real Citi or CVS incident: what was your initial hypothesis, and how did you verify recovery?'), 'experience')
  const fact = R.desktopResponsePolicy('engineer', 'Have you configured CyberArk EPM?')
  assert.match(fact.guidance, /This asks for a fact about the candidate\. Answer it first, yes or no, from the resume/)
  for (const q of ['What happened after that?', 'What logs did you check?']) {
    const p = R.desktopResponsePolicy('engineer', q)
    assert.equal(p.kind, 'experience', q)
    assert.match(p.guidance, /This continues the case from the previous turn/, q)
  }
  assert.match(R.desktopResponsePolicy('engineer', 'What is IDOR?').guidance, /never announced \(no "The key takeaway is", "In conclusion", "To sum up"\)/)
})

// 27 Oct 2026: the live Model menu's "GPT Luna" reached the engine as liveModel and was ignored (every lane and both
// OpenRouter calls were the default model). A chosen model answers first, the default stays behind it.
test('the live Model choice reaches OpenRouter, with the default behind it', () => {
  const svc = readFileSync(new URL('../../src/lib/kompasAnswerService.ts', import.meta.url), 'utf8')
  assert.match(svc, /const LIVE_MODEL_IDS: Record<string, string> = \{ "gpt-5\.6-luna": "openai\/gpt-5\.6-luna" \}/)
  assert.match(svc, /return chosen \? \[chosen, PAID_MODEL\] : \[PAID_MODEL\]/)
  assert.equal((svc.match(/model, provider: LIVE_ROUTING, max_tokens: orCap\(maxTokens\)/g) || []).length, 2)
  const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
  assert.match(app, /const LIVE_MODELS = \["", "gpt-5\.6-luna"\]/)
})

test('round r03 defects: 802.1X stays a name, alerts are never muted, a diagnosis opens on a hypothesis', async () => {
  const R = await import('../../src/lib/kompasDesktopResponse.ts')
  const s = 'I check whether the device used 802.1X machine authentication before the user signed in.'
  assert.equal(G.applyGuards(s, null, G.allowedNumbers('')).text, s)
  const g = R.desktopResponsePolicy('engineer', 'How would you prove that TLS inspection is causing an application failure?').guidance
  assert.match(g, /An alert or detection is never muted or silenced to buy time\./)
  assert.match(g, /a root cause is stated only after the evidence that confirms it/)
})

// Owner, 27 Oct 2026: "work on most super technical depth answers into better narrative ways ... complex workflows which
// seems impossible to follow along and still grab audience full attention to the detail", then "Still Delivering that
// top notch technical depth responses addressing everything from the questions."
test('a complex flow is narrated as a map and one traced thing, with depth and every part kept', async () => {
  const R = await import('../../src/lib/kompasDesktopResponse.ts')
  for (const q of ['How would you design a log correlation query across Splunk, Sentinel and QRadar?', 'Tell me about a difficult EPM rollout.']) {
    const g = R.desktopResponsePolicy('engineer', q).guidance
    assert.match(g, /First give the map in one sentence/, q)
    assert.match(g, /the exact evidence an expert reads there, the log or event ID, the command, the setting, the error/, q)
    assert.match(g, /a long list of checks becomes several sentences, never fewer checks/, q)
    assert.match(g, /never from fewer specifics\. Every part the question asks for is still answered, at the same top technical depth/, q)
    assert.match(g, /Containment never weakens a security control/, q)   // the baseline stays beside it
  }
  for (const q of ['What is IDOR?', 'IDOR vs CSRF', 'Have you configured CyberArk EPM?']) assert.doesNotMatch(R.desktopResponsePolicy('engineer', q).guidance, /NARRATING A COMPLEX FLOW/, q)
  const s = "I'd build a hypothesis matrix: 1 CA renewal breaks TLS inspection, 2 Intune policy mis-applies conditional access, and 3 EPM rule blocks the new binary."
  assert.equal(G.applyGuards(s, null, G.allowedNumbers('')).text, s)
})

test('voice repair never cuts a condition that is still open into a claim of its own', async () => {
  const { voiceRepair } = await import('../../src/lib/kompasVoiceRepair.ts')
  const s = 'I would abandon the leading hypothesis the moment the nslookup returns the correct IP, the route table shows no overlap, the HAR shows the correct Zscaler proxy, and the NAC status is compliant, because those combined evidences prove the problem lies elsewhere.'
  assert.doesNotMatch(voiceRepair(s) || s, /proxy\. The NAC status is compliant/)
})

// Owner's live session, 27 Oct 2026: Director answers opened "as the Chief Information Security Officer (CISO)" and "as noted
// by the decision owner, Alice Smith". His wording ("Name the decision owner in that sentence") stays; the owner is a role.
test('the director owner is a role, never an invented person or a title the resume does not hold', () => {
  const svc = readFileSync(new URL('../../src/lib/kompasAnswerService.ts', import.meta.url), 'utf8')
  assert.match(svc, /Name the decision owner in that sentence\. Before closing/)
  assert.match(svc, /The decision owner is a role in the organisation \(the business owner of the platform, the risk owner, security leadership\), never a person's name, and the candidate keeps the title the resume gives: never speak as a CISO or any title the resume does not hold\./)
})
