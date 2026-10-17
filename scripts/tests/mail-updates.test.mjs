import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(name, mocks = {}, globals = {}) {
  const module = { exports: {} }
  const js = ts.transpileModule(readFileSync(new URL(`../../src/lib/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  runInNewContext(js, { module, exports:module.exports, require:id => id in mocks ? mocks[id] : require(id), Buffer, console, Date, AbortSignal, process:{env:{WHATSAPP_GMAIL_UPDATE_TEMPLATE:'inbox_update',WHATSAPP_TOKEN:'test',WHATSAPP_PHONE_NUMBER_ID:'test'}}, ...globals })
  return module.exports
}
const policy = load('mail-update-policy')
const now = Date.now()
const prefs = {enabled:true,mobile:true,ending:'1234',accounts:['a@example.com'],onlyImportant:true,since:now-5000}
const event = {id:'one',account:'a@example.com',thread:'thread',message:'message',from:'sender@example.com',subject:'Hello',preview:'',at:now-1000,observedAt:now,initial:false}
test('mobile eligibility respects consent, account, first sync, age and Important scope', () => {
  assert.equal(policy.eligibleMobile(event,prefs,true,now),true)
  for(const e of [{...event,initial:true},{...event,account:'b@example.com'},{...event,at:now-6000},{...event,at:now+1000}])assert.equal(policy.eligibleMobile(e,prefs,true,now),false)
  assert.equal(policy.eligibleMobile(event,{...prefs,mobile:false},true,now),false)
  assert.equal(policy.eligibleMobile(event,prefs,false,now),false)
  assert.equal(policy.validUpdatePreferences({...prefs,accounts:['a@example.com','a@example.com']}),false)
  assert.equal(policy.validUpdatePreferences({...prefs,accounts:['../../another-user']}),false)
})
function deliveryHarness({previous=0,fail=false,change=false,muted=false,disconnected=false}={}) {
  const rows = new Map([['whatsapp/linked/user.json',JSON.stringify({numbers:[{digits:'15555551234'}]})],['whatsapp/links/15555551234.json',JSON.stringify({userId:'user',verified:true})]])
  const feed=Array.from({length:8},(_,i)=>({...event,id:String(i)}))
  for(let i=0;i<previous;i++) rows.set(`updates/deliveries/${i}.json`,'{"status":"accepted"}')
  let calls=0,reads=0
  const blob={getText:async key=>rows.get(key)||null,put:async(key,value)=>rows.set(key,value),putIfAbsent:async(key,value)=>{if(rows.has(key))return false;rows.set(key,value);return true}}
  const mod=load('mail-update-delivery',{
    '@/lib/storage':{blob},'@/lib/mail-update-policy':policy,
    '@/lib/supabase/service':{createServiceClient:()=>({auth:{admin:{getUserById:async()=>({data:{user:{user_metadata:{gmail_notify_rules:muted?[{account:'a@example.com',email:'sender@example.com',mode:'never'}]:[]}}},error:null})}}})},
    '@/lib/googleWorkspace':{listGoogleWorkspaceAccounts:async()=>disconnected?[]:[{google_email:'a@example.com',gmail_enabled:true}]},
    '@/lib/mail-update-store':{updateRoot:()=> 'updates/',updatePreferences:async()=>++reads>1&&change?{...prefs,accounts:[]}:prefs,updateFeed:async()=>feed},
    '@/lib/mail-important-store':{trackedSenders:async()=>[]},'@/lib/mail-important':{trackedBy:()=>true},'@/lib/mail-reading':{senderEmail:s=>s},'@/lib/whatsapp':{waConfigured:()=>true},
  },{fetch:async()=>{calls++;if(fail)throw Error('timeout');return {ok:true,json:async()=>({messages:[{id:'receipt'}]})}}})
  return {mod,rows,calls:()=>calls}
}
test('already delivered newest items do not starve older pending alerts',async()=>{
  const h=deliveryHarness({previous:5});const r=await h.mod.deliverInboxUpdates('user');assert.equal(r.accepted,3);assert.equal(h.calls(),3)
  await h.mod.deliverInboxUpdates('user');assert.equal(h.calls(),3)
})
test('uncertain delivery is reserved and never blindly repeated',async()=>{
  const h=deliveryHarness({fail:true});await h.mod.deliverInboxUpdates('user');assert.equal(h.calls(),5)
  await h.mod.deliverInboxUpdates('user');assert.equal(h.calls(),8)
  await h.mod.deliverInboxUpdates('user');assert.equal(h.calls(),8)
  assert.equal(JSON.parse(h.rows.get('updates/deliveries/0.json')).status,'needs_review')
})
test('account removed after scan cancels alert before external send',async()=>{
  const h=deliveryHarness({change:true});await h.mod.deliverInboxUpdates('user');assert.equal(h.calls(),0)
})
test('manually linked or cross-user numbers cannot receive alerts',async()=>{
  const h=deliveryHarness();h.rows.set('whatsapp/links/15555551234.json',JSON.stringify({userId:'user'}));assert.equal((await h.mod.notificationNumbers('user')).length,0)
  h.rows.set('whatsapp/links/15555551234.json',JSON.stringify({userId:'other',verified:true}));assert.equal((await h.mod.notificationNumbers('user')).length,0)
})
test('concurrent delivery calls reserve each event only once',async()=>{
  const h=deliveryHarness();await Promise.all([h.mod.deliverInboxUpdates('user'),h.mod.deliverInboxUpdates('user')]);assert.equal(h.calls(),8)
})

function collectorHarness({expired=false,metadataFail=false}={}) {
  const rows=new Map();const events=[];const paths=[]
  if(expired)rows.set('updates/cursors/key.json',JSON.stringify({history:'old',checkedAt:0}))
  const mod=load('gmail-updates',{
    '@/lib/googleWorkspace':{listGoogleWorkspaceAccounts:async()=>[{id:'a',google_email:'a@example.com',gmail_enabled:true},{id:'b',google_email:'b@example.com',gmail_enabled:true}],getGoogleWorkspaceAccessToken:async(_,id)=>{assert.equal(id,'a');return 'token'}},
    '@/lib/storage':{blob:{getText:async k=>rows.get(k)||null,put:async(k,v)=>rows.set(k,v)}},
    '@/lib/mail-update-store':{accountKey:()=> 'key',updateRoot:()=> 'updates/',updatePreferences:async()=>prefs,storeUpdate:async(_,e)=>{events.push(e)}},
  },{fetch:async url=>{paths.push(url);let data
    if(url.includes('history?'))return {ok:false,status:404,json:async()=>({})}
    if(url.endsWith('profile'))data={historyId:'100'}
    else if(url.includes('messages?'))data={messages:[{id:'m'}]}
    else {if(metadataFail)throw Error('metadata failed');data={id:'m',threadId:'t',labelIds:['INBOX'],internalDate:String(now),payload:{headers:[{name:'Subject',value:'Hi'}]}}}
    return {ok:true,json:async()=>data}
  }})
  return {mod,rows,events,paths}
}
test('first sync imports only selected account and suppresses historical alerts',async()=>{
  const h=collectorHarness();await h.mod.collectInboxUpdates('user');assert.equal(h.events.length,1);assert.equal(h.events[0].account,'a@example.com');assert.equal(h.events[0].initial,true)
  const calls=h.paths.length;await h.mod.collectInboxUpdates('user');assert.equal(h.paths.length,calls,'cursor throttle avoids overlapping refresh')
})
test('expired Gmail history recovers without blasting old messages to mobile',async()=>{
  const h=collectorHarness({expired:true});await h.mod.collectInboxUpdates('user');assert.equal(h.events[0].initial,true);assert.equal(JSON.parse(h.rows.get('updates/cursors/key.json')).history,'100')
})
test('failed metadata fetch does not advance durable Gmail cursor',async()=>{
  const h=collectorHarness({metadataFail:true});const result=await h.mod.collectInboxUpdates('user');assert.equal(result.issues.length,1);assert.equal(h.rows.has('updates/cursors/key.json'),false)
})

test('sender mute and disconnected inbox prevent mobile sends',async()=>{
  for(const options of [{muted:true},{disconnected:true}]){const h=deliveryHarness(options);await h.mod.deliverInboxUpdates('user');assert.equal(h.calls(),0)}
})
test('sender notification rules are scoped by receiving inbox and never wins conflicts',()=>{
 const rules=[{account:'a@example.com',email:'sender@example.com',mode:'always'},{account:'a@example.com',email:'sender@example.com',mode:'never'}]
 assert.equal(policy.senderNotifyMode(rules,'a@example.com','sender@example.com'),'never')
 assert.equal(policy.senderNotifyMode(rules,'b@example.com','sender@example.com'),null)
})
