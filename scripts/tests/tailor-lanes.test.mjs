// The resume tailor's providers (2026-10-05): GPT Luna for the owner's tailoring only, the free path when most providers are
// down, and the rule that an empty or refused draft is never presented as a tailored resume.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const L = await import('../../src/lib/llm.ts?lanes')
const W = await import('../../src/lib/tailorLanes.ts?lanes')

const calls = []
let script = () => reply(500, {})
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) })
const stubFetch = async (url, init = {}) => { const c = { url: String(url), init, body: init.body ? JSON.parse(init.body) : null }; calls.push(c); return script(c) }
const chat = (text) => reply(200, { choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } })
const AI_ENV = ['OPENAI_API_KEY', 'OPEN_API_KEY', 'OPENAI_TAILOR_FOR', 'OPENAI_MODEL_TAILOR', 'OPENAI_MODEL', 'GROQ_MAX_TOKENS', 'GROQ_TPM', 'GROQ_MODEL_HEAVY', 'GROQ_MODEL', 'GEMINI_MODEL_HEAVY', 'GEMINI_MODEL', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'LLM_RETRY_BUDGET_MS']
function fresh(values = {}) {
  globalThis.fetch = stubFetch                       // another test file in this process may have replaced it
  for (const k of AI_ENV) delete process.env[k]
  Object.assign(process.env, { LLM_RETRY_BUDGET_MS: '1' }, values)
  calls.length = 0; L.forgetProviderFailures(); L.forgetOpenAILearning()
}
const ask = (extra) => L.callLLM({ tier: 'heavy', system: 'S', user: 'U', maxTokens: 4096, temperature: 0.2, ...extra })
const host = (c) => new URL(c.url).host

// ── who gets the OpenAI key ──────────────────────────────────────────────────
test('the OpenAI key is handed over for the owner\'s tailoring only, and never by the general key lookup', () => {
  fresh({ OPENAI_API_KEY: 'k-openai', GROQ_API_KEY: 'k-groq' })
  assert.equal(L.resolveKeys({}).openai, undefined, 'the general lookup never returns it')
  assert.equal(L.tailorKeys(L.resolveKeys({}), { owner: true }).openai, 'k-openai')
  assert.equal(L.tailorKeys(L.resolveKeys({}), { owner: false }).openai, undefined, 'not for anyone else')
  process.env.OPENAI_TAILOR_FOR = 'all'; assert.equal(L.tailorKeys({}, { owner: false }).openai, 'k-openai')
  process.env.OPENAI_TAILOR_FOR = 'off'; assert.equal(L.tailorKeys({}, { owner: true }).openai, undefined)
  delete process.env.OPENAI_TAILOR_FOR; delete process.env.OPENAI_API_KEY
  assert.equal(L.tailorKeys({ groq: 'g' }, { owner: true }).openai, undefined, 'no key on the deployment, nothing to hand over')
  process.env.OPEN_API_KEY = 'k-as-saved'
  assert.equal(L.tailorKeys({}, { owner: true }).openai, 'k-as-saved', 'the name the owner saved it under on Vercel is read too')
  assert.equal(L.tailorKeys({}, { owner: false }).openai, undefined); assert.equal(L.resolveKeys({}).openai, undefined)
  delete process.env.OPEN_API_KEY
})

test('an automatic call never reaches OpenAI, even when the caller holds the key', async () => {
  fresh()
  script = () => chat('ok')
  const out = await ask({ keys: { openai: 'k-openai', groq: 'k-groq' } })
  assert.equal(out.provider, 'groq'); assert.ok(calls.every(c => host(c) !== 'api.openai.com'))
  await assert.rejects(ask({ keys: { openai: 'k-openai' } }), /No API key configured/, 'with nothing else there is no automatic provider at all')
  calls.length = 0
  assert.equal((await ask({ keys: { openai: 'k-openai', groq: 'k-groq' }, pref: 'openai' })).provider, 'openai', 'only a call that names it')
  assert.equal(calls[0].body.model, 'gpt-6-luna'); assert.equal(calls[0].init.headers.authorization, 'Bearer k-openai')
})

