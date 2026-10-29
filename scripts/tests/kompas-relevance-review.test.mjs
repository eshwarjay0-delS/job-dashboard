import test from 'node:test'
import assert from 'node:assert/strict'
import {assessAnswer,comparePair,compareExport} from '../kompas-relevance-review.mjs'

const fixtures=[
 {question:'What questions do you have for me about the team?',
  reference:'Which control area has the biggest issue-management challenges today, and what would good ownership look like in the first ninety days?',
  kompas:'I would run DCSync with Cobalt Strike, then AS-REP roasting against the environment.'},
 {question:'How do you assess business impact, root cause, compensating controls and residual risk?',
  reference:'I check which business services are affected, independently validate root cause and supporting evidence, assess whether compensating controls reduce exposure, and document the residual risk.',
  kompas:'I built SIEM dashboards and automated reporting.'},
 {question:'What is the difference between policy deviations and policy exceptions?',
  reference:'A deviation is when actual practice does not meet a requirement; an exception is a formally approved and time-bound departure from that requirement.',
  kompas:'An exception is something that can be approved.'},
 {question:'Which framework are you stronger with, NIST CSF or CRI?',
  reference:'I am stronger with NIST CSF for structuring control reviews, while I have also used the CRI Profile in industry assessments.',
  kompas:'I will summarize how the CISO is the owner, and how I approved every framework.'},
 {question:'What is NLA?',
  reference:'NLA means Network Level Authentication. It checks the user before opening a full Remote Desktop session.',
  kompas:'I worked on risk dashboards and project tracking.'},
 {question:'What would you bring to this role?',
  reference:'I combine hands-on understanding of security controls with the judgment to challenge incomplete remediation plans and explain remaining risk clearly.',
  kompas:'My AS-REP roasting and BloodHound work is supported by a reverse shell.'}
]
test('A side-by-side comparison accepts real exported answer fields without inventing absent responses',()=>{
 assert.throws(()=>compareExport({}),/Expected array/)
 const r=compareExport(fixtures)
 assert.equal(r.total,6)
 assert.equal(r.withBoth,6)
 assert.equal(r.summary.missingOrUnrecognizedOriginals,0)
 assert.ok(r.summary.kompasDiagnosticIssues>r.summary.referenceDiagnosticIssues)
 assert.ok(r.comparisons.every(c=>Number.isFinite(c.deltaDiagnostics)))
})
test('The comparator flags unrelated technical density in soft questions',()=>{
 const row=comparePair(fixtures[0])
 assert.deepEqual(row.reference.unaskedJargon,[])
 assert.ok(row.kompas.unaskedJargon.length>=2)
})
test('The comparator flags missing named parts without pretending to judge truth',()=>{
 const row=comparePair(fixtures[1])
 assert.equal(row.reference.missingKnownTopics.length,0)
 assert.ok(row.kompas.missingKnownTopics.length>=3)
 assert.match(row.note,/not proof of factuality/)
})
test('Question-specific named technologies matter when they were explicitly asked',()=>{
 const row=comparePair(fixtures[4])
 assert.deepEqual(row.reference.missingKnownTopics,[])
 assert.ok(row.kompas.missingKnownTopics.includes('NLA'))
})
test('Empty Kompas text is identified rather than replaced with synthetic output',()=>{
 const r=compareExport([{question:'What is residual risk?',reference:'Remaining exposure after controls.',kompas:''}])
 assert.equal(r.total,1)
 assert.equal(r.withBoth,0)
 assert.equal(r.summary.missingOrUnrecognizedOriginals,1)
})
