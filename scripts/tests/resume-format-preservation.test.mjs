import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import JSZip from 'jszip'
import { preserveSkillHeadings } from '../../src/lib/resume-format.ts'
const require = createRequire(import.meta.url)
const module = { exports: {} }
runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/lib/docx.ts', import.meta.url), 'utf8'), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, require, Buffer, console })
const { applyRewrites, extractZones } = module.exports

test('original expertise headings survive renamed or omitted model headings', () => {
  const source = [{ idx: 2, text: 'Cloud Security: AWS, Azure' }]
  assert.equal(preserveSkillHeadings(source, [{ idx: 2, text: 'Platforms: AWS, Azure, Microsoft Defender for Cloud' }])[0].text, 'Cloud Security: AWS, Azure, Microsoft Defender for Cloud')
  assert.equal(preserveSkillHeadings(source, [{ idx: 2, text: 'AWS, Azure' }])[0].text, source[0].text)
})
test('Word edits retain summary, paragraph properties, run formatting and ancillary files', async () => {
  const p = text => `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri"/><w:b/><w:sz w:val="22"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`
  const lines = ['Eshwar', 'Original summary is unchanged.', 'Cloud Security: Azure', 'Investigated Azure security alerts.']
  const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(p).join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`
  const zip = new JSZip(); zip.file('word/document.xml', xml); zip.file('word/styles.xml', '<styles/>'); zip.file('word/header1.xml', '<header>same@email.com</header>')
  const source = await zip.generateAsync({ type: 'nodebuffer' })
  const zones = { header: null, summaryIdx: 1, summaryText: lines[1], summaryOverflowIdx: [], skills: [{ idx: 2, text: lines[2] }], roles: [{ role: 'Client', bullets: [{ idx: 3, text: lines[3] }] }], extras: [] }
  const result = await applyRewrites(source, { summary: '', skills: preserveSkillHeadings(zones.skills, [{ idx: 2, text: 'Azure, Microsoft Defender for Cloud' }]), bullets: [{ idx: 3, text: 'Investigated Microsoft Defender for Cloud alerts in Azure to identify misconfigured resources.' }] }, zones)
  const out = await JSZip.loadAsync(result.buffer)
  const actual = await out.file('word/document.xml').async('string')
  assert.ok(actual.includes(p(lines[1])))
  const structure = value => value.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/g, '<w:t/>')
  assert.equal(structure(actual), structure(xml))
  assert.ok(actual.includes('Cloud Security: Azure, Microsoft Defender for Cloud'))
  assert.equal(await out.file('word/styles.xml').async('string'), '<styles/>')
  assert.equal(await out.file('word/header1.xml').async('string'), '<header>same@email.com</header>')
})


test('stacked long employer headings and project labels are not editable role bullets', async () => {
  const lines = ['PROFESSIONAL EXPERIENCE',
    'Wipro — Michigan State University | East Lansing, Michigan | Remote',
    'Senior Salesforce Administrator | November 2024 – Present',
    'Project: Enterprise Salesforce Administration and Service Management',
    '• Built Salesforce flows for case routing.',
    'Wells Fargo | San Francisco, California',
    'Salesforce Administrator | March 2023 – October 2024',
    'Project: Enterprise CRM Administration',
    '• Configured approval processes for service requests.']
  const zip = new JSZip()
  zip.file('word/document.xml', `<w:document><w:body>${lines.map(t => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`)
  const zones = await extractZones(await zip.generateAsync({type:'nodebuffer'}))
  assert.equal(zones.roles.length, 2)
  assert.equal(zones.roles[0].current, true)
  assert.equal(zones.roles[1].current, false)
  assert.deepEqual(Array.from(zones.roles, r => Array.from(r.bullets, b => b.idx)), [[4], [8]])
})

// Nov 4 cert-image report: a badge image inside a rewritten paragraph must survive,
// because the text regex never touches drawing runs — but a dropped or blanked
// paragraph takes its image with it. These tests pin that exact boundary.
const CERT_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const CERT_DRAWING = '<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="914400" cy="914400"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId5" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'

async function certDoc() {
  const paras = [
    `<w:p><w:r><w:t>Eshwar Janjirala</w:t></w:r></w:p>`,
    `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Identity &amp; Access Management:</w:t></w:r><w:r><w:t> Led IAM modernization across 40 apps.</w:t></w:r></w:p>`,
    `<w:p>${CERT_DRAWING}<w:r><w:t>CISSP Certified, 2021</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>Monitored SIEM alerts daily.</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>Attended weekly meetings.</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>Security engineer with 8 years experience.</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>Additional summary prose from an old run.</w:t></w:r></w:p>`,
  ]
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>')
  zip.file('word/media/image1.png', CERT_PNG)
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paras.join('')}</w:body></w:document>`)
  const zones = {
    header: null, summaryIdx: 5, summaryText: 'Security engineer with 8 years experience.', summaryOverflowIdx: [6],
    skills: [],
    roles: [{ role: 'Security Engineer', bullets: [
      { idx: 1, text: 'Identity & Access Management: Led IAM modernization across 40 apps.' },
      { idx: 3, text: 'Monitored SIEM alerts daily.' },
      { idx: 4, text: 'Attended weekly meetings.' },
    ] }],
    extras: [{ idx: 2, text: 'CISSP Certified, 2021', section: 'certifications' }],
  }
  const edits = {
    summary: 'Security engineer, 8 years in SOC and cloud security.',
    bullets: [{ idx: 1, text: 'Identity & Access Management: Delivered SSO and MFA modernization across 40 apps with zero downtime.' }],
    extras: [{ idx: 2, text: 'CISSP Certified, 2021 — Security Architecture.' }],
  }
  const input = await zip.generateAsync({ type: 'nodebuffer' })
  const { buffer } = await applyRewrites(input, edits, zones, { dropIdx: new Set([4]) })
  const out = await JSZip.loadAsync(buffer)
  return { xml: await out.file('word/document.xml').async('string'), media: await out.file('word/media/image1.png').async('nodebuffer') }
}

test('a cert badge image survives the rewrite of its own paragraph', async () => {
  const { xml, media } = await certDoc()
  assert.ok(media.equals(CERT_PNG), 'media bytes must be byte-identical')
  assert.ok(xml.includes('a:blip'), 'drawing element must still be in document.xml')
  assert.ok(xml.includes('r:embed="rId5"'), 'image relationship must still be referenced')
  assert.ok(xml.includes('CISSP Certified, 2021 — Security Architecture.'), 'new cert text must be present')
})

test('a full rewrite keeps run props but collapses mixed formatting into one run', async () => {
  const { xml } = await certDoc()
  assert.ok(xml.includes('<w:b/>'), 'bold run properties must survive (blanked run keeps its props)')
  assert.ok(xml.includes('Delivered SSO and MFA modernization across 40 apps with zero downtime.'), 'new bullet text must be present')
  assert.ok(!xml.includes('Led IAM modernization'), 'old bullet text must be gone')
})

test('dropIdx physically deletes a paragraph and summary overflow is blanked (the eating mechanisms, pinned)', async () => {
  const { xml } = await certDoc()
  assert.ok(xml.includes('Eshwar Janjirala'), 'name paragraph untouched')
  assert.ok(xml.includes('Monitored SIEM alerts daily.'), 'control bullet untouched')
  assert.ok(!xml.includes('Attended weekly meetings.'), 'dropped paragraph must be gone')
  assert.ok(!xml.includes('Additional summary prose from an old run.'), 'summary overflow must be blanked')
  assert.ok(xml.includes('Security engineer, 8 years in SOC and cloud security.'), 'new summary must be present')
})
