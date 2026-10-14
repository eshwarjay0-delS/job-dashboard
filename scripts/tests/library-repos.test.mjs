// The library, organised the way it was asked for on 13 Oct 2026 (late):
//   "Both are same!!" (two folders for one person: x@gmail.com and x@gmail.comlinkedin)
//   "Just always only takes the emails. And maintain separate repo with headlines. Not even in the same repo!!"
//   "I need to see separate with email as titles and Organized folders."
//   "Give the preview with view button right next to all resumes."  "we don't need show this [to the] user as well."
//   "Be conventional smart programmer ... dictionaries and relational databases ... Yielding for fastest resume."
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { cleanEmail, resumeEmails } from '../../src/lib/resumeOrganization.ts'
import { recordRun, emptyLibrary, shelfOnly, shelvesIn, mergeLibraries, relabelEmail, learnedOf, shelfKey } from '../../src/lib/resume-library.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const GOOD = 'dana@gmail.com', BAD = 'dana@gmail.comlinkedin', SIEM = 'SIEM and Incident Response', DEVOPS = 'DevOps and Platform Engineering'
const run = (n, email, category, more = {}) => ({ path: `${email}/${category}/Job ${n} (tailored)__${String(n).padStart(16, '0')}.docx`, email, category, role: `Role ${n}`, company: 'Co', depth: 1, jd: `job description number ${n}`, asked: ['splunk', 'siem'], covers: ['splunk'], ...more })

test('an email is the address and nothing else, however the resume runs it into the next word', () => {
  // The line of his own resume: the address straight into "LinkedIn".
  assert.deepEqual(resumeEmails('Dana Whitfield\ndana@gmail.comLinkedIn: linkedin.com/in/dana | 555-0100'), [GOOD])
  assert.equal(cleanEmail('dana@gmail.comlinkedin'), GOOD)
  assert.equal(cleanEmail('Dana@Gmail.COMGitHub'), GOOD)
  // The address straight into a link, dots and all.
  assert.equal(cleanEmail('dana@gmail.comlinkedin.com'), GOOD); assert.deepEqual(resumeEmails('dana@gmail.comlinkedin.com/in/dana-w'), [GOOD])
  assert.equal(cleanEmail('sam@northpier.comwww.northpier.com'), 'sam@northpier.com')
  assert.equal(cleanEmail('sam@northpier.comhttps'), 'sam@northpier.com'); assert.equal(cleanEmail('sam@northpier.iophone'), 'sam@northpier.io')
  assert.equal(cleanEmail('sam@yahoo.co.inmobile'), 'sam@yahoo.co.in'); assert.equal(cleanEmail('sam@outlook.com5550100'), 'sam@outlook.com')
  // A real address is never cut short: its own ending, a company named like a mail service, a long ending.
  for (const real of ['dana@gmail.com', 'sam@northpier.com', 'sam@uni.ac.in', 'sam@acme.community', 'sam@gmail.company.example', 'sam@firm.consulting', 'sam.o-brien+jobs@sub.domain.co.uk']) assert.equal(cleanEmail(real), real, real)
  assert.equal(cleanEmail('not an address'), ''); assert.equal(cleanEmail(''), '')
  // One person, written both ways on one page, is one person.
  assert.deepEqual(resumeEmails('dana@gmail.comLinkedIn and again dana@gmail.com'), [GOOD])
})

