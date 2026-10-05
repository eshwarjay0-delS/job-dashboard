// Mobile verification and the WhatsApp number, tested without any network: fetch is replaced by a script of replies.
// What these guard (2026-10-05): every sign-up was stuck on "Send code" because the provider refused the stored credentials, the
// provider's own sentence (with the account id in it) was shown in the form, and no finished user was ever shown a number to message.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ENV = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_VERIFY_SERVICE_SID', 'TWILIO_SERVICE_SID',
  'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_DISPLAY_NUMBER']
const SID = 'AC' + 'a1'.repeat(16), TOKEN = 'b2'.repeat(16), SERVICE = 'VA' + 'c3'.repeat(16)
const calls = []
let script = () => reply(500, {})
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) })
const stubFetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return script(String(url), init) }
const errors = []; const capture = (...a) => errors.push(a)
// Re-armed before every case: another test file in this process may have replaced fetch and console.error.
function env(values) { globalThis.fetch = stubFetch; console.error = capture; for (const k of ENV) delete process.env[k]; Object.assign(process.env, values); calls.length = 0; errors.length = 0 }
const basic = (user, pass) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')

const P = await import('../../src/lib/phoneVerify.ts')

test('a phone number is put in one form, or refused', () => {
  assert.equal(P.normalizePhone('3142559156'), '+13142559156')
  assert.equal(P.normalizePhone('1 (314) 255-9156'), '+13142559156')
  assert.equal(P.normalizePhone(' +919876543210 '), '+919876543210')
  for (const bad of ['', '12345', '+0123456789', 'call me', '314255915']) assert.equal(P.normalizePhone(bad), null)
})

test('a setting pasted with a line break, spaces or quotes still signs the request correctly', async () => {
  env({ TWILIO_ACCOUNT_SID: ` ${SID}\n`, TWILIO_AUTH_TOKEN: `"${TOKEN}"\r\n`, TWILIO_SERVICE_SID: `${SERVICE} ` })
  script = () => reply(201, { status: 'pending' })
  assert.deepEqual(await P.sendVerificationCode('+13142559156'), { ok: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `https://verify.twilio.com/v2/Services/${SERVICE}/Verifications`)
  assert.equal(calls[0].init.headers.Authorization, basic(SID, TOKEN))
  assert.equal(String(calls[0].init.body), 'To=%2B13142559156&Channel=sms')
})

test('an API key pair is used when one is set', async () => {
  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN, TWILIO_API_KEY_SID: 'SK' + 'd4'.repeat(16), TWILIO_API_KEY_SECRET: 'secretsecretsecret', TWILIO_VERIFY_SERVICE_SID: SERVICE })
  script = () => reply(201, { status: 'pending' })
  await P.sendVerificationCode('+13142559156')
  assert.equal(calls[0].init.headers.Authorization, basic('SK' + 'd4'.repeat(16), 'secretsecretsecret'))
})

test('the provider refusing our credentials is our problem, said plainly, and its own words never reach the person', async () => {
  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN, TWILIO_SERVICE_SID: SERVICE })
  const theirs = `authentication failed, auth token is not valid for account ${SID}`
  script = () => reply(401, { code: 20003, message: theirs, status: 401 })
  const r = await P.sendVerificationCode('+13142559156')
  assert.equal(r.ok, false); assert.equal(r.reason, 'credentials_rejected'); assert.equal(r.http, 503)
  assert.ok(!r.message.includes(SID) && !/auth token|twilio/i.test(r.message), r.message)
  assert.match(r.message, /Nothing is wrong with your number/)
  assert.ok(errors.length === 1 && JSON.stringify(errors[0]).includes('credentials_rejected'), 'the real reason is logged on the server')
  assert.ok(!JSON.stringify(errors).includes(TOKEN), 'the token is never logged')
})

test('each kind of refusal gets its own reason and a status the form can act on', async () => {
  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN, TWILIO_SERVICE_SID: SERVICE })
  const cases = [
    [404, { code: 20404 }, 'service_not_found', 503], [400, { code: 60200 }, 'invalid_number', 400], [400, { code: 60205 }, 'landline', 400],
    [429, { code: 60203 }, 'too_many_attempts', 429], [400, { code: 21608, message: 'The number is unverified. Trial accounts cannot send messages to unverified numbers' }, 'trial_account', 503],
    [403, { code: 60410 }, 'blocked', 400], [503, {}, 'provider_down', 503], [400, { code: 99999 }, 'refused', 503],
  ]
  for (const [status, body, reason, http] of cases) {
    script = () => reply(status, body)
    const r = await P.sendVerificationCode('+13142559156')
    assert.equal(r.reason, reason, `status ${status} code ${body.code}`); assert.equal(r.http, http, reason)
    assert.ok(r.message.length > 20 && !/twilio/i.test(r.message))
  }
  script = () => { throw new Error('network down') }
  assert.equal((await P.sendVerificationCode('+13142559156')).reason, 'provider_down')
})