test('where the callers of the tailor get their keys, read from the source', () => {
  const route = read('src/app/api/tailor/route.ts'), bot = read('src/app/api/whatsapp/webhook/route.ts')
  assert.match(route, /tailorKeys\(resolveKeys\(body\), \{ owner: isAdminEmail\(user\.email\) \}\)/)
  assert.equal((bot.match(/tailorKeys\(resolveKeys\(\{\}\), \{ owner: isOwnerWhatsApp\(from\) \}\)/g) || []).length, 2, 'both the first draft and a swipe-reply change')
  assert.match(read('src/lib/authBoundary.ts'), /email_confirmed_at \? data\.user\.email \?\? null : null/, 'an unconfirmed email is not an admin email')
  for (const p of ['src/app/api/auto-reply/tick/route.ts', 'src/lib/llmStatus.ts']) assert.ok(!/OPENAI_API_KEY/.test(read(p)), p + ' does not read the key itself')
  const others = ['src/lib/claude.ts', 'src/lib/workflows/interview-prep.ts']
  for (const p of others) assert.ok(!/tailorKeys|OPENAI_API_KEY/.test(read(p)), p)
})

// ── automatic calls fall through ─────────────────────────────────────────────
test('an automatic call asks the next provider when the first is out of credit, and asks the dead one last afterwards', async () => {
  fresh()
  script = (c) => host(c).includes('googleapis') ? reply(402, { error: { message: 'Your prepayment credits are depleted.' } }) : chat('from groq')
  const keys = { gemini: 'k-gem', groq: 'k-groq', anthropic: 'k-ant' }
  const first = await ask({ keys })
  assert.equal(first.provider, 'groq'); assert.deepEqual(calls.map(c => host(c).split('.')[0]), ['generativelanguage', 'api'])
  calls.length = 0
  await ask({ keys })
  assert.equal(calls.length, 1, 'the provider that is out of credit is not asked again while another answers'); assert.equal(host(calls[0]), 'api.groq.com')
  script = (c) => host(c).includes('groq') ? reply(429, { error: { message: 'Rate limit reached' } }) : host(c).includes('anthropic') ? reply(529, {}) : reply(200, { candidates: [{ content: { parts: [{ text: 'gemini is back' }] } }] })
  calls.length = 0
  assert.equal((await ask({ keys })).text, 'gemini is back', 'and it is still asked when nothing else answers')
})

test('a call that names its provider asks only that one, and that is where an exact model applies', async () => {
  fresh()
  script = () => reply(402, { error: { message: 'no credit' } })
  await assert.rejects(ask({ keys: { gemini: 'k', groq: 'k' }, pref: 'gemini' }), /Gemini API 402/)
  assert.equal(calls.length, 1)
  script = () => chat('ok'); calls.length = 0
  await ask({ keys: { groq: 'k' }, pref: 'groq', exactModel: 'qwen/qwen3.8-27b' })
  assert.equal(calls[0].body.model, 'qwen/qwen3.8-27b')
  await ask({ keys: { groq: 'k' }, exactModel: 'qwen/qwen3.8-27b' })
  assert.equal(calls[1].body.model, 'openai/gpt-oss-120b', 'an automatic call keeps each provider\'s own model')
})

// ── Groq: the reply ceiling and the reasoning ────────────────────────────────
test('on Groq the reply ceiling is what the per-minute allowance has left after the prompt, and gpt-oss is told to reason little', async () => {
  fresh()
  script = () => chat('{}')
  const big = 'x'.repeat(12800)                                   // about 4,000 tokens at 3.2 characters a token
  await ask({ keys: { groq: 'k' }, pref: 'groq', user: big })
  const estimate = Math.ceil((1 + big.length) / 3.2)
  assert.equal(calls[0].body.max_tokens, 8000 - estimate - 250); assert.ok(calls[0].body.max_tokens > 1500, 'more than the old fixed 1,500')
  assert.equal(calls[0].body.reasoning_effort, 'low')
  await ask({ keys: { groq: 'k' }, pref: 'groq', user: 'short' })
  assert.equal(calls[1].body.max_tokens, 4096, 'never more than the caller asked for')
  await ask({ keys: { groq: 'k' }, pref: 'groq', user: 'x'.repeat(40000) })
  assert.equal(calls[2].body.max_tokens, 1024, 'and never so little that no answer fits')
  await ask({ keys: { groq: 'k' }, pref: 'groq', exactModel: 'qwen/qwen3.8-27b' })
  assert.ok(!('reasoning_effort' in calls[3].body), 'qwen does not reason unless asked, so it is not asked')
  process.env.GROQ_MAX_TOKENS = '6000'
  await ask({ keys: { groq: 'k' }, pref: 'groq', user: big, maxTokens: 8192 })
  assert.equal(calls[4].body.max_tokens, 6000, 'a paid tier can fix the ceiling')
})

