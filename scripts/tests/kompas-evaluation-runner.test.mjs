import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

test('evaluation captures 50 answers, preserves chain context and requires review without sending network traffic', async () => {
 const dir = await mkdtemp(path.join(tmpdir(), 'kompas-eval-test-'))
 try {
  const cases = JSON.parse(await readFile(new URL('../fixtures/kompas-evaluation/interview-50.json', import.meta.url)))
  const sources = Object.fromEntries(cases.map(c => [c.chain, {resume:'Synthetic test candidate',jd:'Synthetic test requirement'}]))
  const sourceFile = path.join(dir,'sources.json'), preload = path.join(dir,'mock.mjs'), out = path.join(dir,'out')
  await writeFile(sourceFile, JSON.stringify(sources))
  await writeFile(preload, `let calls=0; globalThis.fetch=async (_url, opts)=>{
   const body=JSON.parse(opts.body);
   if(body.preflight) return {ok:true,json:async()=>({ready:true})};
   const step=calls%5;
   if(body.history.length!==step) throw Error('Chain history mismatch');
   if(step && body.ledger?.step!==step) throw Error('Ledger lost');
   if(!step && body.ledger) throw Error('Cross-chain ledger leak');
   calls++;
   return {ok:true,json:async()=>({text:'Synthetic answer '+calls,meta:{model:'mock-only'},ledger:{step:step+1}})};
  };`)
  const args=['--import',pathToFileURL(preload).href,'scripts/kompas-live-evaluate.mjs',sourceFile,out,'1']
  const env={...process.env,KOMPAS_API_TOKEN:'synthetic-test-only'}
  const r=spawnSync(process.execPath,args,{env,encoding:'utf8'})
  assert.equal(r.status,0,r.stderr)
  const rows=JSON.parse(await readFile(path.join(out,'round-1.json')))
  assert.equal(rows.length,50)
  assert.ok(rows.every(r=>r.fixture==='interview-50' && r.historyMode==='chain' && r.review.status==='pending' && r.review.scores===null))
  const retry=spawnSync(process.execPath,args,{env,encoding:'utf8'})
  assert.notEqual(retry.status,0)
  assert.match(retry.stderr,/EEXIST/)
  assert.equal(JSON.parse(await readFile(path.join(out,'round-1.json'))).length,50)
 } finally {await rm(dir,{recursive:true,force:true})}
})

test('rejected preflight leaves explicit failure evidence and makes no answer calls', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'kompas-preflight-'))
 try {
  const cases=JSON.parse(await readFile(new URL('../fixtures/kompas-evaluation/interview-50.json',import.meta.url)))
  const sources=Object.fromEntries(cases.map(c=>[c.chain,{resume:'Synthetic',jd:'Synthetic'}]))
  await writeFile(path.join(dir,'sources.json'),JSON.stringify(sources))
  await writeFile(path.join(dir,'mock.mjs'),`globalThis.fetch=async (_url,opts)=>{if(!JSON.parse(opts.body).preflight) throw Error('Unexpected generation');return {ok:false,status:401}}`)
  const r=spawnSync(process.execPath,['--import',pathToFileURL(path.join(dir,'mock.mjs')).href,'scripts/kompas-live-evaluate.mjs',path.join(dir,'sources.json'),path.join(dir,'out'),'1'],{env:{...process.env,KOMPAS_API_TOKEN:'synthetic'},encoding:'utf8'})
  assert.notEqual(r.status,0)
  const records=JSON.parse(await readFile(path.join(dir,'out','round-1.json')))
  assert.equal(records.length,1)
  assert.equal(records[0].fixture,'interview-50')
  assert.equal(records[0].stage,'preflight')
  assert.equal(records[0].status,'failed')
  assert.equal(records[0].error,'Answer API HTTP 401')
 } finally {await rm(dir,{recursive:true,force:true})}
})

test('baseline stays 50 cases and the supplemental set crosses 12 prompts over three audiences', async () => {
 const baseline = JSON.parse(await readFile(new URL('../fixtures/kompas-evaluation/interview-50.json', import.meta.url)))
 const supplemental = JSON.parse(await readFile(new URL('../fixtures/kompas-evaluation/intent-acceptance-v1.json', import.meta.url)))
 assert.equal(baseline.length, 50)
 assert.equal(new Set(baseline.map(c => c.question)).size, 41)
 assert.ok(baseline.every(c => c.chain && !c.category))
 assert.equal(supplemental.length, 36)
 assert.equal(new Set(supplemental.map(c => c.question)).size, 12)
 const required = ['intro', 'intro-repeat', 'abbreviation', 'compound', 'topic-switch', 'drilldown', 'unknown-experience']
 for (const category of required) {
  const rows = supplemental.filter(c => c.category === category)
  assert.deepEqual(rows.map(c => c.level), ['engineer', 'architect', 'director'])
  assert.equal(new Set(rows.map(c => c.question)).size, 1)
 }
 assert.equal(new Set([...baseline.map(c => c.question)].filter(q => supplemental.some(c => c.question === q))).size, 0)
})

async function runIntent(dir, sources, fixture = 'intent-acceptance-v1') {
 await writeFile(path.join(dir, 'sources.json'), JSON.stringify(sources))
 await writeFile(path.join(dir, 'mock.mjs'), `globalThis.fetch=async ()=>{throw Error('model call')}`)
 return spawnSync(process.execPath, ['--import', pathToFileURL(path.join(dir, 'mock.mjs')).href, 'scripts/kompas-live-evaluate.mjs', path.join(dir, 'sources.json'), path.join(dir, 'out'), '1', fixture], { env: { ...process.env, KOMPAS_API_TOKEN: 'synthetic' }, encoding: 'utf8' })
}

