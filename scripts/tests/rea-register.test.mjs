import test from 'node:test'
import assert from 'node:assert/strict'
import {REA_SESSIONS,filterReaSessions} from '../../src/lib/rea-register.ts'
import {PLAN_JOURNAL} from '../../src/lib/plan-vision-journal.ts'
import {readFileSync,existsSync} from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'../..')
test('each REA session retains source, ordered findings, boundaries and next action',()=>{
 assert.equal(new Set(REA_SESSIONS.map(s=>s.id)).size,REA_SESSIONS.length)
 for(const s of REA_SESSIONS){assert.ok(s.request&&s.limits&&s.next&&s.sources.length&&s.steps.length);for(const step of s.steps)assert.ok(step.label&&step.finding&&step.evidence);for(const source of s.sources)if(source.path)assert.ok(existsSync(path.join(root,source.path)),source.path)}
})
test('filters find Parakeet and keep tool failures distinct from public reviews',()=>{
 assert.ok(filterReaSessions('Parakeet','kompas','all').some(s=>s.id==='parakeet-kompas'))  // later sessions may cite Parakeet too
 const tool=filterReaSessions('','all','REA tool attempt');assert.ok(tool.length>=1);assert.equal(tool.find(s=>s.id==='rea-tool-inventory').state,'Blocked')
 assert.ok(filterReaSessions('','all','Public reference review').every(s=>s.method==='Public reference review'))
 assert.equal(filterReaSessions('Parakeet','gmail','all').length,0)
})
test('REA route inherits existing admin gate and is discoverable from hub',()=>{
 assert.match(readFileSync(path.join(root,'src/app/dashboard/admin/vision/layout.tsx'),'utf8'),/await requireVisionAdmin\(\)/)
 assert.match(readFileSync(path.join(root,'src/app/dashboard/admin/vision/page.tsx'),'utf8'),/href="\/dashboard\/admin\/vision\/rea"/)
})

test('released desktop browser remains deployed with acceptance still explicit',()=>{
 const entry=REA_SESSIONS.find(s=>s.id==='inclusive-browser-desktop')
 assert.ok(entry)
 assert.equal(entry.state,'Deployed, verification pending')
 assert.match(entry.limits,/real portal\/SSO\/upload\/restart acceptance pending/)
})


test('Oct 17 WhatsApp source recovery separates deployed code from blocked historical acceptance', () => {
 const entry=REA_SESSIONS.find(s=>s.id==='whatsapp-oct17-source-recovery-2026-11-10')
 assert.ok(entry)
 assert.equal(entry.state,'Deployed, verification pending')
 assert.ok(entry.steps.some(s=>s.status==='Tested' && s.evidence.includes('dpl_7gjdfRFeLjqcPdVC52NkaEatugKA')))
 assert.ok(entry.steps.some(s=>s.status==='Blocked' && s.finding.includes('generated output')))
 assert.match(entry.next,/owner reconciliation/)
 assert.match(entry.next,/signed delivery\/read receipt/)
})


test('final-DOCX Gemini, source-archive, Gmail and crawler acceptance gates stay explicit', () => {
 const gemini=REA_SESSIONS.find(s=>s.id==='resume-gemini-final-docx-ats-review-2026-11-10')
 assert.ok(gemini)
 assert.equal(gemini.state,'Blocked')
 assert.match(gemini.next,/final-DOCX/)
 const source=REA_SESSIONS.find(s=>s.id==='whatsapp-oct17-source-archive-verification-2026-11-10')
 assert.ok(source)
 assert.ok(source.steps.some(s=>s.status==='Tested' && s.finding.includes('27,724 bytes')))
 assert.ok(source.steps.some(s=>s.status==='Blocked' && s.finding.includes('R2 key')))
 const gmail=REA_SESSIONS.find(s=>s.id==='gmail-poke-background-update-2026-11-10')
 assert.ok(gmail)
 assert.equal(gmail.state,'Blocked')
 assert.match(gmail.limits,/No live Gmail API call/)
 const crawler=REA_SESSIONS.find(s=>s.id==='contract-crawler-work-type-postmerge-run-2026-11-10')
 assert.ok(crawler)
 assert.equal(crawler.state,'Blocked')
 assert.match(crawler.limits,/post-classifier crawl/)
})


