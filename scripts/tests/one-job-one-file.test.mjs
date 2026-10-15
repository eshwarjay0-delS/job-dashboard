// Never the same job twice. Asked on 13 Oct 2026, with a picture of Files holding one job twice
// ("Security Engineer Application Development - Allied Universal (tailored)", 31.5 KB and 33.8 KB):
//   "We should never and ever get any duplicates like this. Duplicates are really gonna drain our storage ...
//    even in the WhatsApp ... once a JD and resume was given, it was a redo in the same resume and JD one more time ...
//    You already know the outcome from the last time, and why do you keep repeating this stuff"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordRun, emptyLibrary, sameJob, supersededBy, madeFor, duplicatesIn, jobKeyOf, learnedOf } from '../../src/lib/resume-library.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const E = 'dana44@gmail.com', AWS = 'AWS Security', DATA = 'Data Protection and Privacy'
const JD = 'Security Engineer, Application Development\nAllied Universal\nAWS GuardDuty, Security Hub, CloudTrail, IAM, Terraform.'
const run = (hash, more = {}) => ({ path: `${E}/${AWS}/Security Engineer Application Development - Allied Universal (tailored)__${hash}.docx`, email: E, category: AWS, role: 'Security Engineer Application Development', company: 'Allied Universal', depth: 1, jd: JD, asked: ['guardduty', 'terraform'], covers: ['guardduty'], ...more })

test('the same job made a second time takes the place of the first: one job, one file, the newest', () => {
  let lib = recordRun(emptyLibrary(), run('1'.repeat(16)), 100)
  // The picture: the same job again, a different file (the bot ran twice), so a different name under the same title.
  const second = run('2'.repeat(16))
  assert.deepEqual(supersededBy(lib, second), [run('1'.repeat(16)).path])
  lib = recordRun(lib, second, 200)
  assert.deepEqual(lib.files.map(f => f.path), [second.path], 'the folder holds the job once')
  assert.equal(learnedOf(lib, E, AWS).jobs, 1, 'and the job is counted once')
  // The very same file saved again is the same file: nothing is taken out for it.
  assert.deepEqual(supersededBy(lib, second), [])
  // A different job in the same folder is left alone.
  const other = run('3'.repeat(16), { path: `${E}/${AWS}/Cloud Security Engineer - Northpier (tailored)__${'3'.repeat(16)}.docx`, role: 'Cloud Security Engineer', company: 'Northpier', jd: 'Cloud Security Engineer\nNorthpier\nAWS Config, KMS.' })
  lib = recordRun(lib, other, 300)
  assert.equal(lib.files.length, 2)
  // The same job in ANOTHER folder (another email, or another kind of job) is another shelf: not touched.
  assert.deepEqual(supersededBy(lib, { ...second, path: 'x', email: 'someone@else.com' }), [])
  assert.deepEqual(supersededBy(lib, { ...second, path: 'x', category: DATA }), [])
})

test('what counts as the same job: the same job description, or the same role and the same company', () => {
  const file = recordRun(emptyLibrary(), run('1'.repeat(16)), 1).files[0]
  assert.equal(sameJob(file, { key: jobKeyOf(JD) }), true)
  assert.equal(sameJob(file, { key: jobKeyOf(JD.toUpperCase() + '   ') }), true, 'spaces and capitals do not make it another job')
  // Another wording of the job (a second recruiter's copy) with the same role and company: the same job.
  assert.equal(sameJob(file, { key: 'another', role: 'security engineer application development', company: 'ALLIED UNIVERSAL' }), true)
  assert.equal(sameJob(file, { key: 'another', role: 'Security Engineer Application Development', company: 'Someone Else' }), false)
  assert.equal(sameJob(file, { key: 'another', role: 'Security Engineer', company: 'Allied Universal' }), false)
  // A resume that could not be named ("Resume (tailored)") is never matched by its empty name.
  const unnamed = recordRun(emptyLibrary(), run('4'.repeat(16), { role: '', company: '', jd: 'one job description of its own, long enough' }), 1).files[0]
  assert.equal(sameJob(unnamed, { key: 'another', role: '', company: '' }), false)
  assert.equal(sameJob(unnamed, { key: '', role: '', company: '' }), false)
})

test('a job already made is found again by its job description, in one folder', () => {
  let lib = recordRun(emptyLibrary(), run('1'.repeat(16)), 100)
  assert.equal(madeFor(lib, { email: E, category: AWS, jd: JD }).path, run('1'.repeat(16)).path)
  assert.equal(madeFor(lib, { email: E, category: AWS, jd: `  ${JD}\n` }).path, run('1'.repeat(16)).path)
  assert.equal(madeFor(lib, { email: E, category: AWS, jd: 'a job nobody has sent before, with other words' }), null)
  assert.equal(madeFor(lib, { email: 'someone@else.com', category: AWS, jd: JD }), null, 'never another person\'s')
  assert.equal(madeFor(emptyLibrary(), { email: E, category: AWS, jd: JD }), null)
})

