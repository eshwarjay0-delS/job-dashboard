import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import path from 'node:path'
import { safeAuthNext } from '../../src/lib/authRedirect.ts'

const source = stripTypeScriptTypes(readFileSync(new URL('../../src/lib/authBoundary.ts', import.meta.url), 'utf8'))
  .replace(/^import .*$/gm, '').replace(/export /g, '')
function boundary(result, throws = false) {
  let calls = 0
  const client = async () => { calls++; if (throws) throw new Error('offline'); return { auth: { getUser: async () => result } } }
  const context = vm.createContext({ path, Response, createClient: client, createClientFromRequest: client })
  vm.runInContext(source, context)
  return { context, calls: () => calls }
}
function request(headers = {}, method = 'POST') {
  return { headers: new Headers(headers), method, nextUrl: new URL('https://app.example/api/resumes') }
}
test('authentication fails closed for missing, anonymous, errored, or unreachable sessions', async () => {
  for (const result of [{ data: { user: null } }, { data: { user: { id: 'a', is_anonymous: true } } }, { data: { user: { id: 'a' } }, error: new Error('invalid') }]) {
    assert.equal(await boundary(result).context.authenticatedUserId(request()), null)
  }
  assert.equal(await boundary(null, true).context.authenticatedUserId(request()), null)
  assert.equal(await boundary({ data: { user: { id: 'a' } } }).context.authenticatedUserId(request()), 'a')
})
test('cookie mutations reject foreign origins and malformed credentials cannot fall back', async () => {
  for (const headers of [{ origin: 'https://attacker.example' }, { 'sec-fetch-site': 'cross-site' }, { authorization: 'Basic bad' }, { authorization: 'Bearer ' }]) {
    const b = boundary({ data: { user: { id: 'a' } } })
    assert.equal(await b.context.authenticatedUserId(request(headers)), null)
    assert.equal(b.calls(), 0)
  }
  const b = boundary({ data: { user: { id: 'a' } } })
  assert.equal(await b.context.authenticatedUserId(request({ authorization: 'Bearer extension-token', origin: 'chrome-extension://abc' })), 'a')
})
test('resume ownership rejects sibling, shared, parent and non-document paths', () => {
  const { context } = boundary(null)
  for (const candidate of ['/data/resumes/b/file.docx', '/data/resumes/a-copy/file.docx', '/data/resumes/a/../b/file.docx', '/data/shared/file.docx', '/data/resumes/a', '/data/resumes/a/_keywords.json', null]) {
    assert.equal(context.ownedResumePath('/data/resumes', 'a', candidate), null)
  }
  assert.equal(context.ownedResumePath('/data/resumes', 'a', '/data/resumes/a/folder/resume.docx'), '/data/resumes/a/folder/resume.docx')
})
test('authentication redirects remain within dashboard routes', () => {
  for (const value of ['https://evil.example/dashboard', '//evil.example/dashboard', '/dashboard/../../login', '/dashboard\\evil', 'javascript:alert(1)', '/dashboardish', null]) assert.equal(safeAuthNext(value), '/dashboard')
  assert.equal(safeAuthNext('/dashboard/resume?mode=edit#review'), '/dashboard/resume?mode=edit#review')
})
test('sign-in rejection is explicit and cannot be cached', async () => {
  const response = boundary(null).context.signInRequired()
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal((await response.json()).code, 'AUTH_REQUIRED')
})
test('download handler denies shared and other-user files before reading storage', async () => {
  const b = boundary({ data: { user: { id: 'a' } } })
  let reads = 0
  const download = stripTypeScriptTypes(readFileSync(new URL('../../src/app/api/resumes/download/route.ts', import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '').replace(/export /g, '')
  Object.assign(b.context, {
    NextResponse: Response, USER_RESUMES_BASE: '/data/resumes',
    readPath: async () => { reads++; return Buffer.from('document') }, Uint8Array,
  })
  vm.runInContext(download, b.context)
  for (const file of ['/data/shared/person.docx', '/data/resumes/b/person.docx']) {
    const r = request({}, 'GET'); r.nextUrl = new URL(`https://app.example/api/resumes/download?filepath=${encodeURIComponent(file)}`)
    assert.equal((await b.context.GET(r)).status, 403)
  }
  assert.equal(reads, 0)
  const r = request({}, 'GET'); r.nextUrl = new URL('https://app.example/api/resumes/download?filepath=/data/resumes/a/resume.docx')
  const response = await b.context.GET(r)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(reads, 1)
})