// ── OpenAI: a key that could not be tried beforehand ─────────────────────────
test('OpenAI: a refused field is dropped and asked again, and a model id the account lacks is looked up', async () => {
  fresh()
  script = (c) => {
    if (c.url.endsWith('/v1/models')) return reply(200, { data: [{ id: 'gpt-6-luna-pro' }, { id: 'gpt-5.6-luna' }, { id: 'gpt-6-luna-2026-09-02' }, { id: 'gpt-6' }] })
    if (c.body.model === 'gpt-6-luna') return reply(404, { error: { message: 'The model `gpt-6-luna` does not exist or you do not have access to it.', code: 'model_not_found' } })
    if ('temperature' in c.body) return reply(400, { error: { message: "Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.", param: 'temperature', code: 'unsupported_value' } })
    return chat('{"bullets":[]}')
  }
  const out = await ask({ keys: { openai: 'k' }, pref: 'openai' })
  assert.equal(out.text, '{"bullets":[]}'); assert.equal(out.model, 'gpt-6-luna-2026-09-02', 'the id that answered is the one reported')
  const last = calls[calls.length - 1].body
  assert.equal(last.model, 'gpt-6-luna-2026-09-02'); assert.ok(!('temperature' in last)); assert.equal(last.max_completion_tokens, 4096); assert.equal(last.reasoning_effort, 'low')
  calls.length = 0
  await ask({ keys: { openai: 'k' }, pref: 'openai' })
  assert.equal(calls.length, 1, 'what was learned is kept: the next call goes straight through')
})

test('OpenAI: a 400 that is not about an unsupported field is reported, not "healed"', async () => {
  fresh()
  script = () => reply(400, { error: { message: "Invalid 'max_completion_tokens': integer below minimum value.", param: 'max_completion_tokens', code: 'integer_below_min_value' } })
  await assert.rejects(ask({ keys: { openai: 'k' }, pref: 'openai' }), /OpenAI API 400/)
  assert.equal(calls.length, 1)
  script = (c) => 'max_tokens' in c.body ? chat('old style') : reply(400, { error: { message: "Unsupported parameter: 'max_completion_tokens' is not supported with this model. Use 'max_tokens' instead.", param: 'max_completion_tokens', code: 'unsupported_parameter' } })
  L.forgetOpenAILearning(); calls.length = 0
  assert.equal((await ask({ keys: { openai: 'k' }, pref: 'openai' })).text, 'old style')
  script = () => reply(401, { error: { message: 'Incorrect API key provided', code: 'invalid_api_key' } })
  L.forgetOpenAILearning(); calls.length = 0
  await assert.rejects(ask({ keys: { openai: 'k' }, pref: 'openai' }), /OpenAI API 401/); assert.equal(calls.length, 1, 'a rejected key is not retried')
})

test('choosing the model that stands for "gpt-6-luna" in an account\'s list', () => {
  const pick = L.closestOpenAIModel
  assert.equal(pick('gpt-6-luna', ['gpt-6-luna', 'gpt-6-luna-pro', 'gpt-5.6-luna']), 'gpt-6-luna')
  assert.equal(pick('gpt-6-luna', ['gpt-5.6-luna', 'gpt-6-luna-pro', 'gpt-6-luna-2026-09-02']), 'gpt-6-luna-2026-09-02', 'newest version; a dated snapshot counts, a "pro" variant does not')
  assert.equal(pick('gpt-6-luna', ['gpt-5.6-luna-2026-05-01', 'gpt-5.6-luna']), 'gpt-5.6-luna', 'undated before dated')
  assert.equal(pick('gpt-6-luna', ['gpt-6', 'gpt-6-luna-pro', 'o9-mini']), null, 'nothing that is plainly Luna: say so instead of guessing')
  assert.equal(pick('gpt-6', ['gpt-6-luna']), null)
})

