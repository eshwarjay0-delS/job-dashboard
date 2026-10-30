// Resume guards (src/lib/resume-round-trip-guard.ts, src/lib/resume-keyword-report.ts). Tests written before the code.
// All resumes here are invented example data (example.com, 555 numbers).
import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { checkRoundTrip, docxText } from '../../src/lib/resume-round-trip-guard.ts'
import { buildKeywordReport } from '../../src/lib/resume-keyword-report.ts'

const SRC = `Alex Example
alex.example@example.com | (555) 010-1234 | linkedin.com/in/alex-example
EXPERIENCE
Example Corp — Engineer, Jan 2020 – Present
Sample LLC — Analyst, 03/2017 - 12/2019
EDUCATION
Example University, 2013-2017
SKILLS
Python, SQL`

test('roundtrip: identical passes', () => { assert.equal(checkRoundTrip(SRC, SRC).ok, true); })
test('roundtrip: name changed fails', () => {
  const r = checkRoundTrip(SRC, SRC.replace('Alex Example', 'Alexander Example'))
  assert.equal(r.ok, false); assert.ok(r.problems.some(p => /name/i.test(p)))
})
test('roundtrip: email changed fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace('alex.example@', 'alex.ex@')).ok, false); })
test('roundtrip: phone changed fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace('010-1234', '010-1235')).ok, false); })
test('roundtrip: phone reformatted only passes', () => { assert.equal(checkRoundTrip(SRC, SRC.replace('(555) 010-1234', '555-010-1234')).ok, true); })
test('roundtrip: link dropped fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace(' | linkedin.com/in/alex-example', '')).ok, false); })
test('roundtrip: date shifted fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace('Jan 2020', 'Feb 2020')).ok, false); })
test('roundtrip: date dropped fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace(', 2013-2017', '')).ok, false); })
test('roundtrip: new date added fails', () => { assert.equal(checkRoundTrip(SRC, SRC + '\nNew Co, 2010-2012').ok, false); })
test('roundtrip: skills-line-only addition passes', () => {
  const r = checkRoundTrip(SRC, SRC.replace('Python, SQL', 'Python, SQL, Kubernetes, CI/CD, C++'))
  assert.deepEqual(r.problems, []); assert.equal(r.ok, true)
})
test('roundtrip: docxText reads a .docx', async () => {
  const xml = '<?xml version="1.0"?><w:document xmlns:w="w"><w:body><w:p><w:r><w:t>Alex Example</w:t></w:r></w:p><w:p><w:r><w:t>alex.example@example.com &amp; (555) 010-1234</w:t></w:r></w:p></w:body></w:document>'
  const zip = new JSZip(); zip.file('word/document.xml', xml)
  const t = await docxText(await zip.generateAsync({ type: 'nodebuffer' }))
  assert.match(t, /^Alex Example\n/); assert.match(t, /& \(555\)/)
})

const R = 'Built Python services, C++ engines and .NET apps. Ran CI-CD pipelines.'
test('keywords: covered/supported/unsupported split and counts sum', () => {
  const r = buildKeywordReport({ jobTerms: ['Python', 'Docker', 'Rust', 'SQL'], resumeText: R, supportedTerms: ['docker'] })
  assert.deepEqual(r.covered, ['Python']); assert.deepEqual(r.supportedGap, ['Docker']); assert.deepEqual(r.unsupportedGap, ['Rust', 'SQL'])
  assert.equal(r.counts.covered + r.counts.supportedGap + r.counts.unsupportedGap, r.counts.total)
  assert.equal(r.coveragePct, 25)
})
test('keywords: unsupported never listed as supported', () => {
  const r = buildKeywordReport({ jobTerms: ['Go', 'Terraform'], resumeText: 'Python', supportedTerms: [] })
  assert.deepEqual(r.supportedGap, []); assert.deepEqual(r.unsupportedGap, ['Go', 'Terraform'])
})
test('keywords: empty terms -> zeros, noTerms flag', () => {
  const r = buildKeywordReport({ jobTerms: [], resumeText: R, supportedTerms: [] })
  assert.equal(r.noTerms, true); assert.deepEqual(r.counts, { total: 0, covered: 0, supportedGap: 0, unsupportedGap: 0 }); assert.equal(r.coveragePct, 0)
})
test('keywords: C++/C#/.NET/CI-CD normalization', () => {
  const r = buildKeywordReport({ jobTerms: ['c++', 'C#', '.net', 'CI/CD', 'C'], resumeText: R, supportedTerms: [] })
  assert.deepEqual(r.covered, ['c++', '.net', 'CI/CD']); assert.deepEqual(r.unsupportedGap, ['C#', 'C'])
})
test('keywords: case-insensitive', () => {
  const r = buildKeywordReport({ jobTerms: ['PYTHON', 'Java'], resumeText: R, supportedTerms: ['JAVA'] })
  assert.deepEqual(r.covered, ['PYTHON']); assert.deepEqual(r.supportedGap, ['Java'])
})
test('keywords: Java not matched inside JavaScript', () => {
  const r = buildKeywordReport({ jobTerms: ['Java'], resumeText: 'JavaScript', supportedTerms: [] })
  assert.deepEqual(r.covered, [])
})
