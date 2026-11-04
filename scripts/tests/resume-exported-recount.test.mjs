// Real-metrics recount (Nov 4): the caption's numbers must be measured on the
// exported file's bytes, never on in-memory tailored text alone.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import JSZip from 'jszip'
import { recountExported } from '../../src/lib/resume-exported-recount.ts'
import { docxText } from '../../src/lib/resume-round-trip-guard.ts'

const require = createRequire(import.meta.url)
const module = { exports: {} }
const source = readFileSync(new URL('../../src/lib/keywords.ts', import.meta.url), 'utf8')
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  module, exports: module.exports, process, console,
  require: id => id === 'path' || id === 'crypto' ? require(id) : {},
})
const { coveredJdKeywords } = module.exports

async function docxWith(paragraphs) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  const body = paragraphs.map(p => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}

test('recount keeps full coverage when the file contains every term', () => {
  const r = recountExported({ scoreKws: ['siem', 'zero trust'], attainableKws: ['siem'], exportedCovered: new Set(['siem', 'zero trust']), placed: ['Zero Trust'], writer: [], summary: [] })
  assert.equal(r.coverage, 100)
  assert.equal(r.supportedCoverage, 100)
  assert.deepEqual(r.placed, ['Zero Trust'])
  assert.deepEqual(r.missing, [])
})

test('recount drops a term the file does not contain from every number and list', () => {
  const r = recountExported({ scoreKws: ['siem', 'zero trust', 'palo alto'], attainableKws: ['siem', 'zero trust'], exportedCovered: new Set(['siem', 'zero trust']), placed: ['SIEM', 'Palo Alto'], writer: ['Zero Trust'], summary: [] })
  assert.equal(r.coverage, 66.6)
  assert.equal(r.supportedCoverage, 100)
  assert.deepEqual(r.missing, ['palo alto'])
  assert.deepEqual(r.placed, ['SIEM'])
  assert.deepEqual(r.writer, ['Zero Trust'])
})

test('recount matches placed terms modulo case and tolerates an empty target', () => {
  const r = recountExported({ scoreKws: ['siem'], attainableKws: [], exportedCovered: new Set(['siem']), placed: ['SIEM'], writer: [], summary: [] })
  assert.deepEqual(r.placed, ['SIEM'])
  const empty = recountExported({ scoreKws: [], attainableKws: [], exportedCovered: new Set(), placed: [], writer: [], summary: [] })
  assert.equal(empty.coverage, 0)
  assert.equal(empty.supportedCoverage, 0)
})

test('a real exported docx recounts from its own bytes, not the tailor text', async () => {
  const buffer = await docxWith(['Senior Security Engineer', 'Experience with SIEM and Zero Trust.', 'Skills: SIEM, Zero Trust'])
  const exportedText = (await docxText(buffer)).replace(/\s+/g, ' ')
  const exportedCovered = coveredJdKeywords(exportedText, ['siem', 'zero trust', 'palo alto'])
  const r = recountExported({ scoreKws: ['siem', 'zero trust', 'palo alto'], attainableKws: ['siem'], exportedCovered, placed: ['SIEM', 'Palo Alto'], writer: ['Zero Trust'], summary: [] })
  assert.equal(r.coverage, 66.6)
  assert.deepEqual(r.missing, ['palo alto'])
  assert.deepEqual(r.placed, ['SIEM'])
  assert.deepEqual(r.writer, ['Zero Trust'])
})

test('a term wrapped across lines in the document still counts after collapse', async () => {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Experience with Zero</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>Trust and SIEM.</w:t></w:r></w:p></w:body></w:document>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const exportedText = (await docxText(buffer)).replace(/\s+/g, ' ')
  const exportedCovered = coveredJdKeywords(exportedText, ['zero trust', 'siem'])
  assert.ok(exportedCovered.has('zero trust'), 'wrapped term matched')
  assert.ok(exportedCovered.has('siem'), 'plain term matched')
})

test('enrichment splits suggested terms into placed and gate-blocked', () => {
  const r = recountExported({ scoreKws: ['siem'], attainableKws: ['siem'], exportedCovered: new Set(['siem']), placed: [], writer: [], summary: [], enrichmentSuggested: ['siem', 'zero trust', 'palo alto'], enrichmentCovered: new Set(['siem']) })
  assert.deepEqual(r.enrichment?.placed, ['siem'])
  assert.deepEqual(r.enrichment?.blocked, ['zero trust', 'palo alto'])
})

test('enrichment matching is case-insensitive and keeps the suggested spelling', () => {
  const r = recountExported({ scoreKws: [], attainableKws: [], exportedCovered: new Set(), placed: [], writer: [], summary: [], enrichmentSuggested: ['SIEM'], enrichmentCovered: new Set(['siem']) })
  assert.deepEqual(r.enrichment?.placed, ['SIEM'])
  assert.deepEqual(r.enrichment?.blocked, [])
})

test('no enrichment field when no suggestions were supplied', () => {
  const r = recountExported({ scoreKws: ['siem'], attainableKws: [], exportedCovered: new Set(['siem']), placed: [], writer: [], summary: [] })
  assert.equal(r.enrichment, undefined)
})

test('enrichment on a real exported docx follows the file, not the suggestion list', async () => {
  const buffer = await docxWith(['Senior Security Engineer', 'Experience with SIEM.', 'Skills: SIEM'])
  const exportedText = (await docxText(buffer)).replace(/\s+/g, ' ')
  const r = recountExported({ scoreKws: ['siem'], attainableKws: ['siem'], exportedCovered: coveredJdKeywords(exportedText, ['siem']), placed: [], writer: [], summary: [], enrichmentSuggested: ['siem', 'palo alto'], enrichmentCovered: coveredJdKeywords(exportedText, ['siem', 'palo alto']) })
  assert.deepEqual(r.enrichment?.placed, ['siem'])
  assert.deepEqual(r.enrichment?.blocked, ['palo alto'])
})
