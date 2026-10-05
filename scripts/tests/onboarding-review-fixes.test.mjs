// The fixes that came out of the review of the phone verification change (2026-10-05), each pinned by a test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SID = 'AC' + 'a1'.repeat(16), TOKEN = 'b2'.repeat(16), SERVICE = 'VA' + 'c3'.repeat(16), KEY = 'SK' + 'd4'.repeat(16)
const calls = []
let script = () => reply(500, {})
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) })
const stubFetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return script(String(url), init) }
const logged = []; const capture = (...a) => logged.push(a)
function env(values) {
  globalThis.fetch = stubFetch; console.error = capture     // another test file in this process may have replaced them
  for (const k of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_VERIFY_SERVICE_SID', 'TWILIO_SERVICE_SID']) delete process.env[k]
  Object.assign(process.env, values); calls.length = 0; logged.length = 0
}
const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const P = await import('../../src/lib/phoneVerify.ts?review')

test('a number written the way a contact card writes it is accepted, and a + number is never re-read as a US one', () => {
  for (const typed of ['+1 (314) 255-9156', '+1 314 255 9156', '+1-314-255-9156', '+1.314.255.9156', '+13142559156']) assert.equal(P.normalizePhone(typed), '+13142559156', typed)
  assert.equal(P.normalizePhone('+44 7911 123456'), '+447911123456')
  assert.equal(P.normalizePhone('+52 1234 5678'), '+5212345678', 'not turned into +1…')
  for (const bad of ['+0123456789', '+1 (314) 255', '+', '0123456789', '1123456789']) assert.equal(P.normalizePhone(bad), null, bad)
  const form = read('src/app/dashboard/setup/page.tsx')
  assert.ok(form.includes('const compact = raw.replace(/[\\s().-]/g, "")'), 'the form applies the same rule as the server')
})

test('mistyping the code too often is not called "too many codes requested"', async () => {
  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN, TWILIO_SERVICE_SID: SERVICE })
  script = () => reply(429, { code: 60202, message: 'Max check attempts reached' })
  const wrong = await P.checkVerificationCode('+13142559156', '000000')
  assert.equal(wrong.reason, 'too_many_wrong_codes'); assert.equal(wrong.http, 429); assert.match(wrong.message, /wrong codes/)
  script = () => reply(429, { code: 60203, message: 'Max send attempts reached' })
  const sends = await P.sendVerificationCode('+13142559156')
  assert.equal(sends.reason, 'too_many_attempts'); assert.match(sends.message, /codes were requested/)
})

test('a refusal that repeats the person\'s number is logged with only its last four digits', async () => {
  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN, TWILIO_SERVICE_SID: SERVICE })
  script = () => reply(400, { code: 21608, message: 'The number +13142559156 is unverified. Trial accounts cannot send messages to unverified numbers' })
  await P.sendVerificationCode('+13142559156')
  const line = JSON.stringify(logged)
  assert.ok(!line.includes('13142559156') && line.includes('***9156'), line)
})

test('with an API key pair the status check names the pair, and does not ask a standard key to read the account', async () => {
  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN, TWILIO_API_KEY_SID: KEY, TWILIO_API_KEY_SECRET: 'a-long-enough-secret', TWILIO_SERVICE_SID: SERVICE })
  script = () => reply(401, { code: 20003 })
  const s = await P.phoneVerifyStatus()
  assert.equal(s.state, 'credentials_rejected'); assert.equal(s.settings.using, 'api_key')
  assert.match(s.fix, /API key pair/); assert.ok(!/Copy the Account SID and the live Auth Token/.test(s.fix), s.fix)
  assert.ok(calls.every(c => !c.url.includes('/Accounts/')), 'the account itself is not read with a key pair')
  script = () => reply(200, { friendly_name: 'MarketFit' })
  assert.equal((await P.phoneVerifyStatus()).state, 'ok')
})

test('what the routes and the engine promise, read from the source', () => {
  const start = read('src/app/api/identity/phone/start/route.ts')
  assert.match(start, /checkRateLimit\(`phone-start:\$\{user\.id\}`/, 'Send code is limited per person')
  const health = read('src/app/api/health/services/route.ts')
  assert.match(health, /inflight \?\?= build\(\)/, 'requests that arrive together share one probe')
  const identity = read('src/lib/identityStatus.ts')
  assert.match(identity, /identity_bind_verified_phone/, 'the function that links a number is probed, not only the lookup')
  assert.match(identity, /ONBOARDING_PHONE_STRICT/, 'the owner can force the phone requirement')
  for (const p of ['src/app/api/profile/route.ts', 'src/app/api/onboarding/status/route.ts']) assert.match(read(p), /phoneStepAvailable\(\)/, p)
  const tailor = read('src/lib/tailor.ts')
  assert.match(tailor, /if \(failed \* 2 > total\) throw new Error\(`Tailoring incomplete/, 'a draft most providers refused is not delivered as a draft')
  const bot = read('src/app/api/whatsapp/webhook/route.ts')
  assert.match(bot, /'s_Resume`/, 'the file is named after the person'); assert.match(bot, /sendDocument\(from, file, `\$\{name\}\.docx`/)
  assert.ok(!/Something went wrong: \$\{String\(e\)[^`]*`\)[^\n]*runTailor/.test(bot) && /Nothing was changed/.test(bot), 'a failed tailor is said plainly')
})
