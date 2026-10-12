import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function compile(path, imports = {}) {
  const exports = {}
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(js, { exports, require: name => imports[name] || {}, Date, Map, Set, Intl, Buffer, console, URL, setTimeout })
  return exports
}
const evidence = compile('src/lib/application-evidence.ts')
const ignore = compile('src/lib/gmail-ignore.ts')
const lib = compile('src/app/api/gmail/_lib.ts', { '@/lib/application-evidence': evidence })
let count = 0
function check(name, fn) { fn(); count++; console.log('PASS', name) }
const msg = (id, snippet, extra = {}) => ({ id, from: 'Recruiter <recruiter@example.com>', subject: 'Security role', snippet, bodyText: snippet, internalDate: '1787840540000', unread: false, category: 'RTR Request', confidence: 'high', jobTitle: 'Security Engineer', rate: '', vendor: 'Recruiter', vendorDomain: 'example.com', ...extra })
const thread = messages => ({ threadId: 't1', accountEmail: 'candidate@gmail.com', messages })
check('a promise is not a submission', () => assert.equal(evidence.submissionEvidence('I will submit your profile to the client.').submitted, false))
check('negative submission is not evidence', () => assert.equal(evidence.submissionEvidence('We have not submitted your profile.').submitted, false))
check('quoted old text is not a new handoff', () => assert.equal(evidence.submissionEvidence('No update.\nOn Monday recruiter wrote:\nI have submitted your profile to manager@example.com').submitted, false))
check('explicit submission identifies exact recipient', () => assert.equal(evidence.submissionEvidence('I have submitted your profile to manager@example.com').recipient, 'manager@example.com'))
check('generic client is not automatically end client', () => assert.equal(evidence.submissionEvidence('I have submitted your profile to the client.').targetKind, 'client'))
check('shared account domains cannot be ignored', () => assert.equal(ignore.validIgnoreRule({ account:'a@gmail.com',kind:'domain',value:'gmail.com' }), false))
check('ignore scope stays in its account', () => assert.equal(ignore.ignoreReason({account:'b@gmail.com',id:'x',fromEmail:'r@example.com'}, [{account:'a@gmail.com',kind:'domain',value:'example.com'}]),null))
check('domain suffix attack does not match', () => assert.equal(ignore.ignoreReason({account:'a@gmail.com',id:'x',fromEmail:'r@notexample.com'}, [{account:'a@gmail.com',kind:'domain',value:'example.com'}]),null))
check('automatic filtering protects interviews', () => assert.equal(ignore.ignoreReason({account:'a@gmail.com',id:'x',fromEmail:'r@example.com',stage:'invite',subject:'Newsletter unsubscribe'}, []),null))
check('calendar UTC is preserved', () => assert.equal(evidence.calendarEvidence('BEGIN:VEVENT\nUID:x\nDTSTART:20260917T170000Z\nEND:VEVENT')[0].start, Date.parse('2026-09-17T17:00:00Z')))
check('Outlook Eastern zone respects daylight saving', () => assert.equal(evidence.calendarEvidence('BEGIN:VEVENT\nUID:x\nDTSTART;TZID=Eastern Standard Time:20260917T130000\nEND:VEVENT')[0].start, Date.parse('2026-09-17T17:00:00Z')))
check('floating date remains unknown', () => assert.equal(evidence.calendarEvidence('BEGIN:VEVENT\nUID:x\nDTSTART:20260917T130000\nEND:VEVENT')[0].start,undefined))
check('cancellation is retained', () => assert.equal(evidence.calendarEvidence('METHOD:CANCEL\nBEGIN:VEVENT\nUID:x\nEND:VEVENT')[0].cancelled,true))
check('a first name mention never establishes a transfer', () => { const c=lib.buildApplicationChains([thread([msg('1','Speak with Alice.'), msg('2','Hello',{from:'Alice <alice@example.com>'})])])[0]; assert.equal(c.events[1].handoffFrom,undefined) })
check('invite does not fill missing submission', () => { const c=lib.buildApplicationChains([thread([msg('1','Interview link https://teams.microsoft.com/meet/123',{category:'Interview Request'})])])[0]; assert.equal(c.stops.find(s=>s.key==='submitted').reached,false); assert.equal(c.holder,'Unknown') })
check('no date invented from email arrival', () => { const i=lib.threadsToInterviews([thread([msg('1','Interview link https://teams.microsoft.com/meet/123',{category:'Interview Request'})])]); assert.equal(i[0].ts,undefined) })
check('empty threads do not crash chain builder', () => assert.equal(lib.buildApplicationChains([thread([])]).length,0))
check('same reference in separate accounts never merges', () => { const a=thread([msg('1','',{rfcMessageId:'<a>'})]); const b={...thread([msg('2','',{references:'<a>'})]),threadId:'t2',accountEmail:'other@gmail.com'}; assert.equal(evidence.linkReferencedThreads([a,b]).length,2) })
check('explicit references merge and deduplicate', () => { const a=thread([msg('1','',{rfcMessageId:'<a>'})]); const b={...thread([msg('2','',{references:'<a>'})]),threadId:'t2'}; assert.equal(evidence.linkReferencedThreads([a,b]).length,1) })
check('latest UID cancellation removes active invite', () => { const a=msg('1','Interview',{hasIcs:true,calendar:[{uid:'u',start:1789000000000,cancelled:false}]}); const b=msg('2','Interview cancelled',{internalDate:'1789000000000',hasIcs:true,calendar:[{uid:'u',cancelled:true}]}); assert.equal(lib.threadsToInterviews([thread([a,b])]).length,0) })
check('completed submission survives future update in same sentence', () => {
  const p=evidence.submissionEvidence('We have submitted your profile to customer and soon will let you know the\nnext steps by coming week.')
  assert.equal(p.submitted,true); assert.equal(p.client,true); assert.equal(p.targetKind,'client'); assert.equal(p.recipientLabel,'customer')
})
check('client partner shorthand is submitted to a partner', () => {
  const p=evidence.submissionEvidence('Profile submitted to Client Partner. Do not resubmit for State Agency.')
  assert.equal(p.submitted,true); assert.equal(p.client,false); assert.equal(p.targetKind,'partner')
})
check('omitted subject and auxiliary still captures completed action', () => {
  const p=evidence.submissionEvidence('Submitted your profile to Example Staffing.')
  assert.equal(p.submitted,true); assert.equal(p.recipientLabel,'Example Staffing'); assert.equal(p.client,false)
})
check('forwarded claim at body start is not authored', () => assert.equal(evidence.submissionEvidence('On Tuesday recruiter wrote:\nWe have submitted your profile to client.').submitted,false))
check('multiline quoted header is stripped', () => assert.equal(evidence.submissionEvidence('Thanks\nOn Tuesday, Jane <jane@example.com>\nwrote:\nWe have submitted your profile to client.').submitted,false))
for (const body of ['Have you submitted your profile to the client?', 'Your profile was not submitted to customer.', 'If your profile was submitted to customer, wait.', 'Please confirm your profile was submitted to client.', 'Your profile will be submitted to client.', 'We never submitted your profile to client.']) {
  check('does not confirm: '+body,()=>assert.equal(evidence.submissionEvidence(body).submitted,false))
}
check('submission under RTR subject is a submission event', () => {
  const c=lib.buildApplicationChains([thread([msg('s','I have submitted your profile to Alex.',{subject:'RTR:: Security Engineer'})])])[0]
  assert.equal(c.events[0].kind,'submitted'); assert.equal(c.holder,'Alex'); assert.equal(c.holderConfirmed,false)
})
check('new client submission takes precedence over earlier vendor screening', () => {
  const c=lib.buildApplicationChains([thread([msg('invite','Interview link https://teams.microsoft.com/meet/123',{category:'Interview Request',internalDate:'1787800000000'}),msg('submission','We have submitted your profile to customer and soon will let you know the next steps.',{subject:'Re: Interview invitation',category:'Interview Request',internalDate:'1787900000000'})])])[0]
  assert.equal(c.current,'client'); assert.equal(c.events[1].kind,'client'); assert.equal(c.stops.find(s=>s.key==='client').messageId,'submission'); assert.equal(c.holder,'customer')
})
check('body evidence admits general correspondence into overview', () => {
  const c=lib.buildApplicationChains([thread([msg('s','Profile submitted to Client Partner.',{category:'General Correspondence'})])])[0]
  assert.equal(c.current,'submitted'); assert.equal(c.holder,'Client Partner')
})
check('outbound followup cannot confirm a client submission', () => {
  const c=lib.buildApplicationChains([thread([msg('s','I have submitted your profile to customer.',{from:'candidate@gmail.com'})])])[0]
  assert.equal(c.stops.find(s=>s.key==='client').reached,false)
})
check('own followup does not reset wait for recruiter', () => {
  const a=msg('a','I have submitted your profile to customer.',{internalDate:String(Date.now()-10*86400000)})
  const b=msg('b','Any update?',{from:'candidate@gmail.com',internalDate:String(Date.now()),subject:'Re: RTR'})
  const c=lib.buildApplicationChains([thread([a,b])])[0]
  assert.equal(c.stalledDays,10); assert.equal(c.events[1].kind,'followup')
})
check('real client invite reaches client but job advertisement does not', () => {
  const a=lib.buildApplicationChains([thread([msg('i','Scheduling your client interview. https://teams.microsoft.com/meet/123',{subject:'Client interview',category:'Interview Request'})])])[0]
  assert.equal(a.stops.find(s=>s.key==='client').reached,true)
  const b=lib.buildApplicationChains([thread([msg('j','Client Interview: In person. We are seeking candidates.',{subject:'Open role',category:'Interview Request'})])])[0]
  assert.equal(b.stops.find(s=>s.key==='client').reached,false)
})
check('recipient extraction starts after the action, not an introductory to', () => assert.equal(evidence.submissionEvidence('I wanted to inform you that I have submitted your profile to Alex.').recipientLabel,'Alex'))
check('same requisition and exact recruiter reconcile separate update thread', () => {
 const a=thread([msg('1','RTR',{subject:'RTR Security Analyst 166585'})])
 const b={...thread([msg('2','Profile submitted to Client Partner.',{subject:'Update Security Analyst 166585'})]),threadId:'t2'}
 assert.equal(evidence.linkReferencedThreads([a,b]).length,1)
})
check('requisition alone with unrelated recruiters does not merge', () => {
 const a=thread([msg('1','RTR',{subject:'RTR Security Analyst 166585'})])
 const b={...thread([msg('2','Submitted your profile to client.',{subject:'Security Analyst 166585',from:'other@different.com'})]),threadId:'t2'}
 assert.equal(evidence.linkReferencedThreads([a,b]).length,2)
})
check('same generic title and recruiter does not merge different applications', () => {
 const a=thread([msg('1','RTR',{subject:'Security Engineer'})])
 const b={...thread([msg('2','RTR',{subject:'Security Engineer'})]),threadId:'t2'}
 assert.equal(evidence.linkReferencedThreads([a,b]).length,2)
})
check('personal and webinar calendar attachments are not interviews', () => {
  for (const subject of ['Birthday party', 'Security Engineer webinar']) {
    assert.equal(lib.inviteEvidence(thread([msg('n','Join us',{subject,hasIcs:true,category:'General Correspondence'})])).confirmed,false)
  }
})
check('role-specific recruiting calendar invitation survives general classification', () => {
  const c=lib.buildApplicationChains([thread([msg('c','Join with Google Meet',{subject:'Invitation: Security Engineer',hasIcs:true,category:'General Correspondence'})])])[0]
  assert.equal(c.current,'interview')
})
console.log(`${count} evidence tests passed`)
