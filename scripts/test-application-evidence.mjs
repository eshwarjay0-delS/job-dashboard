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
check('generic client is not automatically end client', () => assert.equal(evidence.submissionEvidence('I have submitted your profile to the client.').client, false))
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
console.log(`${count} evidence tests passed`)
