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
test('a damaged saved event does not hide valid inbox updates',async()=>{
 const prefix='mail/updates/user/events/',id='a'.repeat(64),older='b'.repeat(64)
 const rows=new Map([
  [prefix+`100-${id}.json`,JSON.stringify({...event,id})],
  [prefix+`099-${older}.json`,JSON.stringify({...event,id:older,at:now-2000})],
  [prefix+'105-broken.json','{'],[prefix+'104-null.json','null'],
  [prefix+'103-shape.json',JSON.stringify({id,at:now})],
  [prefix+`102-${'c'.repeat(64)}.json`,JSON.stringify({...event,id})],
  ['mail/updates/other/events/106-'+id+'.json',JSON.stringify({...event,id})],
 ])
 const store=load('mail-update-store',{'@/lib/storage':{blob:{list:async()=>[...rows.keys()],getText:async key=>rows.get(key)||null}},'@/lib/mail-update-policy':policy})
 assert.deepEqual(Array.from(await store.updateFeed('user'),e=>e.id),[id,older])
 assert.equal(rows.size,7,'invalid records are retained for diagnosis')
})
test('inbox storage outages remain failures rather than an apparently empty feed',async()=>{
 const store=load('mail-update-store',{'@/lib/storage':{blob:{list:async()=>['mail/updates/user/events/100-'+ 'a'.repeat(64)+'.json'],getText:async()=>{throw Error('storage unavailable')}}},'@/lib/mail-update-policy':policy})
 await assert.rejects(store.updateFeed('user'),/storage unavailable/)
})
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
    '@/lib/mail-update-store':{registerUpdateProviderReceipt:async()=>true,updateRoot:()=> 'updates/',updatePreferences:async()=>++reads>1&&change?{...prefs,accounts:[]}:prefs,updateFeed:async()=>feed},
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

