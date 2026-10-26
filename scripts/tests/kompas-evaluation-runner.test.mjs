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
  for (const row of rows) for (const key of ['fixtureSha256','sourcesSha256','runnerSha256']) assert.match(row.provenance[key], /^[a-f0-9]{64}$/)
  assert.equal(rows.length,50)
  const manifest=JSON.parse(await readFile(path.join(out,'round-1.manifest.json')))
  assert.equal(manifest.status,'capture-complete')
  assert.equal(manifest.quality,'unverified')
  assert.equal(manifest.captured,50)
  assert.ok(rows.every(r=>r.review.status==='pending' && r.review.scores===null))
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
  await assert.rejects(readFile(path.join(dir,'out','round-1.manifest.json')), {code:'ENOENT'})
  assert.match(records[0].provenance.sourcesSha256, /^[a-f0-9]{64}$/)
  assert.equal(records[0].stage,'preflight')
  assert.equal(records[0].status,'failed')
  assert.equal(records[0].error,'Answer API HTTP 401')
 } finally {await rm(dir,{recursive:true,force:true})}
})
