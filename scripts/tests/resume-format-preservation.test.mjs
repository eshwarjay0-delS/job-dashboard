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
