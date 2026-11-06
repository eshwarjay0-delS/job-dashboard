// Desktop sign-in is a 3-day family the website cookie rotation does not own.
// Proactive reauth starts when 24 hours remain and is still required with 10
// hours left. A failed renewal does not erase the stored desktop refresh.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import {
  exchangeDesktopSession,
  createDesktopSessionMemory,
} from '../../src/lib/desktopSession.ts'

const require = createRequire(import.meta.url)
const auth = require('../../legacy/perfact/desktop/marketfit-auth.cjs')
const {
  SESSION_MS,
  PROACTIVE_BEFORE_MS,
  PROACTIVE_DEADLINE_MS,
  proactiveReauthDue,
  proactiveReauthInWindow,
} = auth

const HOUR = 60 * 60 * 1000
const T0 = 1_700_000_000_000

test('the desktop family lasts 3 days and reauth is due from 24 hours out', () => {
  assert.equal(SESSION_MS, 3 * 24 * HOUR)
  assert.equal(PROACTIVE_BEFORE_MS, 24 * HOUR)
  assert.equal(PROACTIVE_DEADLINE_MS, 10 * HOUR)
  const expires = T0 + SESSION_MS
  assert.equal(proactiveReauthDue(expires - PROACTIVE_BEFORE_MS - 1, expires), false)
  assert.equal(proactiveReauthInWindow(expires - PROACTIVE_BEFORE_MS - 1, expires), false)
  assert.equal(proactiveReauthDue(expires - PROACTIVE_BEFORE_MS, expires), true)
  assert.equal(proactiveReauthInWindow(expires - PROACTIVE_BEFORE_MS, expires), true)
  assert.equal(proactiveReauthInWindow(expires - 18 * HOUR, expires), true)
  assert.equal(proactiveReauthInWindow(expires - PROACTIVE_DEADLINE_MS, expires), true)
  assert.equal(proactiveReauthInWindow(expires - PROACTIVE_DEADLINE_MS + 1, expires), false)
  assert.equal(proactiveReauthDue(expires - HOUR, expires), true)
  assert.equal(proactiveReauthDue(expires + HOUR, expires), true)
})

test('a website rotation does not present the desktop refresh, and the mint names the account', async () => {
  let n = 0
  const families = new Map()
  function issue(userId) {
    const familyId = 'fam-' + (++n)
    const refreshToken = familyId + '-r0'
    families.set(familyId, { userId, current: refreshToken, revoked: false })
    return {
      accessToken: familyId + '-a0',
      refreshToken,
      expiresAt: 1_800_000_000,
      familyId,
      userId,
    }
  }
  const port = {
    async userFromAccessToken(accessToken) {
      return accessToken === 'live-bearer' ? { id: 'user-1', email: 'person@example.com' } : null
    },
    async refreshPresented(refreshToken) {
      for (const family of families.values()) {
        if (!family.revoked && family.current === refreshToken) {
          return { session: { ...issue(family.userId), accessToken: 'rotated' }, error: null }
        }
      }
      return { session: null, error: { message: 'invalid_grant', code: 'invalid_grant' } }
    },
    async mintIndependentSession(user) {
      return { session: issue(user.id), error: null }
    },
  }
  const memory = createDesktopSessionMemory()
  const web = issue('user-1')
  const opened = await exchangeDesktopSession({ accessToken: 'live-bearer', refreshToken: '' }, port, memory)
  assert.equal(opened.status, 200)
  assert.equal(opened.body.session, 'desktop')
  assert.equal(opened.body.user_id, 'user-1')
  assert.notEqual(opened.body.refresh_token, web.refreshToken)
  families.get(web.familyId).revoked = true
  const renewed = await exchangeDesktopSession(
    { accessToken: null, refreshToken: opened.body.refresh_token },
    port,
    memory,
  )
  assert.equal(renewed.status, 200)
  assert.equal(renewed.body.user_id, 'user-1')
  assert.equal(families.get(web.familyId).revoked, true)
})

test('the shell calls the desktop route, remembers hide, and does not request elevation', () => {
  const main = readFileSync(new URL('../../legacy/perfact/desktop/main.js', import.meta.url), 'utf8')
  const client = readFileSync(new URL('../../legacy/perfact/desktop/marketfit-auth.cjs', import.meta.url), 'utf8')
  const runtime = readFileSync(new URL('../../legacy/perfact/desktop/scripts/runtime.mjs', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
  assert.match(client, /\/api\/auth\/desktop-session/)
  assert.doesNotMatch(client, /\/api\/auth\/refresh/)
  assert.match(main, /if \(desktopAuth\.hasSession\(\)\) return;/)
  assert.match(main, /checkboxLabel: "Remember this choice"/)
  assert.match(main, /rememberedTaskbar\(saved\)/)
  assert.match(main, /audio: "loopback"/)
  assert.match(main, /chooseCaptureSource\(/)
  assert.match(runtime, /asInvokerManifest/)
  assert.doesNotMatch(runtime, /highestAvailable/)
  assert.match(page, /refreshAuth\("rejected"\)/)
  assert.match(page, /await window\.kompasDesktop\.refreshAuth\(\)/)
  const phrases = page.slice(page.indexOf('const PHRASE_FIXES'), page.indexOf('function fixTerms'))
  assert.match(phrases, /PHRASE_FIXES/)
})
