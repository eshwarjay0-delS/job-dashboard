import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import { summarizeBudgetAudio } from '../../src/lib/budgetAudio.ts'
import { pointsToDisplay } from '../../src/lib/creditsLedger.ts'
import { sessionProviderAllowed } from '../../src/lib/sessionProviders.ts'

const now = Date.parse('2026-10-15T03:00:00Z') // still October 14 in Chicago
const call = (over = {}) => ({ at: now - 1000, app: 'kompas', purpose: 'transcribe', provider: 'groq', model: 'whisper-large-v3-turbo', ok: true, seconds: 3600, ms: 10, ...over })
test('audio uses minutes, actual models, local today and provider-specific totals', () => {
  const prior = process.env.GROQ_BILLED
  process.env.GROQ_BILLED = '1'
  try {
    const result = summarizeBudgetAudio([call(), call({at: now - 86400000}), call({ok:false}), call({model:'unknown',seconds:60})], now)
    assert.equal(result.todaySeconds, 3660)
    assert.ok(Math.abs(result.todayCostUsd - 0.04002) < 0.000001)
    assert.ok(Math.abs(result.costByProvider.groq - 0.08004) < 0.000001)
    assert.equal(result.unpricedCalls, 1)
  } finally { if (prior === undefined) delete process.env.GROQ_BILLED; else process.env.GROQ_BILLED = prior }
})
test('free audio usage is not presented as paid spend', () => {
  const prior = process.env.GROQ_BILLED
  delete process.env.GROQ_BILLED
  try { assert.equal(summarizeBudgetAudio([call()], now).todayCostUsd, 0) }
  finally { if (prior !== undefined) process.env.GROQ_BILLED = prior }
})
test('credits retain half sessions and reject non-finite display values', () => {
  assert.deepEqual(pointsToDisplay(1.5), {interviews:1.5,resumes:6})
  assert.deepEqual(pointsToDisplay(NaN), {interviews:0,resumes:0})
})
test('personal summary returns only the authenticated user credits without provider balances', async () => {
  const source = stripTypeScriptTypes(readFileSync(new URL('../../src/app/api/credits/summary/route.ts',import.meta.url),'utf8')).replace(/^import .*$/gm,'').replace(/export /g,'')
  let who = {id:'user-a'}
  const context = vm.createContext({ NextResponse:Response, authenticatedUser:async()=>who, hashUserId:id=>'hash-'+id, getPoints:async id=>id==='hash-user-a'?1.5:3, pointsToDisplay })
  vm.runInContext(source,context)
  const a = await (await context.GET({})).json()
  assert.equal(a.resumesLeft,6); assert.equal(a.sessionsLeft,1.5)
  assert.equal('remainingUsd' in a,false)
  who={id:'user-b'}
  assert.equal((await (await context.GET({})).json()).resumesLeft,12)
  who=null
  assert.equal((await context.GET({})).status,401)
})
test('session generation cannot fall back to free providers or models', () => {
  for(const purpose of ['kompas:answer','kompas:prep','kompas:answer-derive','kompas:humanize']) {
    assert.equal(sessionProviderAllowed(purpose,'groq','gpt-oss-120b'),false)
    assert.equal(sessionProviderAllowed(purpose,'openrouter','vendor/model:free'),false)
    assert.equal(sessionProviderAllowed(purpose,'openrouter','openrouter/free'),false)
    assert.equal(sessionProviderAllowed(purpose,'openrouter','vendor/paid'),true)
    assert.equal(sessionProviderAllowed(purpose,'openai','gpt-model'),true)
  }
  assert.equal(sessionProviderAllowed('resume-tailor','groq','gpt-oss-120b'),true)
  assert.equal(sessionProviderAllowed('kompas:transcribe','groq','whisper-large-v3'),true)
})