test('a folder that already holds a job twice is put right: the newest stays', () => {
  // As it was before the rule: two files for one job, both in the record.
  const first = { ...recordRun(emptyLibrary(), run('1'.repeat(16)), 100).files[0] }
  const second = { ...recordRun(emptyLibrary(), run('2'.repeat(16)), 200).files[0] }
  const third = { ...recordRun(emptyLibrary(), run('5'.repeat(16), { path: `${E}/${AWS}/Other - Co (tailored)__${'5'.repeat(16)}.docx`, role: 'Other', company: 'Co', jd: 'another job entirely, with its own words' }), 150).files[0] }
  const lib = { version: 1, files: [first, third, second], shelves: {} }
  assert.deepEqual(duplicatesIn(lib, E, AWS), [first.path], 'the older of the two goes; the other job is not touched')
  assert.deepEqual(duplicatesIn(lib, E, DATA), [])
  assert.deepEqual(duplicatesIn({ version: 1, files: [second, third], shelves: {} }, E, AWS), [])
})

test('the storage keeps one file a job, sends back what was made, and tidies when Files opens', () => {
  const store = read('src/lib/resume-library-store.ts')
  // Saving: the earlier file of the same job is deleted as the new one goes in (only a file made for a job, only inside this library).
  assert.ok(store.includes('for (const rel of supersededBy(before, run)) {') && store.includes('if (old !== abs && inside(opts.userDir, old) && isTailoredName(path.basename(old))) await deletePath(old)'))
  // Asking "was this made already" is one small read of one folder's record, and the file must still be there.
  assert.ok(store.includes('const file = madeFor(await readShelf(userDir, email_, category), { email: email_, category, jd })') && store.includes('return inside(userDir, abs) && (await existsPath(abs)) ? { abs, file } : null'))
  // Tidying costs nothing when there is nothing to tidy: records are read only for a folder that shows one name twice.
  assert.ok(store.includes('if ((seen.get(shown) || 0) > 1 &&') && store.includes('const gone = duplicatesIn(library, email, category)'))
  assert.ok(store.includes('await removeDuplicates(userDir, now)'))
})

test('the bot never makes the same job twice', () => {
  const bot = read('src/app/api/whatsapp/webhook/route.ts')
  // 1. Made already: sent again from Files. No AI call, nothing saved again.
  assert.ok(bot.includes('const had = await existingForJob(userDir, mail, jd).catch(() => null)') && bot.includes('if ("have" in start) return sendAgain(from, session, who, start.have)'))
  const again = bot.slice(bot.indexOf('async function sendAgain('), bot.indexOf('// ── Tailor + reply ──'))
  assert.ok(again.includes('Nothing was made again.') && !again.includes('runTailor(') && !again.includes('saveTailored('))
  assert.ok(again.includes('saved: have.abs'), 'a reply to the file sent again still changes the one in Files')
  // "redo" is the one word that makes it afresh, from a resume that is not the earlier result of the same job.
  assert.ok(bot.includes('if (choice.redo) return null') && bot.includes('noCache: !!choice.redo,') && bot.includes('choice.redo ? jobKeyOf(jd) : ""'))
  assert.ok(bot.includes('if (cmd === "redo" || cmd === "again" || cmd === "make it again") {'))
  // 2. Never two runs of one job at once: the second is told it is on its way, unless it brings a newer resume.
  assert.ok(bot.includes('if (flight && flight.job === job && Date.now() - flight.at < IN_FLIGHT_MS && !((session.resumeAt || 0) > flight.at)) {'))
  assert.ok(bot.includes('I am already making the resume for this job.'))
  // The run that was overtaken stands down BEFORE it sends or saves.
  const stood = bot.indexOf('if (still && still.job === job && still.token !== mine)'), sent = bot.indexOf('await deliver(from, file, name, captionFor(name, meta, result, undefined')
  assert.ok(stood > 0 && stood < sent)
  // A run that failed lets go, so the same job can be tried again at once.
  assert.ok((bot.match(/await clearFlight\(from, mine\)/g) || []).length >= 4)
  // The session is put away the same way after a new resume and after one sent again.
  assert.ok(bot.includes('await putAway(from, session, !!source.givenPath && source.givenPath === session.resumePath, source.email)') && bot.includes('await putAway(from, session, false, have.email)'))
})
