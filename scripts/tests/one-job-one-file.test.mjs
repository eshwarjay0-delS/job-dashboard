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

// The 15 Oct 2026 rollback made every WhatsApp job start fresh from a sent resume, kept nothing and replayed nothing. On
// 19 Oct the owner asked for the library again ("it should go to the my file section ... grab that resume, then apply
// those changes ... and do not have a duplicate resumes"): a job starts from the closest resume of the chosen email in
// Files, is filed back there one job one file, and a job made before is sent again. A resume sent with the job still wins.
test('WhatsApp starts from the person\'s Files, files the result there once, and sends a job made before again', () => {
  const bot = read('src/app/api/whatsapp/webhook/route.ts')
  assert.ok(bot.includes('if (!session.jd || !session.resumePath) return sendText(from, HELP)'))
  // A sent resume: the temporary inbox, as before. From Files: the person's own folder.
  assert.ok(bot.includes('userResumeDir: files ? files.userDir : path.join(INBOX_DIR, digits(from))'))
  // Consuming a job clears only what belongs to it: a newer message saved meanwhile is kept (found in review, 19 Oct).
  assert.ok(bot.includes('if (cur.jdId === session.jdId) { delete cur.jd; delete cur.jdId }') && bot.includes('if (cur.resumePath === session.resumePath) { delete cur.resumePath; delete cur.resumeName; delete cur.resumeAt }'))
  assert.ok(bot.includes('await deletePath(session.resumePath).catch(() => {})'))
  assert.ok(bot.includes('const have = await existingForJob(userDir, email, job.jd).catch(() => null)') && bot.includes('if (have) return sendSaved(from, have, job.jd, email, userId)'))
  assert.ok(bot.includes('filed = await saveTailored({ userDir: files.userDir'))
  assert.ok(!bot.includes('resume_documents'), 'the library is Files itself, not a second copy in the database')
  assert.ok(bot.includes('const replyTo = (msg.context as { id?: string } | undefined)?.id'))
  assert.ok(bot.includes('if (replyTo) return refine(from, replyTo, text, userId)'))
})
