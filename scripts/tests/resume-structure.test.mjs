// What a formatted resume looked like before 12 Oct 2026: every template was the person's text as plain paragraphs in a
// different font. A job line kept no weight on the title and its dates sat wherever the line ended, so nothing looked like
// a resume. These hold what the formatter now knows about a line, and that knowing it never costs the person a word.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import { RESUME_FORMATS, renderResumeDocx, renderResumeHtml, resumeBlocks } from '../../src/lib/resume-formatting.ts'

const RESUME = [
  'Jordan Rivera',
  'Senior DevOps Engineer',
  'jordan@example.com | (555) 010-7788 | Seattle, WA',
  'PROFESSIONAL SUMMARY',
  'Engineer who migrated the platform to Kubernetes in 2021 and has run it since.',
  'KEY ACHIEVEMENTS',
  '• Cut deploy time from 40 minutes to 6.',
  'EXPERIENCE',
  'Senior DevOps Engineer | Comcast | Jan 2021 - Present',
  '• Ran 14 clusters across three regions.',
  'Site Reliability Engineer, Northstar Labs, 06/2018 – 12/2020',
  '• Built the on-call rota and its playbooks.',
  'EDUCATION',
  'B.S. Computer Science | State University | 2017',
  'TECHNICAL SKILLS',
  'Languages: Python, Go, Bash',
  'Cloud: AWS, GCP',
  'AWS',
  'CERTIFICATIONS',
  'AWS Certified Developer – Associate | 2024',
].join('\n')
const blocks = resumeBlocks(RESUME)
const at = (text) => blocks.find((b) => b.text === text || b.text.startsWith(text))

test('a job, a degree and a certificate are each read as what it is on the left and when on the right', () => {
  const job = at('Senior DevOps Engineer | Comcast')
  assert.deepEqual([job.kind, job.lead, job.rest, job.when], ['entry', 'Senior DevOps Engineer', ' | Comcast', 'Jan 2021 - Present'])
  const earlier = at('Site Reliability Engineer, Northstar')
  assert.deepEqual([earlier.kind, earlier.lead, earlier.rest, earlier.when], ['entry', 'Site Reliability Engineer', ', Northstar Labs', '06/2018 – 12/2020'])
  assert.deepEqual([at('B.S. Computer Science').kind, at('B.S. Computer Science').when], ['entry', '2017'])
  assert.deepEqual([at('AWS Certified Developer').lead, at('AWS Certified Developer').when], ['AWS Certified Developer – Associate', '2024'], 'a dash inside the title is not taken for the dates')
})

test('a sentence that merely ends in a year stays a sentence', () => {
  assert.equal(at('Engineer who migrated').kind, 'body')
  for (const line of ['Moved every service to the new cluster in 2021', 'Shipped the first release (2022).', 'Team of 12 in 2020.']) {
    assert.equal(resumeBlocks(`Name\nEXPERIENCE\n${line}`)[2].kind, 'body', line)
  }
})

test('everything above the first section title is the person\'s header, and a title in capitals is a title', () => {
  assert.equal(at('Senior DevOps Engineer').kind, 'contact', 'a headline with no email in it is still part of the header')
  assert.equal(at('jordan@example.com').kind, 'contact')
  assert.equal(at('KEY ACHIEVEMENTS').kind, 'heading', 'not in any list of known titles, and still a title')
  assert.equal(at('PROFESSIONAL SUMMARY').kind, 'heading')
  assert.equal(blocks.filter((b) => b.text === 'AWS')[0].kind, 'body', 'one word in capitals is a word, not a section')
})

test('a labelled line under a skills heading carries its label, and nowhere else', () => {
  assert.deepEqual([at('Languages:').kind, at('Languages:').label, at('Languages:').rest], ['skill', 'Languages', 'Python, Go, Bash'])
  assert.equal(at('Cloud:').kind, 'skill')
  assert.equal(resumeBlocks('Name\nEXPERIENCE\nNote: started as a contractor')[2].kind, 'body')
})

test('the page sets the title in weight and the dates at the right edge, in every template', () => {
  for (const t of RESUME_FORMATS) {
    const html = renderResumeHtml(RESUME, t.id)
    assert.ok(html.includes('<div class="entry"><span class="what"><b>Senior DevOps Engineer</b> | Comcast</span><span class="when">Jan 2021 - Present</span></div>'), t.id)
    assert.ok(html.includes('<p class="skill"><b>Languages:</b> Python, Go, Bash</p>'), t.id)
    assert.ok(/\.entry\{display:flex;justify-content:space-between/.test(html) && /\.entry \.when\{flex:none;white-space:nowrap/.test(html), t.id)
  }
})

test('the Word file does the same with a tab stop at the right margin, and loses no word of the resume', async () => {
  // Words, not punctuation: the bar or comma that stood between a title and its dates is what the tab stop replaces.
  const said = RESUME.replace(/[•|,]/g, ' ').split(/\s+/).filter(Boolean)
  for (const t of RESUME_FORMATS) {
    const buffer = await renderResumeDocx(RESUME, t.id)
    const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml').async('string')
    assert.ok(/<w:tabs><w:tab w:val="right" w:pos="\d+"\/><\/w:tabs>/.test(xml), t.id + ': a right tab stop for the dates')
    assert.ok(/<w:b\/>[^<]*<w:color[^>]*\/><w:sz[^>]*\/><\/w:rPr><w:t xml:space="preserve">Senior DevOps Engineer<\/w:t>/.test(xml), t.id + ': the title in weight')
    const read = (await mammoth.extractRawText({ buffer })).value.replace(/,/g, ' ')
    for (const word of said) assert.ok(read.includes(word), `${t.id}: "${word}" is still in the file`)
  }
})

test('nothing typed into a resume can become markup, in an entry or a skill line either', () => {
  const html = renderResumeHtml('Name\nSKILLS\nTools: <img src=x onerror=1>\nEXPERIENCE\n<b>Boss</b> | <script>x</script> | 2020', 'jakes')
  assert.ok(!html.includes('<img') && !html.includes('<script>') && !html.includes('<b>Boss</b>'))
  assert.ok(html.includes('&lt;b&gt;Boss&lt;/b&gt;'))
})