test('each folder keeps its own record, and two records join without counting anything twice', () => {
  let lib = emptyLibrary()
  lib = recordRun(lib, run(1, GOOD, SIEM), 10)
  lib = recordRun(lib, run(2, GOOD, SIEM), 20)
  lib = recordRun(lib, run(3, GOOD, DEVOPS, { asked: ['jenkins'], covers: ['jenkins'] }), 30)
  // One folder's part holds that folder's files and what its jobs taught, and nothing of another folder.
  const siem = shelfOnly(lib, GOOD, SIEM)
  assert.deepEqual(siem.files.map(f => f.role), ['Role 1', 'Role 2']); assert.deepEqual(Object.keys(siem.shelves), [shelfKey(GOOD, SIEM)])
  assert.ok(!JSON.stringify(siem).includes('jenkins'))
  assert.deepEqual(shelvesIn(lib).map(([, c]) => c).sort(), [DEVOPS, SIEM])
  assert.deepEqual(shelfOnly(lib, GOOD, 'GRC and IT Risk'), emptyLibrary())
  // The parts put together are the library again.
  const whole = [shelfOnly(lib, GOOD, SIEM), shelfOnly(lib, GOOD, DEVOPS)].reduce(mergeLibraries, emptyLibrary())
  assert.deepEqual(learnedOf(whole, GOOD, SIEM), learnedOf(lib, GOOD, SIEM)); assert.equal(whole.files.length, 3)
  // The same record read twice is not two: a job, a word and a file count once.
  const twice = mergeLibraries(siem, siem)
  assert.equal(learnedOf(twice, GOOD, SIEM).jobs, 2); assert.equal(twice.files.length, 2)
  assert.equal(twice.shelves[shelfKey(GOOD, SIEM)].words.splunk.n, 2)
})

test('a folder named with more than the email is put back under the email, joined to what is there', () => {
  let lib = emptyLibrary()
  lib = recordRun(lib, run(1, GOOD, SIEM), 10)
  lib = recordRun(lib, run(2, BAD, SIEM), 20)
  lib = recordRun(lib, run(3, BAD, DEVOPS, { asked: ['jenkins'], covers: ['jenkins'] }), 30)
  const mended = relabelEmail(lib, BAD, GOOD)
  assert.ok(mended.files.every(f => f.email === GOOD && f.path.startsWith(GOOD + '/')), 'every file, and its path')
  assert.deepEqual(Object.keys(mended.shelves).sort(), [shelfKey(GOOD, DEVOPS), shelfKey(GOOD, SIEM)])
  assert.equal(learnedOf(mended, GOOD, SIEM).jobs, 2, 'the two SIEM folders are one, with both jobs')
  assert.equal(learnedOf(mended, GOOD, SIEM).files, 2)
  assert.equal(mended.shelves[shelfKey(GOOD, SIEM)].words.splunk.n, 2)
  assert.ok(!JSON.stringify(mended).includes('comlinkedin'))
  assert.deepEqual(relabelEmail(lib, GOOD, GOOD), lib); assert.deepEqual(relabelEmail(lib, '', GOOD), lib)
})

