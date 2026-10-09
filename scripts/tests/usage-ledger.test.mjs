// The admin's numbers (2026-10-07): what a model call cost, how a call is written down and read back, how a week of resumes is
// summed, and who may put numbers into the ledger from outside. Every one of these is arithmetic or a check with no network and
// no storage, so each is held still here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const P = await import('../../src/lib/llmPrices.ts')
const C = await import('../../src/lib/llmLedger.ts')
const T = await import('../../src/lib/tailorLedger.ts')
const I = await import('../../src/lib/usageIngest.ts')

// ── prices ───────────────────────────────────────────────────────────────────
test('a paid call costs its tokens at the table price, a free call costs nothing, and a model with no price is counted as unknown, never as free', () => {
  delete process.env.GROQ_BILLED
  const priced = P.priceCalls([
    { provider: 'openai', model: 'gpt-6-luna', input: 1_000_000, output: 1_000_000 },
    { provider: 'groq', model: 'openai/gpt-oss-120b', input: 5000, output: 900 },
    { provider: 'openrouter', model: 'some/unknown-model', input: 100, output: 100 },
  ])
  assert.equal(priced.costUsd, 0.6, 'one million in at $0.10 and one million out at $0.50')
  assert.equal(priced.calls, 3)
  assert.equal(priced.unpricedCalls, 1, 'the unknown model is the only unpriced call')
  assert.deepEqual(priced.byModel.map(m => m.kind).sort(), ['free', 'priced', 'unpriced'])
  assert.equal(priced.byModel.find(m => m.kind === 'unpriced').costUsd, 0)
})

test('a Groq key that has moved to a paid tier stops being counted as free', () => {
  process.env.GROQ_BILLED = '1'
  try { assert.equal(P.priceCalls([{ provider: 'groq', model: 'openai/gpt-oss-120b', input: 10, output: 10 }]).byModel[0].kind, 'unpriced') }
  finally { delete process.env.GROQ_BILLED }
})

// ── one call, written down and read back ─────────────────────────────────────
const call = (over = {}) => ({ at: Date.UTC(2026, 9, 7, 15, 4, 5), app: 'marketfit', purpose: 'resume-tailor', provider: 'openai', model: 'gpt-6-luna', ok: true, input: 4200, output: 900, cacheRead: 0, cacheWrite: 0, ms: 3100, ...over })

test('a call survives being written as a storage key and read back, with nothing in the key but counts and labels', () => {
  const key = C.callKey(call(), 'abc123')
  assert.ok(key.startsWith('usage/llm/2026-10-07/'), 'filed under the UTC day it was made')
  assert.deepEqual(C.callFromKey(key), call())
})

