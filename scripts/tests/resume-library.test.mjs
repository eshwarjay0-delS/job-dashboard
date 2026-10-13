// Resumes made over WhatsApp are kept in Files, by kind of job, and the next one is easier (13 Oct 2026).
//
// What went wrong before: every resume the bot made was kept only in a store of its own, "on purpose", so Files never
// showed one; the resume a person sent was forgotten after each job, so it had to be sent again every time; and the bot
// wrote as the deployment's default user, not the account whose Files the person looks at. Asked for: every resume
// saved in a folder named for the kind of job, the resume sent once, the words and lines that come back three or four
// times kept and the rare ones replaced, and PDFs taken in Files beside Word files and zips.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { categoryForJob, tailoredFileName, isTailoredName, recordRun, emptyLibrary, learnedOf, learnedAll, learnedLine, pickBase, validLibrary, saysWord, alike, pointsOf, jobKeyOf, shelfKey, COMMON_AT, MOST_RARE_WORDS, MOST_RARE_POINTS, NO_EMAIL, NO_CATEGORY } from '../../src/lib/resume-library.ts'
import { plainFailure, failureKind } from '../../src/lib/plain-failure.ts'
import { pdfText, isPdf } from '../../src/lib/pdf-text.ts'
import { linksOver, tidyCode, showCode, CODE_MINUTES } from '../../src/lib/whatsapp-link-core.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const SIEM = 'Senior SOC Analyst\nNorthpier Health - Remote\n\nWe need an analyst to run alert triage in Splunk, tune SIEM content, lead incident response and write SOAR playbooks. You will work with the cloud team on AWS logging and with Okta for sign-in data.'
const EMAIL = 'dana@example.com', KIND = 'SIEM and Incident Response'
const run = (n, more = {}) => ({ path: `${EMAIL}/${KIND}/Job ${n} (tailored)__${String(n).padStart(16, '0')}.docx`, email: EMAIL, category: KIND, role: `SOC Analyst ${n}`, company: `Co ${n}`, depth: 1, jd: `${SIEM}\njob number ${n}`, asked: ['splunk', 'siem', 'incident response'], covers: ['splunk', 'siem'], ...more })