function collectorHarness({expired=false,metadataFail=false,metadataStatus=0,incremental=false}={}) {
  const rows=new Map();const events=[];const paths=[]
  if(expired||incremental)rows.set('updates/cursors/key.json',JSON.stringify({history:'old',checkedAt:0}))
  const mod=load('gmail-updates',{
    '@/lib/googleWorkspace':{listGoogleWorkspaceAccounts:async()=>[{id:'a',google_email:'a@example.com',gmail_enabled:true},{id:'b',google_email:'b@example.com',gmail_enabled:true}],getGoogleWorkspaceAccessToken:async(_,id)=>{assert.equal(id,'a');return 'token'}},
    '@/lib/storage':{blob:{getText:async k=>rows.get(k)||null,put:async(k,v)=>rows.set(k,v)}},
    '@/lib/mail-update-store':{accountKey:()=> 'key',updateRoot:()=> 'updates/',updatePreferences:async()=>prefs,storeUpdate:async(_,e)=>{events.push(e)}},
  },{fetch:async url=>{paths.push(url);let data
    if(url.includes('history?'))return incremental?{ok:true,json:async()=>({historyId:'100',history:[{messagesAdded:[{message:{id:'gone',labelIds:['INBOX']}},{message:{id:'m',labelIds:['INBOX']}}]}]})}:{ok:false,status:404,json:async()=>({})}
    if(url.endsWith('profile'))data={historyId:'100'}
    else if(url.includes('messages?'))data={messages:metadataStatus?[{id:'gone'},{id:'m'}]:[{id:'m'}]}
    else if(url.includes('/gone?')&&metadataStatus)return {ok:false,status:metadataStatus,json:async()=>({})}
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

test('a vanished message cannot pin initial or incremental sync to the same cursor',async()=>{
  for(const incremental of [false,true]){
    const h=collectorHarness({metadataStatus:404,incremental});const result=await h.mod.collectInboxUpdates('user')
    assert.equal(result.issues.length,0)
    assert.equal(h.events.length,1)
    assert.equal(h.events[0].message,'m')
    assert.equal(h.events[0].initial,!incremental)
    assert.equal(JSON.parse(h.rows.get('updates/cursors/key.json')).history,'100')
  }
})
test('authentication, rate limits and server errors retain the original cursor for retry',async()=>{
  for(const metadataStatus of [401,403,429,500,503]){
    const h=collectorHarness({metadataStatus,incremental:true});const result=await h.mod.collectInboxUpdates('user')
    assert.equal(result.issues.length,1)
    assert.equal(JSON.parse(h.rows.get('updates/cursors/key.json')).history,'old')
  }
})

test('sender mute and disconnected inbox prevent mobile sends',async()=>{
  for(const options of [{muted:true},{disconnected:true}]){const h=deliveryHarness(options);await h.mod.deliverInboxUpdates('user');assert.equal(h.calls(),0)}
})
test('sender notification rules are scoped by receiving inbox and never wins conflicts',()=>{
 const rules=[{account:'a@example.com',email:'sender@example.com',mode:'always'},{account:'a@example.com',email:'sender@example.com',mode:'never'}]
 assert.equal(policy.senderNotifyMode(rules,'a@example.com','sender@example.com'),'never')
 assert.equal(policy.senderNotifyMode(rules,'b@example.com','sender@example.com'),null)
})

test('delivery receipts expose status without leaking provider identifiers',async()=>{
  const id='a'.repeat(64),other='b'.repeat(64),prefix='mail/updates/user/deliveries/'
  const rows=new Map([
    [prefix+id+'.json',JSON.stringify({status:'accepted',providerId:'private-provider-id',at:now})],
    [prefix+other+'.json',JSON.stringify({status:'needs_review',reason:'Delivery uncertain',at:now})],
    [prefix+'bad.json',JSON.stringify({status:'accepted',at:now})],
  ])
  const store=load('mail-update-store',{
    '@/lib/storage':{blob:{list:async()=>[...rows.keys()],getText:async key=>rows.get(key)||null}},
    '@/lib/mail-update-policy':policy,
  })
  const receipts=await store.updateDeliveryReceipts('user',[id,other,'../../another-user'])
  assert.deepEqual(JSON.parse(JSON.stringify(receipts)),{
    [id]:{status:'accepted',at:now},
    [other]:{status:'needs_review',at:now,reason:'Delivery uncertain'},
  })
  assert.equal(JSON.stringify(receipts).includes('private-provider-id'),false)
})

test('provider callbacks are privately indexed and resolve to the furthest delivery state',async()=>{
  const id='c'.repeat(64),rows=new Map()
  const blob={
    getText:async key=>rows.get(key)||null,
    put:async(key,value)=>rows.set(key,value),
    putIfAbsent:async(key,value)=>{if(rows.has(key))return false;rows.set(key,value);return true},
    list:async prefix=>[...rows.keys()].filter(key=>key.startsWith(prefix)),
  }
  const store=load('mail-update-store',{'@/lib/storage':{blob},'@/lib/mail-update-policy':policy})
  assert.equal(await store.registerUpdateProviderReceipt('wamid.private','user',id),true)
  assert.equal([...rows.keys()].some(key=>key.includes('wamid.private')),false)
  await store.recordUpdateProviderStatus('wamid.private','delivered',now+1000)
  await store.recordUpdateProviderStatus('wamid.private','read',now+2000)
  await store.recordUpdateProviderStatus('wamid.private','delivered',now+3000)
  const receipts=await store.updateDeliveryReceipts('user',[id])
  assert.deepEqual(JSON.parse(JSON.stringify(receipts[id])),{status:'read',at:now+2000})
  assert.equal(JSON.stringify(receipts).includes('wamid.private'),false)
  assert.equal(await store.recordUpdateProviderStatus('unknown','read',now),false)
})

test('WhatsApp webhook records status callbacks instead of discarding them',()=>{
  const source=readFileSync(new URL('../../src/app/api/whatsapp/webhook/route.ts',import.meta.url),'utf8')
  assert.match(source,/recordUpdateProviderStatus\(id, state/)
  assert.ok(source.indexOf('if (statuses.length)')<source.indexOf('if (!msg) return ok()'))
  assert.match(source,/if \(!waSignatureConfigured\(\)\) return ok\(\)/)
  assert.ok(source.indexOf('if (!waSignatureConfigured()) return ok()')<source.lastIndexOf('recordUpdateProviderStatus(id, state,'))
})
