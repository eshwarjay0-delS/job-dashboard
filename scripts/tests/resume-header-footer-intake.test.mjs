// Synthetic Word packages only. Exercise the actual WhatsApp extraction entry point.
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { extractText, sameResumeFixedStories } from '../../src/lib/docx.ts'
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
const route = readFileSync(new URL('../../src/app/api/whatsapp/webhook/route.ts', import.meta.url), 'utf8')
const gateSource = route.slice(route.indexOf('async function sameResumeFacts('), route.indexOf('// Same switch as', route.indexOf('async function sameResumeFacts(')))
const sameResumeFacts = vm.runInNewContext(stripTypeScriptTypes(gateSource) + '; sameResumeFacts', {
  extractText, sameResumeFixedStories, sameResumeIdentity: (a, b) => checkRoundTrip(a, b).ok,
  console: { error() {} },
})
test('Mammoth body extraction still omits header; guard supplements it', async () => {
  assert.doesNotMatch(await extractText(await fixture()), /alex@example\.com/)
})
test('actual send gate detects header-only email mutation', async () => {
  assert.equal(await sameResumeFacts(await fixture(), await fixture({ header: 'changed@example.com' })), false)
})
test('actual send gate preserves repeated footer date occurrence', async () => {
  assert.equal(await sameResumeFacts(await fixture(), await fixture({ footer: 'Feb 2020' })), false)
})
test('unchanged package passes actual send gate', async () => {
  assert.equal(await sameResumeFacts(await fixture(), await fixture()), true)
})
test('genuine body employment date mutation remains rejected', async () => {
  assert.equal(await sameResumeFacts(await fixture(), await fixture({ date: 'Feb 2020' })), false)
})
async function changed(edit) {
  const zip = await JSZip.loadAsync(await fixture())
  await edit(zip)
  return zip.generateAsync({ type: 'nodebuffer' })
}
test('header-only name mutation is rejected', async () => {
  assert.equal(await sameResumeFacts(await fixture({ header: 'Alex Example' }), await fixture({ header: 'Another Person' })), false)
})
test('removed header binding with orphaned part is rejected', async () => {
  const b = await changed(async zip => zip.file('word/document.xml', (await zip.file('word/document.xml').async('string')).replace(/<w:headerReference[^>]*\/>/, '')))
  assert.equal(await sameResumeFacts(await fixture(), b), false)
})
test('missing referenced part fails closed', async () => {
  const b = await changed(zip => zip.remove('word/header1.xml'))
  assert.equal(await sameResumeFacts(b, b), false)
})
test('corrupt archive fails closed', async () => {
  assert.equal(await sameResumeFixedStories(Buffer.from('bad'), Buffer.from('bad')), false)
})
test('external story relationship fails closed', async () => {
  const b = await changed(async zip => zip.file('word/_rels/document.xml.rels', (await zip.file('word/_rels/document.xml.rels').async('string')).replace('Target="header1.xml"', 'TargetMode="External" Target="header1.xml"')))
  assert.equal(await sameResumeFixedStories(b, b), false)
})
test('header hyperlink target mutation is rejected', async () => {
  const b = await changed(zip => zip.file('word/_rels/header1.xml.rels', '<Relationships/>'))
  assert.equal(await sameResumeFacts(await fixture(), b), false)
})
test('body-only relationship does not cause a false header failure', async () => {
  const b = await changed(async zip => zip.file('word/_rels/document.xml.rels', (await zip.file('word/_rels/document.xml.rels').async('string')).replace('</Relationships>', '<Relationship Id="link" Type="'+rel+'/hyperlink" Target="https://example.com" TargetMode="External"/></Relationships>')))
  assert.equal(await sameResumeFacts(await fixture(), b), true)
})
test('format-only header changes are conservatively held for review', async () => {
  const b = await changed(async zip => zip.file('word/header1.xml', (await zip.file('word/header1.xml').async('string')).replace('<w:r>', '<w:r><w:rPr><w:b/></w:rPr>')))
  assert.equal(await sameResumeFacts(await fixture(), b), false)
})

test('unresolved binding fails closed even with another valid relationship', async () => {
  const b = await changed(async zip => zip.file('word/document.xml', (await zip.file('word/document.xml').async('string')).replace('r:id="h1"', 'r:id="unknown"')))
  assert.equal(await sameResumeFixedStories(b, b), false)
})
test('XML entity declarations fail closed', async () => {
  const b = await changed(async zip => zip.file('word/header1.xml', '<!DOCTYPE w:hdr>' + await zip.file('word/header1.xml').async('string')))
  assert.equal(await sameResumeFixedStories(b, b), false)
})
test('ZIP recompression alone preserves eligibility', async () => {
  const a = await fixture()
  const z = await JSZip.loadAsync(a)
  assert.equal(await sameResumeFacts(a, await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })), true)
})
test('body prose can change while fixed stories remain intact', async () => {
  const b = await changed(async zip => zip.file('word/document.xml', (await zip.file('word/document.xml').async('string')).replace('<w:sectPr>', para('Built supported services.') + '<w:sectPr>')))
  assert.equal(await sameResumeFacts(await fixture(), b), true)
})
test('custom header part filename is protected through content types', async () => {
  const a = await changed(async zip => {
    zip.file('word/contact.xml', await zip.file('word/header1.xml').async('string'))
    zip.remove('word/header1.xml')
    for (const p of ['[Content_Types].xml', 'word/_rels/document.xml.rels']) zip.file(p, (await zip.file(p).async('string')).replaceAll('header1.xml', 'contact.xml'))
  })
  const z = await JSZip.loadAsync(a)
  z.file('word/contact.xml', (await z.file('word/contact.xml').async('string')).replace('alex@example.com', 'changed@example.com'))
  assert.equal(await sameResumeFacts(a, a), true)
  assert.equal(await sameResumeFacts(a, await z.generateAsync({ type: 'nodebuffer' })), false)
})