test('the storage keeps one record inside each folder, and reads only that one to make or pick a resume', () => {
  const store = read('src/lib/resume-library-store.ts'), bot = read('src/app/api/whatsapp/webhook/route.ts')
  assert.ok(store.includes('path.join(userDir, ...folderFor(email, category), LIBRARY_FILE)'), 'the record is inside its folder')
  assert.ok(store.includes('const before = await readShelf(opts.userDir, email_, category)') && store.includes('await writeShelf(opts.userDir, library, email_, category)'))
  // Picking reads the records of one email's folders, one small read a folder (src/lib/library-pick-store.ts).
  assert.ok(read('src/lib/library-pick-store.ts').includes('const shelf = await readShelf(userDir, top, folder).catch(() => null)'))
  // The first version's single record is split into the folders and removed; a wrongly named folder is mended.
  assert.ok(store.includes('async function splitOldRecord(') && store.includes('await deletePath(old)'))
  assert.ok(store.includes('async function mendEmailFolders(') && store.includes('await movePath(abs, dest)'))
  // Tidying never loses a file: only a true copy is dropped, a different file of the same name is kept beside it.
  assert.ok(store.includes('else if (await sameBytes(abs, dest)) await deletePath(abs)') && store.includes('else await movePath(abs, await freeName(dest))'))
  // An email the bot remembered from before is cleaned the same way.
  assert.ok(bot.includes('else if (session.resumeEmail) session.resumeEmail = cleanEmail(session.resumeEmail)'))
  // Both pages list the library with one scanner (14 Oct 2026), which never lists a record as a resume, and does not
  // show a folder that holds only its record as an empty folder.
  const scan = read('src/lib/resume-library-scan.ts')
  assert.ok(scan.includes('if (!kind) continue'))
  const skip = scan.indexOf('if (parts[parts.length - 1] === LIBRARY_FILE) continue'), add = scan.indexOf('folders.add(')
  assert.ok(skip > 0 && skip < add, 'the record is skipped before its folder is counted')
  for (const page of ['src/app/dashboard/documents/page.tsx', 'src/app/dashboard/resume/page.tsx']) {
    const src = read(page)
    assert.ok(src.includes('import { scanLibrary } from "@/lib/resume-library-scan"') && !src.includes('async function scanLibrary('), page + ': the shared scanner, not a copy')
    assert.ok(src.indexOf('await mendLibrary(userDir)') > 0 && src.indexOf('await mendLibrary(userDir)') < src.indexOf('await scanLibrary(userDir)'), page + ': the library is put in order before it is listed')
  }
  // Sizes and dates come with the one listing, never with a storage call per file (that made both pages take 3.7 and
  // 4.6 seconds on 14 Oct 2026). R2 sends them in the listing; the disk reads them as it walks.
  assert.ok(scan.includes('await listFilesInfo(dir, { includeHidden: true })') && !scan.includes('statPath'))
  const storage = read('src/lib/storage.ts')
  assert.ok(storage.includes('out.push({ key: o.Key, size: o.Size ?? 0, mtime: o.LastModified ?? new Date(0) })'))
  assert.ok(storage.includes('return (await listFilesInfo(absDir, opts)).map(f => f.path)'), 'listFiles is the same listing without the details')
})

test('picking a resume no longer fetches every file: one named by its content is never read twice', () => {
  const index = read('src/lib/keywords.ts')
  assert.ok(index.includes('const NAMED_BY_CONTENT = /__[a-f0-9]{16}\\.docx$/i'))
  assert.ok(index.includes('if (complete(entry) && NAMED_BY_CONTENT.test(file.filepath)) return'))
  assert.ok(index.includes('if (complete(entry) && sig && entry.sig === sig) return'), 'any other file is looked at by its size and date')
  // Measured on a library of 40 (30 named by content, 10 dropped in): before, picking a resume read 40 whole files;
  // after, 0, and a file that changed is still read again.
})

test('Files shows each email as a title with its folders, a View beside every resume, and not the learned list', () => {
  const files = read('src/app/dashboard/documents/DocumentsClient.tsx'), tree = read('src/app/dashboard/resume/LibraryTree.tsx'), download = read('src/app/api/resumes/download/route.ts'), bot = read('src/app/api/whatsapp/webhook/route.ts')
  for (const src of [files, tree]) {
    assert.ok(src.includes('const isEmailFolder = (name: string) => name.includes("@") || name === "Needs email review"'))
    assert.ok(src.includes('filter(c => isEmailFolder(c.name)).map(person => ('))
    assert.ok(src.includes('href={viewHref(file)} target="_blank" rel="noopener noreferrer"') && src.includes('>\n          View\n        </a>'))
  }
  // A Word resume opens as a page; a PDF opens as itself in the browser.
  assert.ok(files.includes('/api/resumes/pdf?filepath=') && files.includes('&inline=1'))
  assert.ok(download.includes('pdf && searchParams.get("inline") === "1" ? "inline" : "attachment"'))
  // What each kind of job keeps asking for is kept for the tailoring and not put in front of the person.
  assert.ok(!files.includes('Learned') && !existsSync(new URL('../../src/app/dashboard/documents/learned.tsx', import.meta.url)))
  assert.ok(!bot.includes('Send *library* any time') && !bot.includes('*library* ·'))
})
