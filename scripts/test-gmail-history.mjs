import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function compile(path, imports = {}, globals = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => imports[name] || {}, Date, Map, Set, Intl, Buffer, console, URL, setTimeout: fn => fn(), ...globals })
  return exports
}
const evidence = compile('src/lib/application-evidence.ts')
const classifier = compile('src/lib/email-classifier.ts')
const rows = Array.from({length: 501}, (_, i) => ({user_id:'u',account_email:'candidate@example.com',latest_ts:Date.now(),data:{threadId:`old${i}`,accountEmail:'candidate@example.com',evidenceVersion:2,messages:[]}}))
rows.push({user_id:'other-user',account_email:'candidate@example.com',latest_ts:Date.now(),data:{threadId:'private',evidenceVersion:2,messages:[]}})
rows.push({user_id:'u',account_email:'other@example.com',latest_ts:Date.now(),data:{threadId:'other-inbox',evidenceVersion:2,messages:[]}})
const db = { from() {
  let filters = [], start = 0, end = Infinity
  const query = {
    select() {return query}, order() {return query},
    eq(k,v) {filters.push(r=>r[k]===v);return query}, gt(k,v) {filters.push(r=>r[k]>v);return query},
    range(a,b) {start=a;end=b;return query},
    then(resolve) {return Promise.resolve({data:rows.filter(r=>filters.every(f=>f(r))).slice(start,end+1),error:null}).then(resolve)},
    async upsert(values) { for(const r of values) {const i=rows.findIndex(x=>x.user_id===r.user_id && x.account_email===r.account_email && x.data.threadId===r.data.threadId); if(i<0)rows.push(r);else rows[i]=r} return {error:null} },
  }
  return query
} }
let fail = false
const pageOffsets = []
const api = async url => {
  const u = new URL(url)
  if(u.pathname.endsWith('/threads')) {
    const offset = Number(u.searchParams.get('pageToken') || 0)
    pageOffsets.push(offset)
    const count = Math.min(Number(u.searchParams.get('maxResults')),101-offset)
    return {ok:true,json:async()=>({threads:Array.from({length:count},(_,i)=>({id:`fresh${offset+i}`})),nextPageToken:offset+count<101?String(offset+count):undefined})}
  }
  if(fail) return {ok:false,status:503,json:async()=>({error:{message:'temporary outage'}})}
  const id=u.pathname.split('/').at(-1)
  return {ok:true,json:async()=>({id,messages:[{id,threadId:id,snippet:'Profile submitted to customer.',internalDate:String(Date.now()),payload:{mimeType:'text/plain',headers:[{name:'From',value:'Recruiter <recruiter@vendor.example>'},{name:'Subject',value:'Submission update'},{name:'To',value:'candidate@example.com'}],body:{data:Buffer.from('Profile submitted to customer.').toString('base64url')}}}]})}
}
const lib=compile('src/app/api/gmail/_lib.ts',{'@/lib/application-evidence':evidence,'@/lib/email-classifier':classifier,'@/lib/googleWorkspace':{getGoogleWorkspaceAccessToken:async()=> 'test-token'}},{fetch:api})
const ctx={supabase:db,userId:'u',accounts:[{id:'a',google_email:'candidate@example.com',gmail_enabled:true}]}
let token, result
do {result=await lib.scanApplicationHistory(ctx,'candidate@example.com',90,token);token=result.nextPageToken} while(token)
assert.deepEqual(pageOffsets,[0,40,80])
assert.equal(result.threads.length,602,'reads beyond 500 cache rows and 100 live threads')
assert.equal(result.threads.some(t=>['private','other-inbox'].includes(t.threadId)),false,'isolates users and inboxes')
assert.equal(lib.buildApplicationChains(result.threads).filter(c=>c.current==='client').length,101)
await assert.rejects(()=>lib.scanApplicationHistory(ctx,'unauthorized@example.com',90),/not connected/)
fail=true
await assert.rejects(()=>lib.scanApplicationHistory(ctx,'candidate@example.com',90,'80'),/position has not advanced/)
console.log('PASS history continuation beyond 100, cache beyond 500, account isolation, stage extraction, failed-page retry')
