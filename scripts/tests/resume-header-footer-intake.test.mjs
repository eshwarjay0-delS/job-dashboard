// Synthetic Word packages only. Exercise the actual WhatsApp extraction entry point.
import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { extractText } from '../../src/lib/docx.ts'
import { checkRoundTrip } from '../../src/lib/resume-round-trip-guard.ts'

const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const para = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`
async function fixture({ header = 'alex@example.com', footer = 'Jan 2020', body = 'Alex Example', date = 'Jan 2020' } = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${['document','header1','footer1'].map(p => `<Override PartName="/word/${p}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${p === 'document' ? 'document.main' : p.startsWith('header') ? 'header' : 'footer'}+xml"/>`).join('')}</Types>`)
  zip.file('_rels/.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="${rel}/officeDocument" Target="word/document.xml"/></Relationships>`)
  zip.file('word/_rels/document.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="h1" Type="${rel}/header" Target="header1.xml"/><Relationship Id="f1" Type="${rel}/footer" Target="footer1.xml"/></Relationships>`)
  zip.file('word/document.xml', `<w:document xmlns:w="${ns}" xmlns:r="${rel}"><w:body>${para(body)}${para(`Example Corp ${date} - Present`)}<w:sectPr><w:headerReference w:type="default" r:id="h1"/><w:footerReference w:type="default" r:id="f1"/></w:sectPr></w:body></w:document>`)
  zip.file('word/header1.xml', `<w:hdr xmlns:w="${ns}">${para(header)}</w:hdr>`)
  zip.file('word/footer1.xml', `<w:ftr xmlns:w="${ns}">${para(footer)}</w:ftr>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}
test('actual intake includes protected header contact', async () => {
  assert.match(await extractText(await fixture()), /alex@example\.com/)
})
test('actual intake detects header-only email mutation', async () => {
  const a = await extractText(await fixture())
  const b = await extractText(await fixture({ header: 'changed@example.com' }))
  assert.equal(checkRoundTrip(a, b).ok, false)
})
test('actual intake preserves repeated footer date occurrence', async () => {
  const a = await extractText(await fixture())
  const b = await extractText(await fixture({ footer: 'Feb 2020' }))
  assert.equal(checkRoundTrip(a, b).ok, false)
})
test('unchanged package passes identity guard', async () => {
  const a = await extractText(await fixture())
  assert.equal(checkRoundTrip(a, a).ok, true)
})
test('genuine body employment date mutation remains rejected', async () => {
  const a = await extractText(await fixture())
  const b = await extractText(await fixture({ date: 'Feb 2020' }))
  assert.equal(checkRoundTrip(a, b).ok, false)
})