test('a model id with a slash and a colon is one safe file name and comes back as it went in', () => {
  const c = call({ app: 'kompas', provider: 'openrouter', model: 'nvidia/nemotron-3-super:free', purpose: 'prep-review' })
  const key = C.callKey(c, 'abc123')
  const name = key.slice(key.lastIndexOf('/') + 1)
  assert.ok(!/[\\/:*?"<>|]/.test(name), 'no character a Windows disk or an object store refuses: ' + name)
  assert.deepEqual(C.callFromKey(key), c)
})

test('a refused call keeps its status and is counted as failed, not as a call that cost nothing', () => {
  const c = call({ ok: false, status: 429, input: 0, output: 0 })
  assert.deepEqual(C.callFromKey(C.callKey(c, 'abc123')), c)
  const sum = C.summarizeCalls([call(), c])
  assert.equal(sum.calls, 2); assert.equal(sum.failed, 1)
})

test('a file in the folder that is not a call is ignored, not read as one', () => {
  for (const key of ['usage/llm/2026-10-07/notes.txt', 'usage/llm/2026-10-07/a__b__c.json', 'usage/llm/2026-10-07/x__marketfit__p__q__m__ok__i1__o1__c0__w0__t1.json']) assert.equal(C.callFromKey(key), null, key)
})

test('the summary splits calls by app and by job, so MarketFit and Kompas are told apart', () => {
  const sum = C.summarizeCalls([
    call(), call({ purpose: 'resume-keywords', input: 1000, output: 100 }),
    call({ app: 'kompas', purpose: 'prep-review', provider: 'groq', model: 'qwen/qwen3.8-27b', input: 2000, output: 300 }),
  ])
  assert.deepEqual(Object.keys(sum.byApp).sort(), ['kompas', 'marketfit'])
  assert.equal(sum.byApp.marketfit.calls, 2); assert.equal(sum.byApp.kompas.calls, 1)
  assert.equal(sum.byApp.kompas.costUsd, 0, 'the free model costs nothing')
  assert.ok(sum.byApp.marketfit.costUsd > 0)
  assert.ok(sum.byPurpose.some(p => p.app === 'kompas' && p.purpose === 'prep-review'))
  assert.equal(Math.round(sum.costUsd * 1e6), Math.round((sum.byApp.marketfit.costUsd + sum.byApp.kompas.costUsd) * 1e6), 'the parts add up to the whole')
})

// ── resumes ──────────────────────────────────────────────────────────────────
const usage = (cost) => ({ calls: 4, inputTokens: 9000, outputTokens: 2000, cacheReadTokens: 0, cacheWriteTokens: 0, estCostUSD: cost, unpricedCalls: 0, byModel: [{ provider: 'openai', model: 'gpt-6-luna', calls: 4, input: 9000, output: 2000, costUsd: cost, kind: 'priced' }] })
const made = (at, over = {}) => T.tailorEvent({ channel: 'whatsapp', kind: 'tailor', personId: '13145550100', startedAt: at - 20_000, at, result: { notes: ['Tailored with gpt-6-luna · 4 calls'], usage: usage(0.002) }, ...over })

test('a record of a resume holds a hash of who asked, never the number or the account', () => {
  const e = made(Date.UTC(2026, 9, 7, 18))
  assert.equal(e.outcome, 'whole'); assert.equal(e.via, 'gpt-6-luna'); assert.equal(e.ms, 20_000)
  assert.ok(/^[a-f0-9]{12}$/.test(e.person))
  assert.ok(!JSON.stringify(e).includes('13145550100'), 'the sender is not in the record')
  assert.notEqual(T.personOf('whatsapp', '13145550100'), T.personOf('web', '13145550100'), 'salted by channel')
})

test('unchanged, partial, cached and failed are each their own outcome, and only a resume that came back changed counts as generated', () => {
  const at = Date.UTC(2026, 9, 7, 18)
  const events = [
    made(at),
    made(at, { result: { partial: true, notes: [], usage: usage(0.001) } }),
    made(at, { result: { unchanged: true, notes: [], usage: usage(0.001) } }),
    made(at, { result: { cached: true, notes: [], usage: usage(0.002) }, personId: 'someone-else' }),
    made(at, { result: undefined, error: new Error('Tailoring timed out after 55s') }),
  ]
  assert.deepEqual(events.map(e => e.outcome), ['whole', 'partial', 'unchanged', 'cached', 'failed'])
  assert.equal(events[4].failure, 'timed out')
  assert.equal(events[3].costUsd, 0, 'a result served again made no call now, so it costs nothing now')
  const w = T.summarizeTailor(events)
  assert.equal(w.generated, 2); assert.equal(w.unchanged, 1); assert.equal(w.cached, 1); assert.equal(w.failed, 1)
  assert.equal(w.people, 2, 'two different people asked')
  assert.equal(Math.round(w.costUsd * 1e6), 4000, 'whole + partial + unchanged were paid for')
})

test('today, the last seven days and the month are the admin\'s days in the admin\'s time zone, not UTC\'s', () => {
  const zone = 'America/Chicago'
  const now = Date.UTC(2026, 9, 8, 3, 30)            // 22:30 on 7 Oct in Chicago, already 8 Oct in UTC
  assert.equal(T.dayIn(zone, now), '2026-10-07')
  const events = [
    made(Date.UTC(2026, 9, 8, 2)),                    // 21:00 on the 7th, Chicago: today
    made(Date.UTC(2026, 9, 7, 3)),                    // 22:00 on the 6th, Chicago: yesterday
    made(Date.UTC(2026, 9, 2, 18)),                   // the 2nd: this week
    made(Date.UTC(2026, 8, 29, 18)),                  // 29 Sep: outside the seven days, and last month
  ]
  const o = T.overviewOf(events, now, zone)
  assert.equal(o.today.generated, 1); assert.equal(o.week.generated, 3); assert.equal(o.month.generated, 3)
  assert.equal(o.days.length, 7); assert.equal(o.days[6].day, '2026-10-07'); assert.equal(o.days[6].generated, 1)
  assert.equal(o.recent.length, 4); assert.ok(o.recent[0].at > o.recent[1].at, 'newest first')
  assert.ok(o.recent.every(r => !('person' in r)), 'the latest list carries no person at all')
})

// ── reports from Kompas ──────────────────────────────────────────────────────
const NOW = Date.UTC(2026, 9, 7, 18)
const report = (over = {}, callOver = {}) => JSON.stringify({ app: 'kompas', sentAt: NOW, calls: [{ at: NOW - 2000, purpose: 'prep-review', provider: 'groq', model: 'qwen/qwen3.8-27b', ok: true, input: 1200, output: 300, ms: 900, ...callOver }], ...over })

test('the two apps derive the same signing key from the Groq key they share, and the Groq key itself is not that key', () => {
  const a = I.ingestKey({ GROQ_API_KEY: 'placeholder-groq-value' }), b = I.ingestKey({ GROQ_API_KEY: 'placeholder-groq-value' })
  assert.equal(a, b); assert.ok(/^[a-f0-9]{64}$/.test(a)); assert.ok(!a.includes('placeholder'))
  assert.notEqual(I.ingestKey({ GROQ_API_KEY: 'another-value' }), a)
  assert.equal(I.ingestKey({}), null, 'nothing to derive from: reports cannot be checked, and the route says so')
  const own = 'x'.repeat(40)
  assert.equal(I.ingestKey({ GROQ_API_KEY: 'placeholder-groq-value', USAGE_INGEST_SECRET: own }), own, 'an explicit secret wins')
  assert.equal(I.ingestKey({ GROQ_API_KEY: 'placeholder-groq-value', USAGE_INGEST_SECRET: 'short' }), a, 'a secret too short to be one is not used')
})

test('a report is accepted only with the signature of its exact body', () => {
  const key = I.ingestKey({ GROQ_API_KEY: 'placeholder-groq-value' }), body = report()
  const sig = I.signReport(body, key)
  assert.equal(I.reportIsSigned(body, sig, key), true)
  assert.equal(I.reportIsSigned(body.replace('1200', '9200'), sig, key), false, 'a changed number breaks it')
  assert.equal(I.reportIsSigned(body, sig, I.ingestKey({ GROQ_API_KEY: 'another-value' })), false)
  for (const bad of [null, '', 'nonsense', sig.slice(0, 40), sig.toUpperCase()]) assert.equal(I.reportIsSigned(body, bad, key), false, String(bad))
})

test('a report is filed as Kompas, whatever it claims, and its calls keep only counts and labels', () => {
  const r = I.readReport(report({}, { app: 'marketfit', words: 'a secret sentence' }), NOW)
  assert.equal(r.ok, true)
  assert.equal(r.calls[0].app, 'kompas')
  assert.deepEqual(Object.keys(r.calls[0]).sort(), ['app', 'at', 'cacheRead', 'cacheWrite', 'input', 'model', 'ms', 'ok', 'output', 'provider', 'purpose'])
  assert.deepEqual(C.callFromKey(C.callKey(r.calls[0], 'abc123')), r.calls[0], 'and it is a call the ledger can file')
})

test('a stale, oversized, misshapen or back-dated report is refused whole', () => {
  assert.deepEqual(I.readReport('{', NOW), { ok: false, because: 'not-json' })
  assert.equal(I.readReport(report({ app: 'someone' }), NOW).because, 'unknown-app')
  assert.equal(I.readReport(report({ sentAt: NOW - I.MAX_SKEW_MS - 1 }), NOW).because, 'stale', 'a captured report cannot be replayed later')
  assert.equal(I.readReport(report({ calls: [] }), NOW).because, 'too-many')
  assert.equal(I.readReport(report({ calls: Array(I.MAX_CALLS_PER_REPORT + 1).fill({}) }), NOW).because, 'too-many')
  assert.equal(I.readReport(report({}, { at: NOW - 3 * 86_400_000 }), NOW).because, 'stale', 'no filing a call into last week')
  for (const bad of [{ input: -1 }, { input: 'many' }, { model: '' }, { model: 'x'.repeat(65) }, { purpose: 'a\nb' }, { ok: 'yes' }, { status: 'bad' }, { output: 1e12 }]) {
    assert.equal(I.readReport(report({}, bad), NOW).because, 'wrong-shape', JSON.stringify(bad))
  }
})

// ── the doors ────────────────────────────────────────────────────────────────
test('every admin route asks the server who is asking, and the usage report is refused to anyone who is not an admin', () => {
  const usage = read('src/app/api/admin/usage/route.ts'), config = read('src/app/api/admin/config/route.ts'), access = read('src/lib/adminAccess.ts')
  assert.ok(/if \(!\(await adminOf\(request\)\)\) return NextResponse\.json\(\{ error: "Admins only\." \}, \{ status: 403/.test(usage), 'checked before anything is read')
  assert.ok(usage.indexOf('adminOf(request)') < usage.indexOf('readTailorEvents('), 'the check comes first')
  assert.equal((config.match(/if \(!\(await authed\(req\)\)\)/g) || []).length, 2, 'both the read and the write of the config')
  assert.ok(/isAdminEmail\(user\.email\)/.test(access) && /authenticatedUser\(request\)/.test(access), 'an admin is a signed-in person whose confirmed email is listed')
  assert.ok(!/@gmail\.com|@[a-z0-9-]+\.[a-z]{2,}/i.test(access.replace(/eshwarjay0@gmail\.com is the admin/, '')), 'no address is written into the code: the list is a setting')
})

test('the Admin link is shown only to an admin and is kept out of the lists everyone sees', () => {
  const nav = read('src/app/dashboard/_components/nav.tsx'), side = read('src/app/dashboard/sidebar-nav.tsx')
  const everyone = nav.slice(nav.indexOf('export const NAV_SECTIONS'), nav.indexOf('export const NAV_ITEMS'))
  assert.ok(!everyone.includes('/dashboard/admin'), 'not in the sections the sidebar and the Home tiles list for everyone')
  assert.ok(/export const ADMIN_NAV/.test(nav) && /\{admin && ADMIN_NAV\.map/.test(side))
  assert.ok(/fetch\("\/api\/admin\/me"/.test(side), 'the sidebar asks the server; it does not decide from the email it can see')
  assert.ok(/setAdmin\(false\)/.test(side), 'the link goes at once on sign-out or an account switch')
})

test('an admin is not sent through setup, by the server\'s answer and by the sidebar\'s own check', () => {
  const status = read('src/app/api/onboarding/status/route.ts'), side = read('src/app/dashboard/sidebar-nav.tsx')
  const skip = status.indexOf('if (user.email_confirmed_at && isAdminEmail(user.email))')
  assert.ok(skip > 0, 'only an address the identity provider has confirmed')
  assert.ok(/complete: true/.test(status.slice(skip, skip + 200)))
  assert.ok(skip < status.indexOf('const missing: string[] = []'), 'answered before anything is found missing')
  assert.ok(side.indexOf('if (isAdmin || window.location.pathname.startsWith("/dashboard/setup")) return') < side.indexOf('router.replace("/dashboard/setup")'), 'the sidebar leaves an admin where they are')
})

test('the admin page is built from the dashboard\'s own tokens and parts, with no colour of its own', () => {
  const page = read('src/app/dashboard/admin/page.tsx')
  assert.ok(/import PageIntro from "\.\.\/_components\/page-intro"/.test(page) && /import \{ Card, Chip, Meta \} from "\.\.\/_suite\/ui"/.test(page))
  assert.deepEqual(page.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || [], [], 'every colour is a theme token, so Paper and Night both hold')
  assert.ok(/fetch\("\/api\/admin\/usage"/.test(page), 'its numbers come from the checked route and nowhere else')
})

// ── found in review, 2026-10-08 ──────────────────────────────────────────────
test('the last seven days are seven different calendar days on the nights the clocks change', () => {
  assert.deepEqual(T.daysEnding('2026-11-01', 7), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  const zone = 'America/Chicago'
  // 23:30 on 1 November 2026 in Chicago, the 25-hour day: 24 hours earlier is still 1 November.
  const autumn = T.overviewOf([], Date.UTC(2026, 10, 2, 5, 30), zone)
  assert.equal(autumn.today.generated, 0); assert.equal(new Set(autumn.days.map(d => d.day)).size, 7)
  assert.equal(autumn.days[6].day, '2026-11-01'); assert.equal(autumn.days[0].day, '2026-10-26')
  // 00:30 on 9 March 2026 in Chicago, the night after the 23-hour day.
  const spring = T.overviewOf([], Date.UTC(2026, 2, 9, 5, 30), zone)
  assert.deepEqual(spring.days.map(d => d.day), ['2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'])
  assert.ok(/new Set<string>\(daysEnding\(today, 7\)\)/.test(read('src/app/api/admin/usage/route.ts')), 'the model calls use the same seven days')
})

test('a report delivered twice is the same records, not twice as many', async () => {
  const one = C.callKey(call({ app: 'kompas' }), 'abcdef012345'), again = C.callKey(call({ app: 'kompas' }), 'abcdef012345')
  assert.equal(one, again, 'a record named after its report lands on the same name')
  assert.notEqual(C.callKey(call({ app: 'kompas' })), C.callKey(call({ app: 'kompas' })), 'this app\'s own calls stay distinct')
  const route = read('src/app/api/usage/ingest/route.ts')
  assert.ok(/const stamp = createHash\("sha256"\)\.update\(body\)\.digest\("hex"\)/.test(route) && /recordLlmCall\(call, createHash\("sha256"\)\.update\(`\$\{stamp\}:\$\{i\}`\)/.test(route))
  assert.deepEqual(C.callFromKey(one), call({ app: 'kompas' }), 'and it is still a record the ledger reads')
})

test('a cost that leaves something out is carried as such to every line that shows it', () => {
  const sum = C.summarizeCalls([call({ provider: 'gemini', model: 'gemini-3.5-flash-lite', purpose: 'field-edit' }), call()])
  const edit = sum.byPurpose.find(p => p.purpose === 'field-edit')
  assert.equal(edit.unpricedCalls, 1); assert.equal(edit.costUsd, 0, 'no price is known for it: the page shows "not known", never $0')
  assert.equal(sum.byPurpose.find(p => p.purpose === 'resume-tailor').unpricedCalls, 0)
  const at = Date.UTC(2026, 9, 7, 18)
  const unpriced = { calls: 2, inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0, estCostUSD: 0, unpricedCalls: 2, byModel: [] }
  const o = T.overviewOf([made(at, { result: { notes: [], usage: unpriced } }), made(at, { result: undefined, error: new Error('Tailoring timed out') })], at, 'America/Chicago')
  assert.equal(o.week.byChannel.whatsapp.unpricedCalls, 2); assert.equal(o.days[6].unpricedCalls, 2); assert.equal(o.recent.find(r => r.outcome === 'whole').unpricedCalls, 2)
  const page = read('src/app/dashboard/admin/page.tsx')
  assert.ok(/const cost = \(usd: number, more: boolean\) => \(more \? \(usd > 0 \? `\$\{money\(usd\)\} or more` : "not known"\) : money\(usd\)\)/.test(page))
  assert.ok(/cost\(p\.costUsd, p\.unpricedCalls > 0\)/.test(page) && /r\.outcome === "failed" \? "not known"/.test(page) && /cost\(v\.costUsd, v\.unpricedCalls > 0 \|\| v\.failed > 0\)/.test(page))
  assert.ok(/left\.openai\.unpricedCalls > 0 \? "at most, " : ""/.test(page), 'what is left of the OpenAI budget is "at most" when a call had no price')
})

test('"counting began" is said only when it began inside what is shown, and what a failed request cost is counted from the calls', () => {
  const route = read('src/app/api/admin/usage/route.ts')
  assert.ok(/llm\.calls\[0\]\.at > Date\.parse\(`\$\{readFrom\}T00:00:00Z`\) \+ 2 \* 86_400_000/.test(route))
  assert.ok(/empty: llm\.calls\.length === 0 && tailors\.events\.length === 0/.test(route))
  assert.ok(/p\.app === "marketfit" && p\.purpose\.startsWith\("resume-"\)/.test(route), 'the cost of one resume includes what failed requests spent')
})


test('failed generations retain billable reported usage in every cost total', () => {
  const failed = call({ ok: false, status: 500, input: 1_000_000, output: 1_000_000 })
  const refusal = call({ ok: false, status: 429, input: 0, output: 0 })
  const sum = C.summarizeCalls([failed, refusal])
  assert.equal(sum.failed, 2)
  assert.equal(sum.failedWithUsage, 1)
  assert.equal(sum.failedWithoutUsage, 1)
  assert.equal(sum.costUsd, 0.6)
  assert.equal(sum.input, 1_000_000)
  assert.equal(sum.output, 1_000_000)
  assert.equal(sum.byApp.marketfit.costUsd, 0.6)
  assert.equal(sum.byPurpose[0].costUsd, 0.6)
  assert.equal(sum.meanMs, 0, 'failed requests do not become successful latency samples')
})

test('unknown models remain unpriced even when generation fails after reporting usage', () => {
  const sum = C.summarizeCalls([call({ ok: false, provider: 'unknown', model: 'unknown', input: 800 })])
  assert.equal(sum.unpricedCalls, 1)
  assert.equal(sum.failedWithUsage, 1)
  assert.equal(sum.byApp.marketfit.unpricedCalls, 1)
  assert.equal(sum.byPurpose[0].unpricedCalls, 1)
})
