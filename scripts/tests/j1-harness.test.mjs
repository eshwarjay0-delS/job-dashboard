import test from 'node:test'
import assert from 'node:assert/strict'
import { routeFieldEdit } from '../../src/lib/ai/jev.ts'
import { constrainResumeEdits, J1_HEADER } from '../../src/lib/ai/j1.ts'

const reply = (choice, confidence, simple) => async () => new Response(JSON.stringify({ answers: { complexity: { type: 'choice', choice, confidence, probabilities: { simple, complex: 1-simple } } } }))
test('Jev requires opt-in and configuration, with no fabricated confidence', async () => {
  let calls = 0
  const actual = await routeFieldEdit({ section: 'summary', instruction: 'shorten' }, { enabled: false, apiKey: 'test', fetcher: async () => { calls++; throw Error() } })
  assert.equal(calls, 0)
  assert.deepEqual(actual, { tier: 'heavy', source: 'fallback', confidence: null })
})
test('Jev routes only a high-confidence simple task to light', async () => {
  for (const [choice, confidence, probability, expected] of [['simple', .96, .96, 'light'], ['simple', .6, .96, 'heavy'], ['simple', .99, .6, 'heavy'], ['complex', .96, .04, 'heavy']]) {
    assert.equal((await routeFieldEdit({section:'bullet',instruction:'shorten'}, {enabled:true,apiKey:'test',fetcher:reply(choice,confidence,probability)})).tier, expected)
  }
})
test('Jev rejects malformed responses, provider failures and deadlines', async () => {
  for (const fetcher of [reply('authorize', .99, .99), reply('simple', 5, .99), async () => new Response('', {status:429}), async () => {throw Error('offline')}, () => new Promise(()=>{})]) {
    const actual = await routeFieldEdit({section:'summary',instruction:'shorten'}, {enabled:true,apiKey:'test',fetcher,timeoutMs:5})
    assert.equal(actual.source, 'fallback')
    assert.equal(actual.tier, 'heavy')
  }
})
test('Jev sends a bounded structured state and fixed endpoint without candidate records', async () => {
  await routeFieldEdit({section:'summary',instruction:'x'.repeat(3000)}, {enabled:true,apiKey:'test',fetcher:async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone')
    assert.equal(init.redirect, 'error')
    const state = JSON.parse(JSON.parse(init.body).state)
    assert.deepEqual(Object.keys(state), ['section','instruction'])
    assert.equal(state.instruction.length,1500)
    return reply('simple', .95, .95)()
  }})
})
test('an edit lands only on a line of its own section, once, and a new bullet only after a real role', () => {
  const zones = { header:null,summaryIdx:1,summaryText:'Original',summaryOverflowIdx:[2],skills:[{idx:3,text:'Azure'}],roles:[{role:'Engineer',bullets:[{idx:4,text:'Built'},{idx:5,text:'Tested'}]}],extras:[] }
  const result = constrainResumeEdits({summary:'Security engineer',skills:[{idx:5,text:'AWS'},{idx:3,text:'Azure, AWS'},{idx:3,text:'duplicate'}],bullets:[{idx:999,text:'invented'},{idx:5,text:'Tested AWS IAM'}],added:[{after:5,text:'Threat-modelled the AI agent integrations'},{after:4,text:'not after the last bullet'},{after:77,text:'no such role'}]},zones)
  assert.equal(result.summary,'Security engineer')
  assert.deepEqual(result.skills,[{idx:3,text:'Azure, AWS'}])
  assert.deepEqual(result.bullets,[{idx:5,text:'Tested AWS IAM'}])
  assert.deepEqual(result.added,[{after:5,text:'Threat-modelled the AI agent integrations'}])
})
test('the resume and the job description are read as one record, and identity still comes only from the resume', () => {
  assert.match(J1_HEADER,/RESUME AND THE JOB DESCRIPTION COMBINED/)
  assert.match(J1_HEADER,/employers, job titles of past roles, dates, years of experience, seniority, certifications/)
  assert.match(J1_HEADER,/never delete what the candidate actually used/)
})

test('provider retry backoff obeys one overall request deadline', async () => {
  const { readFile } = await import('node:fs/promises')
  const { stripTypeScriptTypes } = await import('node:module')
  const vm = await import('node:vm')
  const source = await readFile(new URL('../../src/lib/llm.ts', import.meta.url), 'utf8')
  const block = source.slice(source.indexOf('const LLM_CALL_TIMEOUT_MS'), source.indexOf('// One LLM call.'))
  let calls = 0
  const context = vm.createContext({process:{env:{LLM_CALL_TIMEOUT_MS:'10'}},AbortSignal,setTimeout,clearTimeout,fetch:async()=>{calls++;return new Response('',{status:429})}})
  vm.runInContext(stripTypeScriptTypes(block)+'\nglobalThis.retry=fetchRetry',context)
  await assert.rejects(context.retry('https://provider.invalid',{}), /timeout/i)
  assert.equal(calls,1)
})
