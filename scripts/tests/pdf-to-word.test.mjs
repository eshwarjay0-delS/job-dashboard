// A resume sent as a PDF can be tailored: a Word copy is made from its words (13 Oct 2026).
//
// What went wrong: PDFs were added to the Files page only. The My Resume page still refused a PDF in its upload box
// ("Upload a .docx resume or a .zip of resumes"), did not list PDFs in its My files tab (it has its own listing, Word
// files only), and a PDF could not be fitted to a job anywhere. The owner, on finding it: "PDF? format in resumes? and
// myfiles library???". Tailoring edits a Word file in place, so a PDF gets a Word copy made from its words.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { unwrapPdfLines, wordFromPdf, wordCount, copyName, FEWEST_WORDS, COPY_FORMAT } from '../../src/lib/pdf-to-word.ts'
import { extractZones, extractText } from '../../src/lib/docx.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const DOT = String.fromCharCode(0x2022)

// A small real PDF made by hand (one page, plain text). Byte 0x95 is the bullet in the encoding the page names.
function makePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c)
  const stream = ['BT', '/F1 10 Tf', '54 750 Td', '13 TL', ...lines.map((l) => `(${esc(l)}) Tj T*`), 'ET'].join('\n')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']
  let out = '%PDF-1.4\n'
  const at = []
  objects.forEach((body, i) => { at.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n` })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + at.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
const B = String.fromCharCode(0x95) + ' '
// The page as a PDF holds it: each bullet broken where the line ran out.
const PAGE = [
  'Dana Whitfield',
  'Senior SOC Analyst',
  'dana.whitfield@example.com | (314) 555-0100 | Saint Louis, MO',
  'SUMMARY',
  'Security analyst with eight years in security operations, incident response and detection',
  'engineering across healthcare and banking.',
  'SKILLS',
  'SIEM: Splunk, QRadar, Sentinel',
  'EXPERIENCE',
  'Senior SOC Analyst | Northpier Health | Jan 2021 - Present',
  B + 'Ran alert triage in Splunk for a 24x7 SOC and led incident response on phishing and',
  'ransomware cases across four hospitals',
  B + 'Tuned SIEM content against MITRE ATT&CK and cut false positive alerts by 40 percent in',
  'Splunk Enterprise Security.',
  'SOC Analyst | Brightline Bank | Jun 2017 - Dec 2020',
  B + 'Wrote SOAR playbooks for phishing triage and containment',
  B + 'Used CrowdStrike EDR to investigate endpoint alerts',
  'EDUCATION',
  'B.S. Computer Science, Missouri State University, 2016',
]

test('lines a PDF broke in the middle of a sentence are put back together, and nothing else is joined', () => {
  const text = unwrapPdfLines(PAGE.map(l => l.replace(B, DOT + ' ')).join('\n'))
  const lines = text.split('\n')
  assert.ok(lines.includes(DOT + ' Ran alert triage in Splunk for a 24x7 SOC and led incident response on phishing and ransomware cases across four hospitals'))
  // The second half starts with a capital ("Splunk"): it is joined because the line before ran to the full width and did not end.
  assert.ok(lines.includes(DOT + ' Tuned SIEM content against MITRE ATT&CK and cut false positive alerts by 40 percent in Splunk Enterprise Security.'))
  assert.ok(lines.includes('Security analyst with eight years in security operations, incident response and detection engineering across healthcare and banking.'))
  // A title, a line with its dates, and a new bullet always start anew, even after a line that did not end its sentence.
  for (const own of ['SUMMARY', 'SKILLS', 'EXPERIENCE', 'EDUCATION', 'Senior SOC Analyst | Northpier Health | Jan 2021 - Present', 'SOC Analyst | Brightline Bank | Jun 2017 - Dec 2020', DOT + ' Wrote SOAR playbooks for phishing triage and containment', DOT + ' Used CrowdStrike EDR to investigate endpoint alerts', 'Dana Whitfield', 'Senior SOC Analyst']) assert.ok(lines.includes(own), own)
  assert.equal(lines.length, 16)
  // No word is added, dropped or moved.
  const words = (s) => s.replace(/\s+/g, ' ').trim()
  assert.equal(words(text), words(PAGE.map(l => l.replace(B, DOT + ' ')).join(' ')))
  // A bullet mark printed on a line of its own belongs to the words after it; other marks are read as a bullet.
  assert.equal(unwrapPdfLines(`${DOT}\nLed the migration\n${String.fromCharCode(0x25aa)} Second point\n${String.fromCharCode(0xf0b7)}Third point`), `${DOT} Led the migration\n${DOT} Second point\n${DOT} Third point`)
  // A word broken with a hyphen at the end of a line is one word again.
  assert.equal(unwrapPdfLines(`${DOT} Built the infra-\nstructure for logging`), `${DOT} Built the infra-structure for logging`)
  assert.equal(unwrapPdfLines(''), ''); assert.equal(unwrapPdfLines(' \n \n'), '')
})

test('the Word copy made from a PDF reads back as a resume that can be tailored, with the same words', async () => {
  const made = await wordFromPdf(makePdf(PAGE))
  assert.ok(made && made.docx.length > 1000)
  assert.ok(wordCount(made.text) >= FEWEST_WORDS, String(wordCount(made.text)))
  const zones = await extractZones(made.docx)
  assert.equal(zones.header.name, 'Dana Whitfield'); assert.equal(zones.header.title, 'Senior SOC Analyst')
  assert.match(zones.summaryText, /^Security analyst with eight years .* healthcare and banking\.$/)
  assert.equal(zones.roles.length, 2)
  assert.deepEqual(zones.roles.map(r => r.bullets.length), [2, 2], 'each bullet is one bullet again, not two half lines')
  assert.equal(zones.roles[0].bullets[0].text, 'Ran alert triage in Splunk for a 24x7 SOC and led incident response on phishing and ransomware cases across four hospitals')
  assert.ok(zones.skills.some(s => /Splunk, QRadar, Sentinel/.test(s.text)))
  // Every word of the page is in the copy, in the same order. (The layout sets a line's dates at the right edge, so the
  // bar or comma that stood before them is not printed: words are compared, not punctuation.)
  const flat = (s) => (s.toLowerCase().match(/[a-z0-9]+/g) || []).join(' ')
  assert.equal(flat(await extractText(made.docx)), flat(PAGE.map(l => l.replace(B, '')).join(' ')))
  assert.equal(COPY_FORMAT, 'careeronestop')
})

test('a PDF whose words cannot be read gets no copy, and says so instead of handing over an empty resume', async () => {
  assert.equal(await wordFromPdf(makePdf(['Dana Whitfield', 'A cover page and nothing else'])), null, 'too few words to be a resume that was read')
  assert.equal(await wordFromPdf(Buffer.from('%PDF-1.4 broken')), null)
  assert.equal(await wordFromPdf(Buffer.from('not a pdf')), null)
  assert.equal(copyName('Dana Resume.pdf'), 'Dana Resume (from PDF).docx')
  assert.equal(copyName('Dana Resume (from PDF).PDF'), 'Dana Resume (from PDF).docx', 'made twice, it is still named once')
  assert.equal(wordCount('C++ and MITRE ATT&CK, 24x7'), 5)
})

test('every place a resume is taken now takes a PDF, and the Word copy is what is offered for tailoring', () => {
  const upload = read('src/app/api/resumes/route.ts'), hub = read('src/app/dashboard/resume/ResumeClient.tsx'), hubPage = read('src/app/dashboard/resume/page.tsx'), files = read('src/app/dashboard/documents/DocumentsClient.tsx'), bot = read('src/app/api/whatsapp/webhook/route.ts'), setup = read('src/app/api/onboarding/resume/route.ts')
  // The upload answers with the copy as `file` (what a page selects to tailor) and the PDF beside it.
  assert.ok(upload.includes('return NextResponse.json({ file: wordEntry, pdfFile: entry, pdf: true, converted: true, read: true, already: kept.existed })'))
  assert.ok(upload.includes('return NextResponse.json({ file: entry, pdf: true, converted: false, read: kept.read, already: kept.existed })'))
  assert.ok(upload.includes('if (word) await saveUpload({ userDir: user.dir, bytes: word.docx, filename: copyName(base), kind: "docx" })'), 'a PDF inside a zip gets its copy too')
  // The My Resume page: its upload box takes a PDF, says what was made, and never offers an unreadable PDF for tailoring.
  assert.ok(hub.includes('accept=".docx,.pdf,.zip"') && hub.includes('/\\.(docx|pdf|zip)$/i.test(f.name)'))
  assert.ok(!hub.includes('Upload a .docx resume or a .zip of resumes.'))
  assert.ok(hub.includes('} else if (res.ok && data.pdf && !data.converted) {'))
  assert.ok(hub.includes('same words, a plain layout. Read it once before you send it anywhere.'))
  // Its My files tab lists the PDFs; the list offered for tailoring is still Word files only.
  assert.ok(read('src/lib/resume-library-scan.ts').includes('base.toLowerCase().endsWith(".pdf") ? "pdf" : null'))
  assert.ok(hubPage.includes('const docx = files.filter(f => f.kind === "docx")') && hubPage.includes('f.kind === "pdf")'))
  assert.ok(hubPage.includes('<ResumeClient initialFiles={docx} initialFolders={folders} otherFiles={pdfs} />'))
  assert.ok(hub.includes('initialFiles={[...initialFiles, ...otherFiles]}'))
  assert.ok(files.includes('A PDF is kept as it is, and a Word copy is made from its words so it can be tailored.'))
  // The WhatsApp bot takes a sent resume as DOCX only, while web setup still supports PDF. Since 19 Oct 2026 it files what
  // it makes in Files again (saveTailored), starting from the person's library.
  assert.ok(bot.includes('I can only read *.docx* resumes. Please export from Word and resend.'))
  assert.ok(!bot.includes('wordFromPdf(') && bot.includes('saveTailored('))
  assert.ok(setup.includes('if (word) { await saveUpload({ userDir, bytes: word.docx, filename: copyName(file.name), kind: "docx" }); tailorable = true }'))
})
