import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// tailor/file served any .docx to whoever presented its URL token, with no
// caller check (ACCEPTED RISK, 2026-09-02). Since 2026-11-01 the caller must
// be signed in (session cookie or Bearer token); the URL token only selects
// the document. The check runs before the blob read so anonymous callers
// cannot probe token existence via 404-vs-401.
const src = readFileSync(new URL('../../src/app/api/tailor/file/route.ts', import.meta.url), 'utf8')

test('tailor/file requires a signed-in caller', () => {
  assert.ok(src.includes('authenticatedUserId, signInRequired } from "@/lib/authBoundary"'), 'boundary helper imported')
  assert.ok(src.includes('await authenticatedUserId(request)'), 'caller resolved from the request')
  assert.ok(src.includes('if (!userId) return signInRequired()'), 'anonymous callers refused with 401')
})

test('tailor/file checks the caller before reading the blob', () => {
  const authAt = src.indexOf('if (!userId) return signInRequired()')
  const blobAt = src.indexOf('blob.get(`tailored/')
  assert.ok(authAt > 0 && blobAt > authAt, 'auth gate precedes the blob read — no anonymous existence oracle')
})

test('tailor/file no longer claims anonymous access', () => {
  assert.ok(!src.includes('ACCEPTED RISK'), 'stale accepted-risk note gone')
  assert.ok(!src.includes('NO authentication'), 'stale no-authentication claim gone')
})