test('Oct 17 public REA record avoids private source locators', () => {
 const entry = REA_SESSIONS.find(s => s.id === 'whatsapp-oct17-source-archive-verification-2026-11-10')
 assert.ok(entry)
 const publicRecord = JSON.stringify(entry)
 assert.match(publicRecord, /private Library(?: resume)? archive/)
 assert.doesNotMatch(publicRecord, /\\b[a-f0-9]{16}\\b/i)
 assert.doesNotMatch(publicRecord, /\\b\\d{13}\\b/)
 assert.doesNotMatch(publicRecord, /\\.docx/i)
})

test('Gmail owner approvals remain distinct from unapproved C2H alias semantics', () => {
 const gmail=REA_SESSIONS.find(s=>s.id==='gmail-poke-owner-approval-provenance-2026-11-15')
 const crawler=REA_SESSIONS.find(s=>s.id==='contract-c2h-alias-approval-correction-2026-11-15')
 const oldAlias=REA_SESSIONS.find(s=>s.id==='contract-c2h-owner-approved-aliases-2026-11-15')
 const oldScope=REA_SESSIONS.find(s=>s.id==='contract-c2h-scope-provenance-2026-11-13')
 const oldGmail=REA_SESSIONS.find(s=>s.id==='gmail-mobile-scope-provenance-2026-11-13')
 assert.ok(gmail && crawler && oldAlias && oldScope && oldGmail)
 assert.equal(gmail.state,'Research mapped')
 assert.equal(crawler.state,'Blocked')
 assert.equal(oldAlias.state,'Blocked')
 assert.equal(oldScope.state,'Blocked')
 assert.equal(oldGmail.state,'Research mapped')
 assert.match(gmail.limits,/No Gmail API call/)
 assert.match(crawler.limits,/No direct owner approval.*alias mapping/i)
 const plan=readFileSync(path.join(root,'src/lib/plan-vision.ts'),'utf8')
 const lower=plan.toLowerCase()
 assert.ok(plan.includes('up to four connected Gmail accounts'))
 assert.ok(plan.includes('closed navigation stays hidden'))
 assert.ok(lower.includes('per-account calendar target selection and exact waiting-on-them radar semantics remain proposed'))
 assert.ok(plan.includes('Contract To Perm / Right To Hire alias mapping and associated negation rules remain unapproved'))
 assert.match(plan,/manual\/on-demand only/i)
 assert.match(plan,/Robert Half remains manual-only/i)
 assert.match(plan,/generic contract-administration.*unapproved/i)
})

test('WhatsApp offline fallback and confirmed-skill restacks remain blocked until acceptance', () => {
 const whatsapp=REA_SESSIONS.find(s=>s.id==='whatsapp-offline-cas-pr374-current-master-2026-11-13')
 const skills=REA_SESSIONS.find(s=>s.id==='resume-confirmed-skill-pr377-current-master-2026-11-13')
 assert.ok(whatsapp && skills)
 assert.equal(whatsapp.state,'Blocked')
 assert.equal(skills.state,'Blocked')
 assert.match(whatsapp.limits,/generated output|R2 object\/version|signed delivery/i)
 assert.match(whatsapp.limits,/protected preview/i)
 assert.match(skills.limits,/exported-DOCX acceptance/i)
})


test('conflicting secondary approval reports stay blocked until primary owner messages are available',()=>{
 const rea=REA_SESSIONS.find(s=>s.id==='owner-approval-secondary-report-reconciliation-2026-11-15')
 assert.ok(rea)
 assert.equal(rea.state,'Blocked')
 assert.match(rea.limits,/No primary 14 Nov owner message was retrieved/)
 const journal=PLAN_JOURNAL.find(s=>s.id==='owner-approval-secondary-report-reconciliation-2026-11-15')
 assert.ok(journal)
 assert.equal(journal.approval,'proposed')
 assert.equal(journal.delivery,'blocked')
 const plan=readFileSync(path.join(root,'src/lib/plan-vision.ts'),'utf8')
 assert.match(plan,/conflicting secondary reports/)
 assert.match(plan,/keep aliases unverified/)
 assert.match(plan,/first-person blanket-confirmation correction/)
})
