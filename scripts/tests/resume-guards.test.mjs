// Resume guards (src/lib/resume-round-trip-guard.ts, src/lib/resume-keyword-report.ts). Tests written before the code.
// All resumes here are invented example data (example.com, 555 numbers).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import { checkRoundTrip, docxText, docxIdentityText } from '../../src/lib/resume-round-trip-guard.ts'
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
test('roundtrip: same-paragraph header title may change while protected name stays identical', () => {
  const source = SRC.replace('Alex Example\n', 'Alex Example | Security Engineer\n')
  const output = source.replace('Alex Example | Security Engineer', 'Alex Example | Cloud Security Consultant')
  assert.equal(checkRoundTrip(source, output).ok, true)
})
test('roundtrip: same-paragraph em dash header title may change', () => {
  const source = SRC.replace('Alex Example\n', 'Alex Example — Security Engineer\n')
  const output = source.replace('Alex Example — Security Engineer', 'Alex Example — Cloud Security Consultant')
  assert.equal(checkRoundTrip(source, output).ok, true)
})
test('roundtrip: protected name mutation still fails inside same-paragraph header', () => {
  const source = SRC.replace('Alex Example\n', 'Alex Example | Security Engineer\n')
  const output = source.replace('Alex Example | Security Engineer', 'Alexander Example | Cloud Security Consultant')
  assert.ok(checkRoundTrip(source, output).problems.some(p => p.startsWith('name changed')))
})
test('roundtrip: changed contact still fails even when header title changes', () => {
  const source = SRC.replace('Alex Example\n', 'Alex Example | Security Engineer\n')
  const output = source.replace('Alex Example | Security Engineer', 'Alex Example | Cloud Security Consultant')
    .replace('alex.example@example.com', 'alex.changed@example.com')
  assert.equal(checkRoundTrip(source, output).ok, false)
})
test('roundtrip: tab-separated title may change while the protected name stays identical', () => {
  const source = SRC.replace('Alex Example\n', 'Alex Example\tSecurity Engineer\n')
  const output = source.replace('Alex Example\tSecurity Engineer', 'Alex Example\tIT Governance Consultant')
  assert.equal(checkRoundTrip(source, output).ok, true)
  const renamed = output.replace('Alex Example\tIT Governance Consultant', 'Alexander Example\tIT Governance Consultant')
  assert.ok(checkRoundTrip(source, renamed).problems.some(problem => problem.startsWith('name changed')))
})
test('roundtrip: ambiguous single-token header prefix is not silently trusted', () => {
  const source = SRC.replace('Alex Example\n', 'Alex | Example Engineer\n')
  const output = source.replace('Alex | Example Engineer', 'Alex | Cloud Consultant')
  assert.equal(checkRoundTrip(source, output).ok, false)
})
test('roundtrip: email changed fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace('alex.example@', 'alex.ex@')).ok, false); })
test('roundtrip: phone changed fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace('010-1234', '010-1235')).ok, false); })
test('roundtrip: phone reformatted only passes', () => { assert.equal(checkRoundTrip(SRC, SRC.replace('(555) 010-1234', '555-010-1234')).ok, true); })
test('roundtrip: link dropped fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace(' | linkedin.com/in/alex-example', '')).ok, false); })
test('roundtrip: date shifted fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace('Jan 2020', 'Feb 2020')).ok, false); })
test('roundtrip: date dropped fails', () => { assert.equal(checkRoundTrip(SRC, SRC.replace(', 2013-2017', '')).ok, false); })
test('roundtrip: new date added fails', () => { assert.equal(checkRoundTrip(SRC, SRC + '\nNew Co, 2010-2012').ok, false); })
test('roundtrip: incidental years in summary do not falsely fail preservation', () => {
  const source = SRC + '\\nSUMMARY\\nBuilt security tooling in 2024.'
  const output = SRC + '\\nSUMMARY\\nBuilt security tooling for API risk assessment.'
  assert.equal(checkRoundTrip(source, output).ok, true)
})
test('roundtrip: year-only employment range changes still fail', () => {
  const source = 'Alex Example\\nEXPERIENCE\\nExample Corp | Engineer | 2019-2022'
  const output = 'Alex Example\\nEXPERIENCE\\nExample Corp | Engineer | 2019-2023'
  assert.equal(checkRoundTrip(source, output).ok, false)
})
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


async function syntheticWordDocx(paragraphs) {
  const xmlEscape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs.map(p => '<w:p><w:r><w:t xml:space="preserve">' + xmlEscape(p) + '</w:t></w:r></w:p>').join('') + '</w:body></w:document>')
  return zip.generateAsync({ type: 'nodebuffer' })
}
test('roundtrip: actual DOCX Mammoth extraction allows title edit but preserves protected name, contacts and repeated dates', async () => {
  const original = await syntheticWordDocx(['Alex Example | Security Engineer', 'alex.example@example.com | 555-010-1234 | linkedin.com/in/alex-example', 'Example Corp — Jan 2020 – Present', 'Sample LLC — Jan 2020 – Dec 2021'])
  const edited = await syntheticWordDocx(['Alex Example | IT Governance Consultant', 'alex.example@example.com | 555-010-1234 | linkedin.com/in/alex-example', 'Example Corp — Jan 2020 – Present', 'Sample LLC — Jan 2020 – Dec 2021'])
  const originalText = (await mammoth.extractRawText({ buffer: original })).value
  const editedText = (await mammoth.extractRawText({ buffer: edited })).value
  assert.equal(checkRoundTrip(originalText, editedText).ok, true)
  const renamed = await syntheticWordDocx(['Alexander Example | IT Governance Consultant', 'alex.example@example.com | 555-010-1234 | linkedin.com/in/alex-example', 'Example Corp — Jan 2020 – Present', 'Sample LLC — Jan 2020 – Dec 2021'])
  assert.ok(checkRoundTrip(originalText, (await mammoth.extractRawText({ buffer: renamed })).value).problems.some(p => p.startsWith('name changed')))
  const missingDate = await syntheticWordDocx(['Alex Example | IT Governance Consultant', 'alex.example@example.com | 555-010-1234 | linkedin.com/in/alex-example', 'Example Corp — Jan 2020 – Present', 'Sample LLC — Feb 2020 – Dec 2021'])
  assert.ok(checkRoundTrip(originalText, (await mammoth.extractRawText({ buffer: missingDate })).value).problems.some(p => p.startsWith('date')))
})


async function syntheticIdentityDocx({ paragraphs, header, footer, linkTarget, splitRuns = false }) {
  const xmlEscape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const para = (value, split = false) => {
    const pieces = split ? String(value).split(/(?<=\s)/).filter(Boolean) : [String(value)]
    return '<w:p>' + pieces.map(piece => '<w:r><w:t xml:space="preserve">' + xmlEscape(piece) + '</w:t></w:r>').join('') + '</w:p>'
  }
  const zip = new JSZip()
  const refs = []
  const rels = []
  let body = paragraphs.map((value, index) => para(value, splitRuns && index === 0)).join('')
  if (linkTarget) {
    body += '<w:p><w:hyperlink r:id="rIdLink"><w:r><w:t>LinkedIn</w:t></w:r></w:hyperlink></w:p>'
    rels.push('<Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + xmlEscape(linkTarget) + '" TargetMode="External"/>')
  }
  if (header) {
    refs.push('<w:headerReference w:type="default" r:id="rIdHeader"/>')
    rels.push('<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>')
    zip.file('word/header1.xml', '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + para(header) + '</w:hdr>')
  }
  if (footer) {
    refs.push('<w:footerReference w:type="default" r:id="rIdFooter"/>')
    rels.push('<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>')
    zip.file('word/footer1.xml', '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + para(footer) + '</w:ftr>')
  }
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + body + '<w:sectPr>' + refs.join('') + '</w:sectPr></w:body></w:document>')
  zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>')
  return zip.generateAsync({ type: 'nodebuffer' })
}

test('DOCX identity extraction includes referenced headers, footers and external hyperlink targets, and survives split runs', async () => {
  const facts = {
    paragraphs: ['Alex Example', 'alex.example@example.com | 555-010-1234', 'Example Corp — Jan 2020 – Present'],
    header: 'Contact | 555-010-1234',
    footer: 'Employment record | Jan 2020',
    linkTarget: 'https://linkedin.com/in/alex-example',
  }
  const source = await syntheticIdentityDocx(facts)
  const reformatted = await syntheticIdentityDocx({ ...facts, splitRuns: true })
  const sourceText = await docxIdentityText(source)
  const reformattedText = await docxIdentityText(reformatted)
  assert.match(sourceText, /555-010-1234/)
  assert.match(sourceText, /linkedin\.com\/in\/alex-example/)
  assert.match(sourceText, /Jan 2020/)
  assert.equal(checkRoundTrip(sourceText, reformattedText).ok, true)
})

test('DOCX identity extraction rejects real name, email, phone and experience-date mutations', async () => {
  const facts = {
    paragraphs: ['Alex Example', 'alex.example@example.com | 555-010-1234', 'Example Corp — Jan 2020 – Present'],
    header: 'Contact | 555-010-1234',
    footer: 'Employment record | Jan 2020',
    linkTarget: 'https://linkedin.com/in/alex-example',
  }
  const sourceText = await docxIdentityText(await syntheticIdentityDocx(facts))
  const mutations = [
    { changes: { paragraphs: ['Alexander Example', ...facts.paragraphs.slice(1)] }, category: 'name' },
    { changes: { paragraphs: [facts.paragraphs[0], facts.paragraphs[1].replace('alex.example@example.com', 'other@example.com'), facts.paragraphs[2]] }, category: 'email' },
    { changes: { paragraphs: [facts.paragraphs[0], facts.paragraphs[1].replace('555-010-1234', '555-010-1235'), facts.paragraphs[2]] }, category: 'phone' },
    { changes: { paragraphs: [facts.paragraphs[0], facts.paragraphs[1], facts.paragraphs[2].replace('Jan 2020', 'Feb 2020')] }, category: 'date' },
  ]
  for (const mutation of mutations) {
    const output = await docxIdentityText(await syntheticIdentityDocx({ ...facts, ...mutation.changes }))
    assert.ok(checkRoundTrip(sourceText, output).problems.some(problem => problem.startsWith(mutation.category)), mutation.category)
  }
})

test('DOCX identity extraction rejects header phone, footer date and hyperlink target mutations', async () => {
  const facts = {
    paragraphs: ['Alex Example', 'alex.example@example.com | 555-010-1234', 'Example Corp — Jan 2020 – Present'],
    header: 'Contact | 555-010-1234',
    footer: 'Employment record | Jan 2020',
    linkTarget: 'https://linkedin.com/in/alex-example',
  }
  const sourceText = await docxIdentityText(await syntheticIdentityDocx(facts))
  const changedHeader = await docxIdentityText(await syntheticIdentityDocx({ ...facts, header: 'Contact | 555-010-1235' }))
  const changedFooter = await docxIdentityText(await syntheticIdentityDocx({ ...facts, footer: 'Employment record | Feb 2020' }))
  const changedLink = await docxIdentityText(await syntheticIdentityDocx({ ...facts, linkTarget: 'https://linkedin.com/in/other-example' }))
  assert.ok(checkRoundTrip(sourceText, changedHeader).problems.some(problem => problem.startsWith('phone')))
  assert.ok(checkRoundTrip(sourceText, changedFooter).problems.some(problem => problem.startsWith('date')))
  assert.ok(checkRoundTrip(sourceText, changedLink).problems.some(problem => problem.startsWith('url')))
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

// Swipe-reply failures must never send the original or a partial baseline.
// Initial-JD offline fallback is a separate selected-library-only NOT TAILORED path.
test('WhatsApp refine never sends the original or a partial baseline when an update fails', () => {
  const route = readFileSync(new URL('../../src/app/api/whatsapp/webhook/route.ts', import.meta.url), 'utf8')
  const start = route.indexOf('async function refine(')
  const end = route.indexOf('\nasync function deliver(', start)
  assert.ok(start >= 0 && end > start, 'the swipe-reply function can be isolated')
  const refine = route.slice(start, end)

  assert.match(refine, /if \(!source\) \{\s*return sendText\(from, "I could not verify the original resume for this update, so no file was sent\. Your previous resume is unchanged\."\)/)
  assert.match(refine, /if \(!whatsappRewriteUsable\(result\)\) \{\s*return sendText\(from, `\$\{qualityStop\(result\)\} No file was sent; your previous resume is unchanged\.`\)/)
  assert.match(refine, /catch \(error\) \{\s*const timedOut = \/timed out\/i\.test\(String\(error\)\)\s*return sendText\(from, timedOut/)
  assert.match(refine, /if \(!file\) \{\s*return sendText\(from, "The updated Word file could not be opened\. No file was sent; your previous resume is unchanged\."\)/)
  assert.match(refine, /if \(!\(await sameResumeFacts\(source, file\)\)\) \{\s*return sendText\(from, "The update failed name, contact or employment-date verification\. No file was sent; your previous resume is unchanged\."\)/)
  assert.doesNotMatch(refine, /sendBaseline|sendClosest|deliver\(from, baseline/)

  // The initial-JD path is separate: only a selected same-account library file
  // can use the no-provider fallback, and the caption explicitly says NOT TAILORED.
  assert.match(route, /if \(files && await sendOfflineOriginal\(\)\) return/)
  assert.match(route, /const expectedRoot = filesOf\(userId\)/)
  assert.match(route, /const relative = path\.normalize\(files\.rel\)/)
  assert.match(route, /path\.resolve\(root, relative\) !== selected/)
  assert.match(route, /libraryBytes\.equals\(sessionBytes\)/)
  assert.match(route, /NOT TAILORED — AI provider unavailable/)
  assert.match(route, /why = "NOT TAILORED — AI provider unavailable\."/)
  assert.match(route, /return sendClosest\(why, libraryBytes\)/)
  assert.match(route, /sendOfflineOriginal\("NOT TAILORED — AI rewrite incomplete\."\)/)
  assert.match(route, /docxIdentityText\(source\)/)
  assert.match(route, /docxIdentityText\(file\)/)
})

test('resume identity: email-only mismatch logs category without exposing addresses', () => {
  const identity = readFileSync(new URL('../../src/lib/resume-identity.ts', import.meta.url), 'utf8')
  assert.match(identity, /if \(emails\(source\) !== emails\(output\)\) \{[\s\S]*?categories: \["email"\][\s\S]*?return false/)
  assert.doesNotMatch(identity, /console\.error\([^\n]*(?:emails\(source\)|emails\(output\)|sourceText|outputText)/)
  assert.equal(checkRoundTrip(SRC, SRC.replace('alex.example@example.com', 'other@example.com')).ok, false)
})
