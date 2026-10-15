import { test } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import { RESUME_FORMATS, FORMAT_STYLES, renderResumeHtml, renderResumeDocx, resumeLines } from '../../src/lib/resume-formatting.ts'
const sample = 'Alex Morgan\nalex@example.com | (555) 010-2048\nEXPERIENCE:\nEngineer | Northstar | 2020–Present\n• Shipped A & B <secure> services.\n• Cut latency by 35%.\nEDUCATION\nB.S. Computer Science'
test('each template has distinct HTML and Word formatting, preserving career facts', async () => {
  const htmls = new Set(), documents = new Set()
  for (const t of RESUME_FORMATS) {
    const style = FORMAT_STYLES[t.id]
    const html = renderResumeHtml(sample, t.id)
    htmls.add(html.match(/<style>([\s\S]*?)<\/style>/)[1])
    assert.ok(html.includes('A &amp; B &lt;secure&gt; services.'))
    assert.ok(html.includes(`padding:${style.margin}in`))
    const buffer = await renderResumeDocx(sample, t.id)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml').async('string')
    documents.add(xml)
    assert.ok(xml.includes(`w:ascii="${style.font}"`))
    assert.ok(xml.includes(`w:top="${Math.round(style.margin * 1440)}"`))
    assert.ok(xml.includes('<w:keepNext/>'))
    assert.equal(xml.includes('<w:numPr>'), style.bullets)
    const extracted = (await mammoth.extractRawText({ buffer })).value
    for (const fact of ['Alex Morgan','alex@example.com','Shipped A & B <secure> services.','Cut latency by 35%.','B.S. Computer Science']) assert.ok(extracted.includes(fact), `${t.id}: ${fact}`)
  }
  assert.equal(htmls.size, RESUME_FORMATS.length)
  assert.equal(documents.size, RESUME_FORMATS.length)
})
test('long resumes are not silently truncated', async () => {
  const text = ['Alex Morgan','EXPERIENCE',...Array.from({ length: 500 }, (_, i) => `• Achievement ${i}`)].join('\n')
  assert.equal(resumeLines(text).length, 502)
  assert.ok(renderResumeHtml(text, 'jakes').includes('Achievement 499'))
  const extracted = await mammoth.extractRawText({ buffer: await renderResumeDocx(text, 'jakes') })
  assert.ok(extracted.value.includes('Achievement 499'))
})
test('untrusted resume markup is escaped, including headings and contact text', () => {
  const html = renderResumeHtml('<script>alert(1)</script>\na@b.com <img src=x onerror=alert(1)>\nSkills:\nJavaScript', 'mit')
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('<h2 class="heading">Skills</h2>'))
})