test('a job goes in the folder for its kind of work, and its file says what it is for', () => {
  assert.equal(categoryForJob(SIEM), KIND)
  // The title counts for more than words from other kinds of work further down ("AWS logging", "Okta").
  assert.equal(categoryForJob('Cloud Security Engineer\nWe secure AWS: GuardDuty, Security Hub, CloudTrail and AWS Config. Some Splunk.'), 'AWS Security')
  assert.equal(categoryForJob('Office manager\nKeep the diary and order the stationery.'), NO_CATEGORY)
  assert.equal(categoryForJob(''), NO_CATEGORY)

  const name = tailoredFileName({ role: 'Senior SOC Analyst', company: 'Northpier Health' }, 'ab12cd34ef56ab78')
  assert.equal(name, 'Senior SOC Analyst - Northpier Health (tailored)__ab12cd34ef56ab78.docx')
  assert.ok(isTailoredName(name) && isTailoredName('X (tailored)') && isTailoredName('X (tailored).docx'))
  assert.ok(!isTailoredName('Dana Resume__ab12cd34ef56ab78.docx') && !isTailoredName('tailored notes.docx') && !isTailoredName(''))
  // A name can only hold what every system the library is kept on allows; nothing in it can climb out of the folder.
  const odd = tailoredFileName({ role: '../../etc/passwd <script>', company: 'A/B\\C: "D"' }, 'ab12cd34ef56ab78')
  assert.ok(!/[\\/<>:"|?*]/.test(odd) && !odd.startsWith('.') && isTailoredName(odd), odd)
  assert.equal(tailoredFileName({}, 'nope'), 'Resume (tailored)__0000000000000000.docx')
  assert.ok(tailoredFileName({ role: 'R'.repeat(300), company: 'C'.repeat(300) }, 'ab12cd34ef56ab78').length < 140)
})

test('what three jobs of a kind ask for is kept; a job counts once however often its resume is made', () => {
  let lib = emptyLibrary()
  lib = recordRun(lib, run(1), 1000)
  lib = recordRun(lib, run(2, { asked: ['splunk', 'siem', 'qradar'] }), 2000)
  let learned = learnedOf(lib, EMAIL, KIND)
  assert.equal(learned.jobs, 2); assert.equal(learned.files, 2)
  assert.deepEqual(learned.common, [], 'nothing is called common before the third job')
  assert.equal(learnedLine(learned), '')
  // The same job again (the person asked for it twice): no count moves.
  lib = recordRun(lib, run(2, { asked: ['splunk', 'siem', 'qradar'] }), 2500)
  assert.equal(learnedOf(lib, EMAIL, KIND).jobs, 2)
  assert.equal(lib.files.length, 2, 'the same path is one file')
  lib = recordRun(lib, run(3, { asked: ['splunk', 'siem', 'soar'] }), 3000)
  learned = learnedOf(lib, EMAIL, KIND)
  assert.equal(learned.jobs, 3)
  assert.deepEqual(learned.common, [{ word: 'siem', jobs: 3 }, { word: 'splunk', jobs: 3 }])
  assert.deepEqual(learned.recent, ['soar', 'qradar', 'incident response'], 'asked once or twice, newest first')
  assert.equal(learnedLine(learned), `Asked for by ${COMMON_AT} or more of your 3 ${KIND} jobs: siem, splunk`)
  // The library handed in is never changed.
  const before = JSON.stringify(lib); recordRun(lib, run(4), 4000); assert.equal(JSON.stringify(lib), before)
  // Another person's resumes in the same account are a shelf of their own.
  lib = recordRun(lib, run(9, { email: 'sam@example.com', path: 'sam@example.com/x (tailored).docx' }), 5000)
  assert.equal(learnedOf(lib, 'sam@example.com', KIND).jobs, 1); assert.equal(learnedOf(lib, EMAIL, KIND).jobs, 3)
  assert.deepEqual(learnedAll(lib).map(k => k.email), [EMAIL, 'sam@example.com'], 'the kind with the most jobs first')
})

test('the rare ones are replaced by newer ones; the common ones are never pushed out', () => {
  let lib = emptyLibrary()
  for (let n = 1; n <= 3; n++) lib = recordRun(lib, run(n, { asked: ['splunk'] }), n)
  // 70 jobs, each asking for one word nobody else asks for.
  for (let n = 4; n <= 73; n++) lib = recordRun(lib, run(n, { asked: [`rare${n}`] }), n * 10)
  const shelf = lib.shelves[shelfKey(EMAIL, KIND)]
  const rare = Object.keys(shelf.words).filter(w => w.startsWith('rare'))
  assert.equal(rare.length, MOST_RARE_WORDS)
  assert.ok(rare.includes('rare73') && !rare.includes('rare4'), 'the newest stay, the oldest go')
  assert.equal(shelf.words.splunk.n, 3, 'a common word outlives any number of rare ones')
})

test('a line written again for another job is one point with a count; lines seen once make way for newer ones', () => {
  const line = 'Tuned Splunk correlation searches and cut false positive alerts by 40 percent across the SOC queue'
  let lib = emptyLibrary()
  lib = recordRun(lib, run(1, { points: [{ text: line }, { text: 'short' }] }), 1)
  // Reworded a little for the next job: still the same point.
  lib = recordRun(lib, run(2, { points: [{ text: 'Tuned Splunk correlation searches, cutting false positive alerts by 40 percent across the SOC queue' }] }), 2)
  lib = recordRun(lib, run(3, { points: [{ text: line }] }), 3)
  // Made again for job 3: the count does not move.
  lib = recordRun(lib, run(3, { points: [{ text: line }] }), 4)
  let learned = learnedOf(lib, EMAIL, KIND)
  assert.equal(learned.points.length, 1)
  assert.equal(learned.points[0].jobs, 3)
  assert.deepEqual(learned.points[0].words, ['splunk'], 'the point is filed under what the job asked for that it shows')
  for (let n = 10; n < 60; n++) lib = recordRun(lib, run(n, { points: [{ text: `Delivered alpha${n} beta${n} gamma${n} delta${n} epsilon${n} zeta${n} for the estate` }] }), n * 10)
  const shelf = lib.shelves[shelfKey(EMAIL, KIND)]
  assert.equal(shelf.points.filter(p => p.jobs.length < COMMON_AT).length, MOST_RARE_POINTS)
  assert.equal(shelf.points.filter(p => p.jobs.length >= COMMON_AT).length, 1, 'the point three jobs shared is still there')
  assert.ok(alike('Led incident response for ransomware events across four hospitals', 'Led incident response for ransomware events across 4 hospitals'))
  assert.ok(!alike('Led incident response for ransomware events across four hospitals', 'Wrote Terraform modules for the landing zone and its guardrails'))
  assert.deepEqual(pointsOf([{ section: 'Skills', after: 'Splunk, SIEM, SOAR and a great many more things' }, { section: 'Experience', after: '  Led   incident response for the whole estate  ' }, { section: 'Experience (new bullet)', after: 'Wrote SOAR playbooks for phishing triage and containment' }, { section: 'Experience', after: 'tiny' }]).map(p => p.text),
    ['Led incident response for the whole estate', 'Wrote SOAR playbooks for phishing triage and containment'])
})

test('the next job starts from the saved resume that already shows the most of it, and never from a copy of a copy', () => {
  let lib = emptyLibrary()
  lib = recordRun(lib, run(1, { covers: ['splunk'] }), 1)
  lib = recordRun(lib, run(2, { covers: ['splunk', 'siem', 'incident response'] }), 2)
  // Made from a saved resume: it is kept, but nothing is started from it.
  lib = recordRun(lib, run(3, { depth: 2, covers: ['splunk', 'siem', 'incident response'], asked: ['splunk', 'siem', 'incident response', 'soar'] }), 3)
  lib = recordRun(lib, run(4, { email: 'sam@example.com', path: 'sam@example.com/a (tailored).docx' }), 4)
  lib = recordRun(lib, run(5, { category: 'AWS Security', path: `${EMAIL}/AWS Security/a (tailored).docx` }), 5)
  const pick = pickBase(lib, { email: EMAIL, category: KIND, asked: ['Splunk', 'SIEM', 'SOAR', 'incident response'] })
  assert.equal(pick.file.role, 'SOC Analyst 2'); assert.equal(pick.shows, 3); assert.equal(pick.of, 4)
  assert.equal(pickBase(lib, { email: EMAIL, category: 'GRC and IT Risk', asked: ['audit'] }), null)
  assert.equal(pickBase(lib, { email: 'nobody@example.com', category: KIND, asked: ['splunk'] }), null, 'another person\'s resume is never the start')
  // A change the person asked for takes the place of the file it changed, and the job is not counted again.
  const changed = recordRun(lib, run(2, { path: `${EMAIL}/${KIND}/Job 2 (tailored)__ffffffffffffffff.docx`, replaces: run(2).path }), 9)
  assert.ok(!changed.files.some(f => f.path === run(2).path) && changed.files.some(f => f.path.includes('ffffffffffffffff')))
  assert.equal(changed.files.length, lib.files.length)
  assert.equal(learnedOf(changed, EMAIL, KIND).jobs, learnedOf(lib, EMAIL, KIND).jobs)
})

test('a record read back from storage cannot point outside the library', () => {
  const dirty = { version: 1, files: [{ path: '../other/secret.docx', email: EMAIL, category: KIND }, { path: 'C:\\Windows\\x.docx' }, { path: '/etc/passwd' }, { path: `${EMAIL}/${KIND}/ok (tailored).docx`, email: EMAIL, category: KIND, depth: 7, covers: ['Splunk', 5, null] }, null, 'x'], shelves: { junk: null, a: { email: EMAIL, category: KIND, jobs: ['j', 4], words: { Splunk: { n: 3, last: 1 }, bad: { n: 'x' }, ['w'.repeat(99)]: { n: 2 } }, points: [{ text: 'A real point about Splunk content tuning', jobs: ['j'], words: ['splunk'] }, { text: '' }, null] } } }
  const lib = validLibrary(dirty)
  assert.deepEqual(lib.files.map(f => f.path), [`${EMAIL}/${KIND}/ok (tailored).docx`])
  assert.equal(lib.files[0].depth, 1); assert.deepEqual(lib.files[0].covers, ['splunk', '5'])
  const shelf = lib.shelves[shelfKey(EMAIL, KIND)]
  assert.deepEqual(Object.keys(shelf.words), ['splunk']); assert.deepEqual(shelf.jobs, ['j']); assert.equal(shelf.points.length, 1)
  for (const junk of [null, undefined, 'text', 5, [], { version: 2 }, { version: 1, files: 'no', shelves: 7 }]) assert.deepEqual(validLibrary(junk), emptyLibrary())
  assert.equal(jobKeyOf('  Senior   SOC Analyst\n'), jobKeyOf('senior soc analyst'))
  assert.notEqual(jobKeyOf('senior soc analyst'), jobKeyOf('senior soc analysts'))
  assert.ok(saysWord('We use C++ and MITRE ATT&CK daily', 'c++') && saysWord('We use C++ and MITRE ATT&CK daily', 'mitre att&ck') && saysWord('SIEM.', 'siem'))
  assert.ok(!saysWord('the robot arm', 'ot') && !saysWord('cisco router', 'isc') && !saysWord('anything', ''))
  assert.equal(shelfKey('', ''), `${NO_EMAIL} / ${NO_CATEGORY}`)
})

test('the bot keeps the resume, saves what it makes in Files, and searches no one else\'s', () => {
  const bot = read('src/app/api/whatsapp/webhook/route.ts')
  // The resume outlives a finished job and a quiet day. Only "forget resume" drops it.
  assert.ok(bot.includes('await saveSession(from, { ...kept(session), lastJd: session.jd })'))
  assert.ok(bot.includes('if (s.updatedAt && Date.now() - s.updatedAt > ttl) return kept(s)'))
  assert.equal((bot.match(/saveSession\(from, \{ seen: session\.seen \}\)/g) || []).length, 1, 'the one place the resume is dropped is "forget resume"')
  assert.ok(bot.indexOf('cmd === "forget resume"') < bot.indexOf('saveSession(from, { seen: session.seen })'))
  // It is kept for this number alone, outside the shared library folder.
  assert.ok(bot.includes('const dest = path.join(BASELINE_DIR, digits(from), safe)'))
  // Every resume sent is also saved in Files while it is being sent, and taken back out if it never reached the person.
  assert.ok(bot.includes('saveTailored({') && bot.includes('if (filed && keep) await forgetTailored(keep.userDir, filed.abs)'))
  assert.ok(bot.includes('const keep: Keep | undefined = who.saves ?'))
  // A changed resume takes the place of the one it changed only after it was really sent; the record a swipe-reply
  // needs is written before the saving in Files is waited for.
  assert.ok(bot.includes('if (keep.replaces && keep.replaces !== filed.abs) await forgetTailored(keep.userDir, keep.replaces)'))
  assert.ok(bot.indexOf('if (kept_) await saveGen(from, wamid,') < bot.indexOf('const filed = await filing\n  // The caption said'))
  // "link building roles ..." is a job description, not a code: only the shape of a code is taken as one.
  const linkShape = /^link[\s:#-]+([A-Za-z0-9]{4}[\s-]?[A-Za-z0-9]{4})$/i
  assert.ok(bot.includes('const linking = typed.match(' + String(linkShape) + ')'))
  assert.ok(linkShape.test('link K7QM-2XHD') && linkShape.test('LINK k7qm2xhd') && linkShape.test('link: K7QM 2XHD'))
  assert.ok(!linkShape.test('link building job') && !linkShape.test('linkedin K7QM-2XHD') && !linkShape.test('link K7QM-2XHD please') && !linkShape.test('link'))
  // A job description alone is enough once a resume is held; with none, only an account of the number's own is searched.
  assert.ok(bot.includes('if (who.own && (await listFiles(userDirOf(userId))'))
  assert.ok(bot.includes('return who.own ? { dir: userDir, depth: 1, said: "the closest resume in your Files" } : null'))
  assert.ok(bot.includes('if (pick && pick.shows > 0) {') && bot.includes('depth: 2, from: pick.file.path'))
  // The number that joined itself with a code is asked first; the shared default is never "own".
  assert.ok(bot.indexOf('const linked = await linkedUserId(from)') < bot.indexOf('const owner = ownerWhatsAppUserId(from, FALLBACK_USER_ID)'))
  assert.ok(bot.includes('return required ? null : who(FALLBACK_USER_ID, false)'))
  // A PDF is kept, never tailored.
  assert.ok(bot.includes('saveUpload({ userDir: userDirOf(userId), bytes, filename, kind: "pdf" })'))
  // The tidy-up of Files leaves the resumes made for jobs alone (it keeps two per kind and removes the rest).
  assert.ok(read('src/app/api/resumes/organize/route.ts').includes('p.toLowerCase().endsWith(".docx") && !isTailoredName(path.basename(p))'))
})

test('a number joins an account with a code that works once, for fifteen minutes, five tries an hour', async () => {
  const kept = new Map()
  const store = { getText: async (k) => (kept.has(k) ? kept.get(k) : null), put: async (k, v) => { kept.set(k, String(v)) }, delete: async (k) => { kept.delete(k) } }
  const links = linksOver(store)
  const { code, expiresAt } = await links.newLinkCode('user-a')
  assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/, 'eight characters, none of them one that is misread')
  assert.ok(Math.abs(expiresAt - Date.now() - CODE_MINUTES * 60_000) < 5000)
  assert.equal(showCode(code).length, 9); assert.equal(tidyCode(showCode(code).toLowerCase().replace('-', ' ')), code)
  assert.equal(tidyCode('K7QM-2XH'), ''); assert.equal(tidyCode('K7QM-2XH0'), '', 'a zero is not in a code'); assert.equal(tidyCode(''), '')

  assert.deepEqual(await links.claimLinkCode('1 (314) 555-0100', 'WRONGCDE'), { ok: false, why: 'bad_code' })
  assert.equal(await links.linkedUserId('13145550100'), null)
  assert.deepEqual(await links.claimLinkCode('+1 314 555 0100', showCode(code)), { ok: true, userId: 'user-a' })
  assert.equal(await links.linkedUserId('13145550100'), 'user-a')
  assert.deepEqual((await links.linkedNumbers('user-a')).map(n => n.ending), ['0100'], 'shown by its last four digits only')
  // Used up: the same code joins nobody else.
  assert.deepEqual(await links.claimLinkCode('442071234567', showCode(code)), { ok: false, why: 'bad_code' })
  assert.equal(await links.linkedUserId('442071234567'), null)
  // A new code stops the one before it; a code that has run out joins nobody.
  const first = await links.newLinkCode('user-b'), second = await links.newLinkCode('user-b')
  assert.deepEqual(await links.claimLinkCode('442071234567', first.code), { ok: false, why: 'bad_code' })
  assert.deepEqual(await links.claimLinkCode('442071234567', second.code, Date.now() + (CODE_MINUTES + 1) * 60_000), { ok: false, why: 'bad_code' })
  // Five wrong codes in an hour and the number is not checked again, even with a right one.
  const third = await links.newLinkCode('user-b')
  for (let i = 0; i < 2; i++) await links.claimLinkCode('442071234567', 'AAAAAAAA')
  assert.deepEqual(await links.claimLinkCode('442071234567', third.code), { ok: false, why: 'too_many' })
  assert.equal(await links.linkedUserId('442071234567'), null)
  // An hour on, it is checked again.
  assert.deepEqual(await links.claimLinkCode('442071234567', third.code, Date.now() + 61 * 60_000), { ok: false, why: 'bad_code' }, 'and by then the code has run out')
  // A number moves to the account it joins last; the first account no longer lists it.
  const move = await links.newLinkCode('user-b')
  assert.deepEqual(await links.claimLinkCode('13145550100', move.code), { ok: true, userId: 'user-b' })
  assert.equal(await links.linkedUserId('13145550100'), 'user-b')
  assert.deepEqual(await links.linkedNumbers('user-a'), [])
  assert.equal(await links.unlinkAll('user-b'), 1)
  assert.equal(await links.linkedUserId('13145550100'), null)
  // Nothing kept names a full phone number in a place a page can read: the page is given endings only.
  const page = read('src/app/api/whatsapp/link/route.ts')
  assert.ok(page.includes('numbers: await linkedNumbers(userId)') && !page.includes('.digits'))
})

// A small real PDF made by hand (one page, plain text), so the test needs no file and no tool.
function makePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c)
  const stream = ['BT', '/F1 11 Tf', '72 740 Td', '14 TL', ...lines.map((l) => `(${esc(l)}) Tj T*`), 'ET'].join('\n')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']
  let out = '%PDF-1.4\n'
  const at = []
  objects.forEach((body, i) => { at.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n` })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + at.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

test('Files takes PDFs: their words are read to file them, and a PDF is never handed to anything that edits a resume', async () => {
  const pdf = makePdf(['Dana Whitfield', 'dana.whitfield@example.com | 555-0100', 'Senior SOC Analyst', 'Splunk, SIEM, incident response, threat hunting'])
  assert.ok(isPdf(pdf))
  const text = await pdfText(pdf)
  assert.match(text, /dana\.whitfield@example\.com/); assert.match(text, /Splunk, SIEM, incident response/)
  // Not a PDF, whatever it is called: no words, no error.
  assert.ok(!isPdf(Buffer.from('PK\u0003\u0004 a word file')) && !isPdf(null) && !isPdf(Buffer.alloc(0)))
  assert.equal(await pdfText(Buffer.from('hello')), '')
  // A broken PDF is kept and filed by its name: reading it gives no words and does not throw.
  assert.equal(await pdfText(Buffer.from('%PDF-1.4\nnot really a pdf at all')), '')

  const upload = read('src/app/api/resumes/route.ts'), page = read('src/app/dashboard/documents/page.tsx'), client = read('src/app/dashboard/documents/DocumentsClient.tsx'), download = read('src/app/api/resumes/download/route.ts'), auth = read('src/lib/authBoundary.ts')
  assert.ok(upload.includes('if (file.name.toLowerCase().endsWith(".pdf")) {') && upload.includes('if (!isPdf(bytes)) return NextResponse.json({ error: "That file is named as a PDF but is not one." }, { status: 400 })'))
  assert.ok(upload.includes('const isPdfEntry = base.toLowerCase().endsWith(".pdf")'), 'a PDF inside a zip is taken too')
  // The list other pages pick a resume to tailor from is still Word files only.
  assert.ok(upload.includes('f => f.toLowerCase().endsWith(".docx") && path.basename(f) !== "_keywords.json"'))
  assert.ok(page.includes('base.toLowerCase().endsWith(".pdf") ? "pdf" : null'))
  assert.ok(client.includes('accept=".docx,.pdf,.zip,') && client.includes('/\\.(docx|pdf|zip)$/i.test(f.name)'))
  assert.ok(download.includes('ownedResumePath(USER_RESUMES_BASE, userId, filepath) ?? ownedPdfPath(USER_RESUMES_BASE, userId, filepath)'))
  assert.ok(download.includes('pdf ? "application/pdf" :'))
  // The check that guards every resume edit still answers only for a Word file.
  assert.ok(auth.includes('resolved.toLowerCase().endsWith(".docx") ? resolved : null') && auth.includes('resolved.toLowerCase().endsWith(".pdf") ? resolved : null'))
  assert.equal(JSON.parse(read('package.json')).dependencies.unpdf, '1.8.1')
})

test('a failure is told in one plain sentence: the reason, and nothing of the machinery', () => {
  const groq = new Error('Groq API 429: {"error":{"message":"Rate limit reached for model `llama-3.3-70b-versatile` in organization `org_01abc` on tokens per day (TPD): Limit 100000, Used 99874","type":"tokens","code":"rate_limit_exceeded"}}')
  assert.equal(failureKind(groq), 'busy')
  const said = plainFailure(groq)
  assert.equal(said, 'I could not answer just now: the AI service is at its limit for the moment. Nothing was changed. Try again in a few minutes.')
  for (const leak of ['Groq', '429', 'org_', 'llama', 'TPD', '{', 'rate_limit', 'Error']) assert.ok(!said.includes(leak), leak)
  assert.equal(failureKind(new Error('No API key configured. Add a Claude, OpenRouter, or Gemini key in Settings.')), 'not_set_up')
  assert.equal(failureKind(new Error('OpenAI API 401: {"error":{"message":"Incorrect API key provided: sk-proj-abc"}}')), 'not_set_up')
  assert.ok(!plainFailure(new Error('OpenAI API 401: Incorrect API key provided: sk-proj-abc')).includes('sk-'))
  assert.equal(failureKind(new Error('The operation was aborted due to timeout')), 'slow')
  assert.equal(failureKind(new TypeError('fetch failed')), 'unreachable')
  assert.equal(failureKind(new Error('Anthropic API 529: overloaded')), 'busy')
  assert.equal(failureKind('something nobody planned for'), 'other'); assert.equal(failureKind(undefined), 'other')
  // After something was already done, it is not said that nothing changed.
  assert.equal(plainFailure(groq, 'finish that', true), 'I could not finish that just now: the AI service is at its limit for the moment. Try again in a few minutes.')
  assert.equal(plainFailure(null, 'do that'), 'I could not do that this time. Nothing was changed. Try again in a moment.')

  const chat = read('src/app/api/agent/chat/route.ts'), bot = read('src/app/api/whatsapp/webhook/route.ts')
  assert.ok(chat.includes('return NextResponse.json({ error: plainFailure(err, "answer", acted), reason: failureKind(err) }, { status: 500 })'))
  assert.ok(!chat.includes('The agent hit an error') && !chat.includes('const safe = raw'), 'the raw text of a failure is not sent to the chat')
  assert.ok(chat.includes('console.error("agent/chat error:", err)'), 'it is still written to the server log')
  assert.ok(chat.includes('WHEN A TOOL FAILS: tell him in one plain sentence'))
  assert.ok(!bot.includes('Something went wrong: ${String(e)') && bot.includes('await sendText(from, plainFailure(e, "do that", true))'))
})