// ── the lanes ────────────────────────────────────────────────────────────────
const lane = (pref, label) => ({ pref, model: label, label })
const never = Date.now() + 60_000
const spread = (o) => W.workParts({ out: new Map(), says: (_p, e) => e !== 'empty', startBy: never, assembleBy: never, ...o })

test('a healthy first provider writes the whole draft by itself, in one burst', async () => {
  const asked = []
  const lanes = [lane('openai', 'luna'), lane('groq', 'g120'), lane('groq', 'qwen')]
  const out = await spread({ parts: ['profile', 'roles-1', 'roles-2'], lanes, ask: async (p, l) => { asked.push(`${l.label}:${p}`); return `${p} by ${l.label}` } })
  assert.deepEqual(asked, ['luna:profile', 'luna:roles-1', 'luna:roles-2']); assert.deepEqual(out.map(w => w.via), ['luna', 'luna', 'luna'])
})

test('when the leading providers are dead the parts spread in order: the profile to the strongest lane left', async () => {
  const asked = []
  const lanes = [lane('openai', 'luna'), lane('gemini', 'gemini'), lane('groq', 'g120'), lane('groq', 'qwen'), lane('groq', 'g20'), lane('openrouter', 'glm'), lane('openrouter', 'nemotron')]
  const out = new Map()
  const done = await spread({ parts: ['profile', 'roles-1', 'roles-2', 'roles-3'], lanes, out, ask: async (p, l) => {
    asked.push(`${l.label}:${p}`)
    if (l.label === 'luna') throw new Error('OpenAI API 401: Incorrect API key provided')
    if (l.label === 'gemini') throw new Error('Gemini API 402: Your prepayment credits are depleted')
    if (l.label === 'glm') throw new Error('OpenRouter API 404: This model is unavailable for free')
    await new Promise(r => setTimeout(r, 5)); return `${p} by ${l.label}`
  } })
  assert.deepEqual(done.map(w => w.via), ['g120', 'qwen', 'g20', 'nemotron'], 'one part per free lane, most important part first')
  assert.equal(asked.filter(a => a.startsWith('luna:')).length, 4); assert.equal(asked.filter(a => a.startsWith('gemini:')).length, 4)
  assert.equal(asked.filter(a => a.startsWith('glm:')).length, 1, 'a dead lane is asked once, not once per part')
  assert.equal(asked.length, 4 + 4 + 1 + 4, 'and nothing is asked twice: before, the same draft took 43 calls')
  assert.equal(out.get(lanes[0]), 'dead'); assert.equal(out.get(lanes[1]), 'dead'); assert.equal(out.get(lanes[5]), 'dead')
})

test('a lane whose allowance is spent takes no more, and the part it refused is done by another lane', async () => {
  const lanes = [lane('groq', 'g120'), lane('groq', 'qwen')]
  const out = new Map(); let g120 = 0
  const done = await spread({ parts: ['profile', 'roles-1', 'roles-2'], lanes, out, ask: async (p, l) => {
    if (l.label === 'g120' && ++g120 > 1) throw new Error('Groq API 429: Rate limit reached for model on tokens per minute')
    await new Promise(r => setTimeout(r, 3)); return `${p} by ${l.label}`
  } })
  assert.deepEqual(done.map(w => w.via), ['g120', 'qwen', 'qwen']); assert.equal(out.get(lanes[0]), 'busy'); assert.equal(g120, 2)
})