test('unknown fixture and missing or leaked history stop before any model call', async () => {
 const dir = await mkdtemp(path.join(tmpdir(), 'kompas-intent-guard-'))
 try {
  const cases = JSON.parse(await readFile(new URL('../fixtures/kompas-evaluation/intent-acceptance-v1.json', import.meta.url)))
  const bare = Object.fromEntries(cases.map(c => [c.id, { resume: 'Synthetic', jd: 'Synthetic' }]))
  const unknown = await runIntent(dir, bare, '../interview-50.json')
  assert.notEqual(unknown.status, 0)
  assert.match(unknown.stderr, /Unknown evaluation fixture/)
  assert.doesNotMatch(unknown.stderr, /Error: model call/)
  const missing = await runIntent(dir, bare)
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /Missing explicit reviewed history for intent-intro-repeat-engineer/)
  assert.doesNotMatch(missing.stderr, /Error: model call/)
  const leaked = Object.fromEntries(cases.map(c => [c.id, { resume: 'Synthetic', jd: 'Synthetic', ...(c.category === 'intro-repeat' || c.category === 'drilldown' ? { history: [{ q: 'Reviewed prior', a: 'Reviewed answer' }] } : {}) }]))
  leaked['intent-abbreviation-engineer'].history = [{ q: 'Prior', a: 'Answer' }]
  const isolated = await runIntent(dir, leaked)
  assert.notEqual(isolated.status, 0)
  assert.match(isolated.stderr, /Isolated case intent-abbreviation-engineer must not include prior history/)
  assert.doesNotMatch(isolated.stderr, /Error: model call/)
  const blank = structuredClone(leaked)
  delete blank['intent-abbreviation-engineer'].history
  blank['intent-drilldown-director'].history = [{ q: ' ', a: 'Reviewed answer' }]
  const blankHistory = await runIntent(dir, blank)
  assert.notEqual(blankHistory.status, 0)
  assert.match(blankHistory.stderr, /Missing explicit reviewed history for intent-drilldown-director/)
  assert.doesNotMatch(blankHistory.stderr, /Error: model call/)
  await assert.rejects(readFile(path.join(dir, 'out', 'round-1.json')))
 } finally { await rm(dir, { recursive: true, force: true }) }
})

test('intent fixture sends reviewed history only for dependent cases and isolates the rest', async () => {
 const dir = await mkdtemp(path.join(tmpdir(), 'kompas-intent-run-'))
 try {
  const cases = JSON.parse(await readFile(new URL('../fixtures/kompas-evaluation/intent-acceptance-v1.json', import.meta.url)))
  const sources = {}
  for (const c of cases) {
   sources[c.id] = { resume: 'Synthetic test candidate', jd: 'Synthetic test requirement' }
   if (c.category === 'intro-repeat' || c.category === 'drilldown') {
    sources[c.id].history = [{ q: `Reviewed question for ${c.id}`, a: `Reviewed answer for ${c.id}` }]
    sources[c.id].ledger = { marker: c.id }
   }
  }
  const seen = path.join(dir, 'seen.json')
  await writeFile(path.join(dir, 'sources.json'), JSON.stringify(sources))
  await writeFile(path.join(dir, 'mock.mjs'), `import { writeFile } from 'node:fs/promises'; const seen=[]; globalThis.fetch=async (_url, opts)=>{
   const body=JSON.parse(opts.body);
   if(body.preflight) return {ok:true,json:async()=>({ready:true})};
   seen.push({question:body.question,level:body.config.level,history:body.history,ledger:body.ledger,resume:body.config.resume,historyInConfig:body.config.history});
   await writeFile(${JSON.stringify(seen)}, JSON.stringify(seen));
   return {ok:true,json:async()=>({text:'Synthetic answer '+seen.length,meta:{model:'mock-only'},ledger:{step:seen.length}})};
  };`)
  const out = path.join(dir, 'out')
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(path.join(dir, 'mock.mjs')).href, 'scripts/kompas-live-evaluate.mjs', path.join(dir, 'sources.json'), out, '1', 'intent-acceptance-v1'], { env: { ...process.env, KOMPAS_API_TOKEN: 'synthetic' }, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  const rows = JSON.parse(await readFile(path.join(out, 'round-1.json')))
  const sent = JSON.parse(await readFile(seen))
  assert.equal(rows.length, 36)
  assert.equal(sent.length, 36)
  assert.ok(rows.every(row => row.fixture === 'intent-acceptance-v1' && row.review.status === 'pending'))
  for (const c of cases) {
   const got = sent.find(row => row.question === c.question && row.level === c.level)
   assert.equal(got.resume, 'Synthetic test candidate')
   assert.equal(got.historyInConfig, undefined)
   if (c.category === 'intro-repeat' || c.category === 'drilldown') {
    assert.deepEqual(got.history, [{ q: `Reviewed question for ${c.id}`, a: `Reviewed answer for ${c.id}` }])
    assert.deepEqual(got.ledger, { marker: c.id })
    assert.equal(rows.find(row => row.id === c.id).historyMode, 'reviewed')
   } else {
    assert.deepEqual(got.history, [])
    assert.equal(got.ledger, undefined)
    assert.equal(rows.find(row => row.id === c.id).historyMode, 'isolated')
   }
  }
 } finally { await rm(dir, { recursive: true, force: true }) }
})