test('a code is right only when the provider says approved; an expired or unknown code says so', async () => {
  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN, TWILIO_SERVICE_SID: SERVICE })
  script = () => reply(200, { status: 'approved' })
  assert.deepEqual(await P.checkVerificationCode('+13142559156', '123456'), { ok: true })
  assert.equal(calls[0].url, `https://verify.twilio.com/v2/Services/${SERVICE}/VerificationCheck`)
  assert.equal(String(calls[0].init.body), 'To=%2B13142559156&Code=123456')
  script = () => reply(200, { status: 'pending' })
  assert.equal((await P.checkVerificationCode('+13142559156', '000000')).reason, 'wrong_code')
  script = () => reply(404, { code: 20404 })
  const expired = await P.checkVerificationCode('+13142559156', '123456')
  assert.equal(expired.reason, 'expired'); assert.equal(expired.http, 400); assert.match(expired.message, /Send code/)
})

test('with a setting missing nothing is sent anywhere', async () => {
  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_SERVICE_SID: SERVICE })
  const r = await P.sendVerificationCode('+13142559156')
  assert.equal(r.reason, 'not_configured'); assert.equal(calls.length, 0)
})

test('the status check tells what is wrong without revealing any value', async () => {
  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN + ' ', TWILIO_SERVICE_SID: SERVICE })
  script = (url) => url.includes('api.twilio.com') ? reply(401, { code: 20003 }) : reply(200, {})
  let s = await P.phoneVerifyStatus()
  assert.equal(s.state, 'credentials_rejected'); assert.equal(s.settings.hadStraySpacesOrQuotes, true)
  assert.deepEqual([s.settings.accountId, s.settings.secret, s.settings.service, s.settings.using], ['ok', 'ok', 'ok', 'auth_token'])
  assert.match(s.fix, /Auth Token/); assert.ok(!JSON.stringify(s).includes(TOKEN) && !JSON.stringify(s).includes(SID))
  assert.ok(calls.every(c => (c.init.method || 'GET') === 'GET'), 'the check only reads: no message is sent')

  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: 'an-api-key-secret-pasted-here', TWILIO_SERVICE_SID: SERVICE })
  s = await P.phoneVerifyStatus()
  assert.equal(s.settings.secret, 'wrong_shape'); assert.match(s.fix, /32 letters and digits/)

  env({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: TOKEN, TWILIO_SERVICE_SID: SERVICE })
  script = (url) => url.includes('api.twilio.com') ? reply(200, { type: 'Full', status: 'active' }) : reply(404, {})
  assert.equal((await P.phoneVerifyStatus()).state, 'service_not_found')
  script = (url) => url.includes('api.twilio.com') ? reply(200, { type: 'Trial', status: 'active' }) : reply(200, { friendly_name: 'MarketFit' })
  s = await P.phoneVerifyStatus(); assert.equal(s.state, 'trial_account'); assert.match(s.fix, /trial account/)
  script = (url) => url.includes('api.twilio.com') ? reply(200, { type: 'Full', status: 'active' }) : reply(200, { friendly_name: 'MarketFit' })
  assert.deepEqual([(await P.phoneVerifyStatus()).state, (await P.phoneVerifyStatus()).fix], ['ok', ''])
  env({})
  assert.equal((await P.phoneVerifyStatus()).state, 'not_configured')
})

