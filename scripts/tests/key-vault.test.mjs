// The admin's API keys and the checklist of what may use them (2026-10-07). A key is sealed before it is stored and never
// leaves the server again; a feature that is not ticked for a provider is served by the others; a person's own key is theirs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const V = await import('../../src/lib/keyVault.ts')
const L = await import('../../src/lib/llm.ts?vault')

// Stand-ins shaped like each provider's keys, put together here so no line of this file looks like a real one.
const fake = { openai: 'sk-' + 'a'.repeat(40), groq: 'gsk_' + 'b'.repeat(40), openrouter: 'sk-or-' + 'c'.repeat(40), anthropic: 'sk-ant-' + 'd'.repeat(40), gemini: 'AQ.' + 'e'.repeat(40) }
const SEAL = { KEY_VAULT_SECRET: 'placeholder-sealing-value-of-forty-chars!!' }
const secret = V.vaultSecret(SEAL)
const NOW = Date.UTC(2026, 9, 7, 18)
const docWith = (changes) => changes.reduce((doc, change) => V.changed(doc, change, secret, NOW), { v: 1, keys: {}, use: {}, updatedAt: '' })

const AI_ENV = ['OPENAI_API_KEY', 'OPEN_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'KEY_VAULT_SECRET', 'R2_SECRET_ACCESS_KEY', 'LLM_AUTO_FALLBACK_PAID', 'OPENROUTER_MODEL', 'OPENROUTER_MODEL_LIGHT']
function fresh(env = {}, changes = []) {
  for (const k of AI_ENV) delete process.env[k]
  Object.assign(process.env, SEAL, { LLM_RETRY_BUDGET_MS: '1', LLM_LEDGER: '0' }, env)
  V.useVaultDoc(changes.length ? docWith(changes) : null)
  L.forgetProviderFailures(); L.forgetOpenAILearning()
}

// ── sealing ──────────────────────────────────────────────────────────────────
test('a stored key opens only with the deployment\'s secret, only under the provider it was stored for, and not after a byte is changed', () => {
  const sealed = V.sealKey('openai', fake.openai, secret)
  assert.ok(!sealed.includes(fake.openai) && !sealed.includes('sk-'), 'what is stored does not contain the key')
  assert.equal(V.openKey('openai', sealed, secret), fake.openai)
  assert.equal(V.openKey('groq', sealed, secret), null, 'a sealed key cannot be moved under another provider')
  assert.equal(V.openKey('openai', sealed, V.vaultSecret({ KEY_VAULT_SECRET: 'another-placeholder-value-of-forty-chars!' })), null)
  const [iv, body, tag] = sealed.split('.')
  assert.equal(V.openKey('openai', [iv, body.slice(0, -2) + (body.endsWith('AA') ? 'BB' : 'AA'), tag].join('.'), secret), null)
  assert.equal(V.openKey('openai', 'nonsense', secret), null)
  assert.notEqual(V.sealKey('openai', fake.openai, secret), sealed, 'sealing twice never gives the same bytes')
})

test('with nothing to seal with, nothing is stored', () => {
  assert.equal(V.vaultSecret({}), null)
  assert.equal(V.vaultSecret({ KEY_VAULT_SECRET: 'short' }), null)
  assert.ok(V.vaultSecret({ R2_SECRET_ACCESS_KEY: 'placeholder-storage-secret-value' }), 'the storage account\'s own secret will do')
  assert.throws(() => V.changed({ v: 1, keys: {}, use: {}, updatedAt: '' }, { provider: 'groq', key: fake.groq }, null, NOW), /no-secret/)
})

test('the stored record of a key is its seal, its last four characters and the day, and nothing else of it', () => {
  const doc = docWith([{ provider: 'groq', key: fake.groq }])
  assert.deepEqual(Object.keys(doc.keys.groq).sort(), ['last4', 'sealed', 'setAt'])
  assert.equal(doc.keys.groq.last4, 'bbbb')
  assert.ok(!JSON.stringify(doc).includes(fake.groq))
  assert.equal(docWith([{ provider: 'groq', key: fake.groq }, { provider: 'groq', remove: true }]).keys.groq, undefined)
})

// ── what may be saved ────────────────────────────────────────────────────────
test('a pasted key is refused when it is not a whole key or belongs to another provider, and the refusal never repeats it', () => {
  assert.deepEqual(V.cleanKey('groq', '  ' + fake.groq + '\n'), { ok: true, key: fake.groq }, 'spaces and a line break around it are dropped')
  assert.equal(V.cleanKey('gemini', fake.gemini).ok, true, 'Gemini keys have no one shape')
  for (const [provider, raw] of [['openai', 'sk-short'], ['openai', fake.groq], ['groq', fake.openai], ['openai', fake.anthropic], ['openai', fake.openrouter], ['groq', 'gsk_' + 'b'.repeat(20) + ' ' + 'b'.repeat(20)], ['groq', 42], ['groq', undefined]]) {
    const r = V.cleanKey(provider, raw)
    assert.equal(r.ok, false, provider + ' ' + String(raw).slice(0, 8))
    assert.ok(typeof raw !== 'string' || raw.length < 12 || !r.why.includes(raw), 'the reason does not carry the key')
  }
  assert.match(V.cleanKey('openai', fake.groq).why, /Groq key, not a OpenAI key|Groq key/)
})

test('a checklist keeps only features that exist, each once', () => {
  assert.deepEqual(V.cleanUse(['interview-prep', 'made-up', 'resume-tailor', 'interview-prep', 7]), ['resume-tailor', 'interview-prep'], 'known features only, each once, in the order of the catalogue')
  assert.deepEqual(V.cleanUse([]), [], 'an empty checklist is a real choice: nothing may use the key')
  assert.equal(V.cleanUse('resume-tailor'), null)
})

// ── the checklist ────────────────────────────────────────────────────────────
test('until the admin says otherwise OpenAI is for the resume tailor only, and every other provider serves everything that runs here', () => {
  fresh()
  for (const f of ['resume-tailor', 'resume-change', 'resume-keywords']) assert.equal(V.allows('openai', f), true, f)
  for (const f of ['interview-prep', 'other', 'field-edit', 'kompas:flow', 'something-unlabelled']) assert.equal(V.allows('openai', f), false, f)
  for (const f of ['resume-tailor', 'interview-prep', 'other', 'kompas:flow', 'kompas:transcribe', 'something-unlabelled']) assert.equal(V.allows('groq', f), true, f)
  assert.ok(V.FEATURES.every(f => !f.elsewhere), 'no feature that runs on another deployment is offered until a key can really be handed to it')
  assert.equal(V.allows('openai', 'status-check'), true, 'the health check may always look at every key')
})

test('unticking a feature takes the deployment\'s key away from it and leaves a person\'s own key alone', () => {
  fresh({ GROQ_API_KEY: fake.groq, GEMINI_API_KEY: fake.gemini }, [{ provider: 'groq', use: ['resume-tailor'] }])
  const keys = L.resolveKeys({})
  assert.equal(L.applyVault(keys, 'resume-tailor').groq, fake.groq)
  assert.equal(L.applyVault(keys, 'interview-prep').groq, undefined, 'not ticked: as if Groq had no key')
  assert.equal(L.applyVault(keys, 'interview-prep').gemini, fake.gemini, 'the other providers serve it')
  const own = 'gsk_' + 'z'.repeat(40)
  const both = L.resolveKeys({ groqKey: own })
  assert.equal(both.groq, fake.groq, 'where the deployment has a key, that is the one in use')
  assert.equal(L.applyVault(both, 'resume-tailor').groq, fake.groq)
  assert.equal(L.applyVault(both, 'interview-prep').groq, own, 'unticked: as if the deployment had no key, so the person\'s own is the one used (found in review, 2026-10-08)')
  assert.equal(L.applyVault(L.applyVault(both, 'interview-prep'), 'interview-prep').groq, own, 'and applying it again changes nothing')
  assert.equal(L.applyVault(L.tailorKeys(both, { owner: true }), 'interview-prep').groq, own, 'the person\'s key is not lost when the tailor adds its own')
  assert.equal(L.applyVault({ groq: own }, 'interview-prep').groq, own, 'a key that is not the deployment\'s is the person\'s own: never taken out')
})

test('a key the admin stored replaces the deployment\'s own, is used where the deployment had none, and applying the checklist twice changes nothing', () => {
  const stored = 'gsk_' + 's'.repeat(40)
  fresh({ GROQ_API_KEY: fake.groq }, [{ provider: 'groq', key: stored }, { provider: 'gemini', key: fake.gemini }])
  assert.equal(V.vaultKey('groq'), stored)
  assert.equal(L.resolveKeys({}).groq, stored, 'the stored key is the deployment\'s key now')
  const cold = L.applyVault({ groq: fake.groq }, 'other')            // gathered before this server instance had read the vault
  assert.equal(cold.groq, stored); assert.equal(cold.gemini, fake.gemini)
  assert.deepEqual(L.applyVault(cold, 'other'), cold)
  fresh({ GROQ_API_KEY: fake.groq }, [{ provider: 'groq', key: stored }, { provider: 'groq', remove: true }])
  assert.equal(L.resolveKeys({}).groq, fake.groq, 'removing the stored key puts the deployment\'s own back in use')
})

test('an instance that has not managed to read the checklist does not spend a paid key on the strength of the defaults', async () => {
  fresh({ OPENAI_API_KEY: fake.openai, ANTHROPIC_API_KEY: fake.anthropic, GROQ_API_KEY: fake.groq })
  V.forgetVault()                                     // a cold start with storage failing
  assert.equal(V.allows('anthropic', 'other'), false); assert.equal(V.allows('openai', 'resume-tailor'), false); assert.equal(V.allows('openrouter', 'other'), false)
  assert.equal(V.allows('groq', 'other'), true, 'the free providers go on serving')
  assert.equal(V.allows('anthropic', 'status-check'), true, 'the health check may still look')
  const keys = L.applyVault(L.tailorKeys(L.resolveKeys({}), { owner: true }), 'resume-tailor')
  assert.deepEqual(Object.keys(keys).sort(), ['groq'], 'the tailor runs on the free lane until the checklist is known')
  V.useVaultDoc(null)                                 // the read succeeded: nothing is stored, the defaults are the truth
  assert.equal(V.allows('anthropic', 'other'), true); assert.equal(V.allows('openai', 'resume-tailor'), true)
})

test('a call never waits on storage once the vault is known, and waits a bounded time when it is not', async () => {
  fresh({ GROQ_API_KEY: fake.groq })
  let began = Date.now()
  await V.readyVault(); assert.ok(Date.now() - began < 200, 'known: no wait')
  const src = read('src/lib/keyVault.ts')
  assert.ok(/if \(known\) \{ void loadVault\(\); return \}/.test(src), 'refreshed behind the call')
  assert.ok(/Promise\.race\(\[loadVault\(\), new Promise<void>/.test(src), 'the first read is raced against a deadline')
  assert.ok(/readAt = ok \? Date\.now\(\) : Date\.now\(\) - TTL_MS \+ RETRY_MS/.test(src), 'a failed read is tried again in seconds, not half a minute')
  const llm = read('src/lib/llm.ts')
  assert.ok(/await readyVault\(\)\n/.test(llm) && !/await loadVault\(\)/.test(llm), 'callLLM and keysFor use the bounded wait')
})

test('the page is told which secret seals the keys, and an unread vault is an error, not the defaults', () => {
  assert.equal(V.sealedWith({ KEY_VAULT_SECRET: 'x'.repeat(40) }), 'own')
  assert.equal(V.sealedWith({ R2_SECRET_ACCESS_KEY: 'placeholder-storage-secret-value' }), 'storage')
  assert.equal(V.sealedWith({}), 'none')
  const route = read('src/app/api/admin/keys/route.ts')
  assert.ok(/if \(!\(await loadVault\(true\)\)\) return NextResponse\.json\(\{ error: "The stored keys and checklists could not be read/.test(route))
  assert.ok(/status: 503/.test(route.slice(route.indexOf('loadVault(true)'), route.indexOf('loadVault(true)') + 400)))
})

test('a stored key that no longer opens is not used, and the page is told to ask for it again', () => {
  for (const k of AI_ENV) delete process.env[k]
  process.env.KEY_VAULT_SECRET = 'another-placeholder-value-of-forty-chars!'
  V.useVaultDoc(docWith([{ provider: 'groq', key: fake.groq }]))      // sealed under the first secret, read under another
  assert.equal(V.vaultKey('groq'), undefined)
  const row = V.vaultRows(() => false).find(r => r.provider === 'groq')
  assert.equal(row.unreadable, true); assert.equal(row.kept, 'none'); assert.equal(row.last4, null)
})

test('what the page is shown about a key never contains the key', () => {
  fresh({ GROQ_API_KEY: fake.groq }, [{ provider: 'openai', key: fake.openai }])
  const rows = V.vaultRows(p => p === 'groq')
  const text = JSON.stringify(rows)
  assert.ok(!text.includes(fake.openai) && !text.includes(fake.groq) && !text.includes('sealed'))
  assert.equal(rows.find(r => r.provider === 'openai').kept, 'here'); assert.equal(rows.find(r => r.provider === 'openai').last4, 'aaaa')
  assert.equal(rows.find(r => r.provider === 'groq').kept, 'deployment'); assert.equal(rows.find(r => r.provider === 'groq').last4, null, 'nothing is said about a key kept on Vercel but that it is there')
  assert.equal(rows.find(r => r.provider === 'anthropic').kept, 'none')
})

// ── the model caller obeys it ────────────────────────────────────────────────
const calls = []
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) })
const chat = (text) => reply(200, { choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } })
const stub = async (url, init = {}) => { calls.push({ host: new URL(String(url)).host, auth: String((init.headers || {}).authorization || (init.headers || {}).Authorization || '') }); return String(url).includes('/v1/models') ? reply(200, { data: [{ id: 'gpt-6-luna' }] }) : chat('ok') }
const ask = (extra) => { globalThis.fetch = stub; calls.length = 0; return L.callLLM({ tier: 'light', system: 'S', user: 'U', maxTokens: 256, temperature: 0, ...extra }) }

test('an automatic call asks OpenAI only for a feature the admin ticked for it, and then asks it first', async () => {
  fresh({ OPENAI_API_KEY: fake.openai, GROQ_API_KEY: fake.groq })
  let r = await ask({ keys: L.resolveKeys({}), purpose: 'interview-prep' })
  assert.equal(r.provider, 'groq'); assert.ok(!calls.some(c => c.host === 'api.openai.com'), 'not ticked: OpenAI is not asked')
  r = await ask({ keys: { ...L.resolveKeys({}), openai: fake.openai }, purpose: 'interview-prep' })
  assert.equal(r.provider, 'groq', 'even when the caller holds the key')

  fresh({ OPENAI_API_KEY: fake.openai, GROQ_API_KEY: fake.groq }, [{ provider: 'openai', use: [...V.OPENAI_DEFAULT, 'interview-prep'] }])
  r = await ask({ keys: L.resolveKeys({}), purpose: 'interview-prep' })
  assert.equal(r.provider, 'openai', 'ticked: asked first, without the caller having to hand the key over')
  r = await ask({ keys: L.resolveKeys({}), purpose: 'other' })
  assert.equal(r.provider, 'groq', 'and only for the feature that was ticked')
})

test('a provider unticked for a feature is not asked for it, and the stored key is the one sent', async () => {
  const stored = 'gsk_' + 's'.repeat(40)
  fresh({ GROQ_API_KEY: fake.groq, GEMINI_API_KEY: fake.gemini }, [{ provider: 'gemini', use: [] }, { provider: 'groq', key: stored }])
  const r = await ask({ keys: L.resolveKeys({}), purpose: 'field-edit' })
  assert.equal(r.provider, 'groq')
  assert.ok(!calls.some(c => c.host.includes('googleapis')), 'Gemini has nothing ticked: never asked')
  assert.ok(calls.every(c => !c.auth.includes(fake.groq)) && calls.some(c => c.auth.includes(stored)), 'the key the admin stored is the one in use')
})

test('with every provider unticked for a feature the call fails plainly instead of quietly using a key it was told not to', async () => {
  fresh({ GROQ_API_KEY: fake.groq }, [{ provider: 'groq', use: [] }])
  await assert.rejects(ask({ keys: L.resolveKeys({}), purpose: 'field-edit' }), /No API key configured/)
  assert.equal(calls.length, 0)
})

// ── the doors ────────────────────────────────────────────────────────────────
test('the keys route is for admins only, takes changes only from this site, and never sends a key back or logs one', () => {
  const route = read('src/app/api/admin/keys/route.ts')
  const post = route.slice(route.indexOf('export async function POST'))
  assert.ok(/if \(!\(await adminOf\(request\)\)\)/.test(route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'))), 'the read is checked')
  assert.ok(post.indexOf('adminOf(request)') < post.indexOf('request.text()'), 'who is asking, before what was sent is read')
  assert.ok(post.indexOf('sec-fetch-site') < post.indexOf('adminOf(request)'), 'a request from another site is refused first')
  assert.ok(!/vaultKey|openKey|\.sealed/.test(route), 'the route has no way to read a key back')
  for (const line of route.split('\n').filter(l => /console\./.test(l))) assert.ok(!/change\.key\b(?! !== undefined)|body\.key|key\.key/.test(line), 'no key in a log line: ' + line.trim().slice(0, 60))
  assert.ok(/"Cache-Control": "no-store"/.test(route))
})

test('the field for a key hides what is typed, is emptied when the save answers, and keeps nothing in the browser', () => {
  const panel = read('src/app/dashboard/admin/keys-panel.tsx')
  assert.ok(/type="password"/.test(panel) && /autoComplete="off"/.test(panel))
  assert.ok(/setKey\(""\)/.test(panel), 'emptied after a save')
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(panel), 'never kept in the browser')
  assert.deepEqual(panel.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || [], [], 'theme tokens only')
  assert.ok(/type="checkbox"/.test(panel) && /features\.filter\(f => f\.app === app\)/.test(panel), 'the checklist is drawn from the server\'s list of features')
})

test('the resume tailor gathers its keys through the checklist, after the vault has been read', () => {
  const web = read('src/app/api/tailor/route.ts'), wa = read('src/app/api/whatsapp/webhook/route.ts')
  assert.ok(/await keysFor\("resume-tailor", \(\) => tailorKeys\(/.test(web))
  assert.ok(/await keysFor\("resume-tailor", \(\) => tailorKeys\(/.test(wa) && /await keysFor\("resume-change", \(\) => tailorKeys\(/.test(wa))
})