test('an empty reply from a free model is offered to other lanes; from a wide lane it is the answer', async () => {
  const lanes = [lane('groq', 'g120'), lane('groq', 'qwen'), lane('groq', 'g20'), lane('openrouter', 'nemotron')]
  const one = await spread({ parts: ['roles-1'], lanes, ask: async (_p, l) => l.label === 'g120' ? 'empty' : 'rewritten' })
  assert.deepEqual(one.map(w => [w.e, w.via]), [['rewritten', 'qwen']])
  const asked = []
  const none = await spread({ parts: ['roles-1'], lanes, ask: async (_p, l) => { asked.push(l.label); return 'empty' } })
  assert.deepEqual(asked, ['g120', 'qwen', 'g20'], 'three lanes agree: nothing to change'); assert.deepEqual(none.map(w => [w.e, w.via]), [['empty', 'g120']].map(([e]) => [e, 'g20']))
  const wide = await spread({ parts: ['roles-1'], lanes: [lane('openai', 'luna'), ...lanes], ask: async (_p, l) => { asked.push(l.label); return 'empty' } })
  assert.deepEqual(wide.map(w => [w.e, w.via]), [['empty', 'luna']]); assert.equal(asked.filter(a => a === 'luna').length, 1)
  assert.equal(asked.length, 4, 'no free lane is asked to second-guess the strong one')
})

test('when time is nearly up the draft is made of what came back, and nothing new is started late', async () => {
  const lanes = [lane('groq', 'g120'), lane('groq', 'qwen')]
  const t0 = Date.now()
  const done = await W.workParts({ parts: ['profile', 'roles-1'], lanes, out: new Map(), says: () => true, startBy: t0 + 5000, assembleBy: t0 + 60,
    ask: (p, l) => new Promise(r => setTimeout(() => r(`${p} by ${l.label}`), l.label === 'qwen' ? 2000 : 5)) })
  assert.ok(Date.now() - t0 < 1000, 'did not wait for the slow call'); assert.deepEqual(done.map(w => w.e), ['profile by g120', null])
  let started = 0
  const late = await W.workParts({ parts: ['profile'], lanes, out: new Map(), says: () => true, startBy: t0 - 1, assembleBy: Date.now() + 50, ask: async () => { started++; return 'x' } })
  assert.equal(started, 0); assert.deepEqual(late.map(w => w.e), [null])
})

test('a part every lane refused comes back with the reason, and a timeout does not close a lane', async () => {
  const lanes = [lane('groq', 'g120'), lane('groq', 'qwen')]
  const out = new Map()
  const done = await spread({ parts: ['profile', 'roles-1'], lanes, out, ask: async (p, l) => {
    if (p === 'profile') throw new Error('TimeoutError: The operation was aborted due to timeout')
    return `${p} by ${l.label}`
  } })
  assert.equal(done[0].e, null); assert.match(String(done[0].err), /Timeout/); assert.equal(done[1].e, 'roles-1 by qwen', 'the lane that timed out on one part still did another... or the next lane did')
  assert.equal(out.size, 0, 'a timeout is not "dead" or "busy"')
})

// ── what the tailor and the bot promise, read from the source ────────────────
test('an incomplete or unchanged draft is not stored, not sent as tailored, and old stored drafts are not served', () => {
  const tailor = read('src/lib/tailor.ts'), bot = read('src/app/api/whatsapp/webhook/route.ts'), claude = read('src/lib/claude.ts')
  assert.match(tailor, /if \(!result\.partial && !result\.unchanged\) await blob\.put\(cacheKey/)
  assert.match(tailor, /\[J1_VERSION, CACHE_GENERATION, normJD\(jd\)/, 'drafts stored before the fix are not served again')
  assert.match(tailor, /\.\.\.\(diff\.length \? \{\} : \{ unchanged: true \}\)/)
  assert.match(tailor, /if \(failed \* 2 > total\) throw new Error\(`Tailoring incomplete/)
  assert.match(tailor, /LADDER\.unshift\(lunaStep\)/, 'GPT Luna leads when the caller holds the key')
  assert.match(tailor, /for \(const lane of splitDraft \? lanes\.slice\(0, 1\) : lanes\)/, 'a split draft is made once: it already uses every lane')
  assert.match(bot, /if \(result\.unchanged\) \{[\s\S]{0,400}I am not sending you the same file/)
  assert.match(claude, /API \(400\|401\|402\|403\|404\|413\|429\)\\b\|TimeoutError/, 'a refusal that will not clear, or a timeout, is not asked again on the same model')
})