test('the number to message comes from the setting when there is one, and from the wired sender when there is not', async () => {
  env({ WHATSAPP_TOKEN: 'meta-token', WHATSAPP_PHONE_NUMBER_ID: '1234567890', WHATSAPP_DISPLAY_NUMBER: '+1 (555) 201-7131' })
  const W = await import('../../src/lib/whatsapp.ts?first')
  assert.equal(await W.waDisplayNumber(), '15552017131'); assert.equal(calls.length, 0, 'the setting needs no request')

  env({ WHATSAPP_TOKEN: 'meta-token', WHATSAPP_PHONE_NUMBER_ID: '1234567890' })
  script = () => reply(200, { display_phone_number: '+1 555-201-7131', account_mode: 'SANDBOX', id: '1234567890' })
  assert.equal(await W.waDisplayNumber(), '15552017131')
  assert.match(calls[0].url, /\/1234567890\?fields=display_phone_number,account_mode$/)
  assert.equal(calls[0].init.headers.Authorization, 'Bearer meta-token')
  assert.equal(await W.waDisplayNumber(), '15552017131'); assert.equal(calls.length, 1, 'asked once, then remembered')
  const s = await W.waStatus()
  assert.equal(s.state, 'test_number'); assert.equal(s.hasNumber, true); assert.match(s.fix, /test number/)

  const W2 = await import('../../src/lib/whatsapp.ts?second')
  env({}); assert.equal(await W2.waDisplayNumber(), ''); assert.equal((await W2.waStatus()).state, 'not_configured'); assert.equal(calls.length, 0)
  env({ WHATSAPP_TOKEN: 'meta-token', WHATSAPP_PHONE_NUMBER_ID: '1234567890' })
  script = () => reply(401, { error: { message: 'Error validating access token' } })
  assert.equal(await W2.waDisplayNumber(), ''); assert.equal((await W2.waStatus()).state, 'token_rejected')
  const W3 = await import('../../src/lib/whatsapp.ts?third')
  script = () => reply(200, { display_phone_number: '+1 314 555 0100', account_mode: 'LIVE' })
  assert.deepEqual([(await W3.waStatus()).state, await W3.waDisplayNumber()], ['ok', '13145550100'])
})

test('setup no longer asks for work authorization, and nothing requires it to finish', () => {
  const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
  const setup = read('src/app/dashboard/setup/page.tsx')
  assert.ok(!/WORK AUTHORIZATION/i.test(setup) && !/WORK_AUTHS/.test(setup), 'the block is gone from the form')
  assert.ok(!/workAuth:\s*d\.workAuth/.test(setup), 'setup does not send a work authorization')
  for (const p of ['src/app/api/profile/route.ts', 'src/app/api/onboarding/status/route.ts']) assert.ok(!/missing\.push\("work_auth"\)/.test(read(p)), p + ' does not require it')
  assert.match(read('src/app/api/profile/route.ts'), /body\.workAuth !== undefined \? \{ work_auth: body\.workAuth \}/, 'a save without it does not erase one set in Settings')
  for (const p of ['src/app/api/identity/phone/start/route.ts', 'src/app/api/identity/phone/confirm/route.ts']) {
    const s = read(p); assert.ok(!/body\?\.message|result\?\.message|error\.message \}/.test(s), p + ' does not pass a provider or database message to the browser')
  }
})

test('an owner named in settings is let through, and nobody else is', async () => {
  const O = await import('../../src/lib/owner.ts')
  delete process.env.ADMIN_EMAILS; delete process.env.WHATSAPP_OWNER_NUMBERS
  assert.equal(O.isAdminEmail('owner@example.com'), false); assert.equal(O.ownerWhatsAppUserId('13145550100', 'demo'), null)
  process.env.ADMIN_EMAILS = ' Owner@Example.com , second@example.com '
  assert.equal(O.isAdminEmail('owner@example.com'), true); assert.equal(O.isAdminEmail('OWNER@EXAMPLE.COM '), true)
  for (const no of ['', null, undefined, 'other@example.com', 'owner@example.com.evil.test', 'xowner@example.com']) assert.equal(O.isAdminEmail(no), false)
  process.env.WHATSAPP_OWNER_NUMBERS = '+1 (314) 555-0100, 919876543210=user-uuid-1'
  assert.equal(O.ownerWhatsAppUserId('13145550100', 'demo'), 'demo')
  assert.equal(O.ownerWhatsAppUserId('919876543210', 'demo'), 'user-uuid-1')
  for (const no of ['3145550100', '113145550100', '1314555010', '', '99913145550100']) assert.equal(O.ownerWhatsAppUserId(no, 'demo'), null, no)
  const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
  assert.match(read('src/app/api/whatsapp/webhook/route.ts'), /verifySignature\(raw[\s\S]{0,1600}resolveWhatsAppUserId\(from\)/, 'the signature is checked before the sender is trusted')
  delete process.env.ADMIN_EMAILS; delete process.env.WHATSAPP_OWNER_NUMBERS
})
