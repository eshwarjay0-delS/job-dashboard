// The inbox search (12 Oct 2026). The owner: "Give me search bar similar to gmail search bar as well."
// These hold what a typed search means: a word is looked for everywhere, the Gmail words (from:, subject:, is:unread,
// newer_than:, a "phrase", a minus, OR) do what they do in Gmail, and what cannot be answered here is named, not dropped.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseQuery, indexDoc, matches, wordsToShow, termsOf, findIn, suggestPeople, pickPerson, toggleWord, fold } from '../../src/lib/mail-search.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 12, 18, 0, 0)
// Made-up conversations. Nothing here is a real person or a real email.
const DOCS = {
  dana: { from: 'Dana Whitfield dana.whitfield@northpier-staffing.example Me me@example.com', to: 'me@example.com', cc: '', subject: 'Cybersecurity Analyst 220417 || State agency || Madison, WI (Hybrid)', text: 'I have an urgent role. Could you send your updated resume and your hourly rate? Javascript is not needed.', unread: true, ts: NOW - 2 * DAY },
  omar: { from: 'Omar Haddad omar@brightline-talent.example', to: 'me@example.com', cc: 'lead@brightline-talent.example', subject: 'Senior Java Developer, remote', text: 'Renée from the R&amp;D team asked for your availability on Thursday at 10:30.', unread: false, ts: NOW - 20 * DAY },
  ats: { from: 'Careers no-reply@harborview-health.example', to: 'me@example.com', cc: '', subject: 'Your application was received', text: 'Thank you for applying to SOC Analyst II. We will be in touch.', unread: false, ts: NOW - 45 * DAY },
}
const IDX = Object.fromEntries(Object.entries(DOCS).map(([k, d]) => [k, indexDoc(d)]))
const find = (q, opts) => { const query = parseQuery(q, opts); return Object.keys(IDX).filter(k => matches(IDX[k], query, NOW)) }

test('a word is looked for everywhere: who wrote, the subject and the messages', () => {
  assert.deepEqual(find('dana'), ['dana'])                 // who wrote
  assert.deepEqual(find('remote'), ['omar'])               // the subject
  assert.deepEqual(find('resume'), ['dana'])               // inside a message
  assert.deepEqual(find('harborview'), ['ats'])            // part of an address
  assert.deepEqual(find('analyst'), ['dana', 'ats'])
})

test('a word matches the start of a word, so the list narrows while typing; it does not match the middle', () => {
  assert.deepEqual(find('jav'), ['dana', 'omar'])          // Javascript, Java
  assert.deepEqual(find('script'), [])                     // not the middle of "Javascript"
  assert.deepEqual(find('RESUME'), ['dana'])               // capitals do not matter
  assert.deepEqual(find('renee'), ['omar'])                // "Renée": the accent does not have to be typed
  assert.deepEqual(find('"r&d team"'), ['omar'])           // Gmail's "&amp;" is read as the "&" it stands for
  assert.equal(fold('Renée &amp; Co'), 'renee & co')
})

test('several words must all be there; a quoted phrase must stand together', () => {
  assert.deepEqual(find('updated resume'), ['dana'])
  assert.deepEqual(find('resume java'), ['dana'])          // both, anywhere
  assert.deepEqual(find('"resume java"'), [])              // not next to each other
  assert.deepEqual(find('"updated resume"'), ['dana'])
  assert.deepEqual(find('"updated res'), ['dana'])         // a phrase still being typed, quote not closed yet
})

test('from:, to:, cc: and subject: look in one place only', () => {
  assert.deepEqual(find('from:omar'), ['omar'])
  assert.deepEqual(find('from:brightline'), ['omar'])      // any part of the address
  assert.deepEqual(find('from:talent.example'), ['omar'])
  assert.deepEqual(find('subject:analyst'), ['dana'])      // the ATS mail says "Analyst" only in its text
  assert.deepEqual(find('subject:(senior java)'), ['omar'])
  assert.deepEqual(find('subject:(java OR cybersecurity)'), ['dana', 'omar'])
  assert.deepEqual(find('cc:lead'), ['omar'])
  assert.deepEqual(find('from:"dana whitfield"'), ['dana'])
  assert.deepEqual(find('to:me@example.com').length, 3)
})

test('a minus leaves things out, OR takes either', () => {
  assert.deepEqual(find('analyst -from:dana'), ['ats'])
  assert.deepEqual(find('-analyst'), ['omar'])
  assert.deepEqual(find('dana OR omar'), ['dana', 'omar'])
  assert.deepEqual(find('dana OR omar remote'), ['omar'])  // (dana OR omar) and remote
  assert.deepEqual(find('or'), [])                         // a small "or" is a word, and nobody wrote it here
})

test('is:unread, newer_than:, older_than:, after: and before: read the conversation, not its words', () => {
  assert.deepEqual(find('is:unread'), ['dana'])
  assert.deepEqual(find('is:read'), ['omar', 'ats'])
  assert.deepEqual(find('newer_than:7d'), ['dana'])
  assert.deepEqual(find('newer_than:1m'), ['dana', 'omar'])
  assert.deepEqual(find('older_than:4w'), ['ats'])
  assert.deepEqual(find('after:2026/10/01'), ['dana'])
  assert.deepEqual(find('before:2026-10-01'), ['omar', 'ats'])
  assert.deepEqual(find('after:09/01/2026 before:10/01/2026'), ['omar'])
  assert.deepEqual(find('analyst newer_than:7d'), ['dana'])
})

test('a day begins at midnight where the person is, not in London', () => {
  const late = indexDoc({ ...DOCS.dana, ts: Date.UTC(2026, 9, 10, 2, 0, 0) })   // 10 Oct 02:00 UTC = 9 Oct 21:00 in Chicago
  assert.equal(matches(late, parseQuery('after:2026/10/10'), NOW), true)
  assert.equal(matches(late, parseQuery('after:2026/10/10', { tzOffsetMinutes: 300 }), NOW), false)
  assert.equal(matches(late, parseQuery('before:2026/10/10', { tzOffsetMinutes: 300 }), NOW), true)
})

test('what cannot be answered here is named, never quietly treated as matching', () => {
  const q = parseQuery('resume has:attachment label:work is:starred newer_than:soon after:tomorrow')
  assert.deepEqual(q.unknown, ['has:attachment', 'label:work', 'is:starred', 'newer_than:soon', 'after:tomorrow'])
  assert.deepEqual(termsOf(q).map(t => t.value), ['resume'])  // only "resume" is asked
  assert.deepEqual(find('has:attachment'), [])             // nothing typed that can be asked: the ordinary list, not "everything matches"
  assert.equal(parseQuery('has:attachment').empty, true)
})

test('things with a colon that are not operators are just words', () => {
  assert.deepEqual(find('10:30'), ['omar'])
  assert.equal(parseQuery('https://example.com/job').unknown.length, 0)
  assert.deepEqual(termsOf(parseQuery('c2c:')).map(t => t.field), ['any'])
})

test('half-typed and odd text never throws and never matches everything', () => {
  for (const q of ['', '   ', '-', '"', '(', 'from:', 'subject:(', 'OR', 'OR OR', '-""', ':', 'a'.repeat(5000), '\\', '[', '*', '+?']) {
    const parsed = parseQuery(q)
    assert.ok(Array.isArray(parsed.unknown) && typeof parsed.empty === 'boolean', q)
    if (parsed.empty) assert.deepEqual(Object.keys(IDX).filter(k => matches(IDX[k], parsed, NOW)), [], q)
  }
  assert.equal(parseQuery('').empty, true)
  assert.equal(parseQuery('from:').empty, true)
})

test('the bold words are what was asked for, and the place they stand is shown with a few words either side', () => {
  assert.deepEqual(wordsToShow(parseQuery('resume -java from:dana subject:analyst "hourly rate"')), ['resume', 'analyst', 'hourly rate'])
  const f = findIn(DOCS.dana.text, ['hourly rate'])
  assert.equal(f.hit, 'hourly rate')
  assert.ok(f.before.endsWith('your ') && f.after.startsWith('?'))
  assert.equal(findIn(DOCS.dana.text, ['script']), null)   // the same rule as the search: the start of a word
  assert.equal(findIn('R&amp;D wrote', ['wrote']).before, 'R&D ')
  const long = 'word '.repeat(60) + 'needle ' + 'tail '.repeat(60)
  const cut = findIn(long, ['needle'])
  assert.ok(cut.before.startsWith('…') && cut.after.endsWith('…') && cut.before.length < 40 && cut.after.length < 100)
  assert.equal(findIn('a.b*c (d) [e]', ['(d', '[e', '*']).hit, 'd')  // marks in a search are not a pattern: "(d" is the word d
  assert.equal(findIn('abc', ['*', '(', '[', '.+']), null)
})

test('people are offered while a name is typed, and picking one writes from: for the person', () => {
  const people = [
    { name: 'Dana Whitfield', email: 'dana.whitfield@northpier-staffing.example', count: 6, last: 5 },
    { name: 'Daniel Okoro', email: 'daniel@quayside.example', count: 9, last: 1 },
    { name: 'Omar Haddad', email: 'omar@brightline-talent.example', count: 2, last: 9 },
  ]
  assert.deepEqual(suggestPeople(people, 'resume dan').map(p => p.name), ['Daniel Okoro', 'Dana Whitfield'])
  assert.deepEqual(suggestPeople(people, 'northpier').map(p => p.name), ['Dana Whitfield'])
  assert.deepEqual(suggestPeople(people, 'd'), [])                 // one letter says nothing yet
  assert.deepEqual(suggestPeople(people, 'from:dan'), [])          // already being said with from:
  assert.equal(pickPerson('resume dan', 'daniel@quayside.example'), 'resume from:daniel@quayside.example ')
  assert.deepEqual(find(pickPerson('send dan', 'dana.whitfield@northpier-staffing.example')), ['dana'])
})

test('a quick button puts its word in the box and takes it out again', () => {
  assert.equal(toggleWord('resume', 'is:unread'), 'resume is:unread ')
  assert.equal(toggleWord('resume is:unread ', 'is:unread'), 'resume')
  assert.equal(toggleWord('', 'newer_than:7d'), 'newer_than:7d ')
})

// ── Found by the review of 12 Oct 2026, each with the case that failed ───────────────────────────────────────────────

test('brackets hold things together: a minus, an OR or an operator applies to the whole bracket', () => {
  assert.deepEqual(find('-(dana OR omar)'), ['ats'])                   // was: all three
  assert.deepEqual(find('-(senior java)'), ['dana', 'ats'])            // not (senior and java): only Omar has both
  assert.deepEqual(find('(senior java) OR analyst'), ['dana', 'omar', 'ats'])   // was: only omar
  assert.deepEqual(find('(from:dana OR from:omar)'), ['dana', 'omar']) // was: nothing, "from" read as a word
  assert.deepEqual(find('(from:dana OR from:omar) remote'), ['omar'])
  assert.deepEqual(find('subject:(java OR cybersecurity) -from:omar'), ['dana'])
  assert.deepEqual(find('-subject:(senior java)'), ['dana', 'ats'])
  assert.deepEqual(find('((dana))'), ['dana'])
  assert.deepEqual(find('(dana'), ['dana'])                            // a bracket still being typed
  assert.deepEqual(find('dana)'), ['dana'])                            // a stray one is ignored, not the end of the search
  assert.deepEqual(find('dana) analyst'), ['dana'])
  assert.equal(parseQuery('()').empty, true)
  assert.equal(parseQuery('-()').empty, true)
  assert.deepEqual(parseQuery('has:(a b) resume').unknown, ['has:(…)'])
  assert.deepEqual(wordsToShow(parseQuery('-(dana OR omar) resume')), ['resume'])   // what is ruled out is not put in bold
  assert.deepEqual(wordsToShow(parseQuery('-(-resume)')), ['resume'])               // ruled out twice is asked for
})

test('"C++", "C#" and ".NET" are those words, not the letter c and the word net', () => {
  const docs = {
    cpp: indexDoc({ from: 'A a@x.example', to: '', cc: '', subject: 'C++ Developer', text: 'Could you share your C++ and C#/.NET background?', unread: false, ts: NOW }),
    net: indexDoc({ from: 'B b@x.example', to: '', cc: '', subject: 'Network Engineer', text: 'Cisco and careers in networking. Node.js is a plus.', unread: false, ts: NOW }),
  }
  const hit = (q) => Object.keys(docs).filter(k => matches(docs[k], parseQuery(q), NOW))
  assert.deepEqual(hit('c++'), ['cpp'])              // was: every conversation with a word that begins with c
  assert.deepEqual(hit('c#'), ['cpp'])
  assert.deepEqual(hit('.net'), ['cpp'])             // was: "network" too
  assert.deepEqual(hit('dotnet'), ['cpp'])           // people write it both ways
  assert.deepEqual(hit('net'), ['net'])
  assert.deepEqual(hit('node.js'), ['net'])
  assert.deepEqual(hit('js'), ['net'])               // a dot inside a name still parts it
  assert.deepEqual(hit('c'), ['cpp', 'net'])         // one letter is the start of a word, as everywhere else
  assert.equal(findIn('Could you share your C++ and C#/.NET background?', ['c++']).hit, 'C++')
  assert.equal(findIn('Could you share your C++ and C#/.NET background?', ['.net']).hit, '.NET')
  assert.equal(findIn('Cybersecurity and careers', ['c++']), null)
})

test('nothing typed can be made to match every conversation', () => {
  // A word that happens to be the name of something built into the language is a word like any other.
  for (const q of ['constructor:x', '__proto__:x', 'toString:x', 'hasOwnProperty:y']) {
    const parsed = parseQuery(q)
    assert.deepEqual(Object.keys(IDX).filter(k => matches(IDX[k], parsed, NOW)), [], q)     // was: all three
    assert.deepEqual(termsOf(parsed).map(t => t.field), ['any'], q)
  }
  assert.deepEqual(find('-constructor:x'), find('-zzzz'))    // "without a word nobody wrote" is everything, by its meaning and no longer by accident
  for (const q of ['cc:@', 'cc:-', 'from:.', 'to:<', 'subject:!!', 'from:""']) assert.equal(parseQuery(q).empty, true, q)   // was: all three matched
  assert.deepEqual(find('from:@northpier'), ['dana'])
})

test('a long or odd search is read in no time', () => {
  const t0 = performance.now()
  for (const q of ['('.repeat(500), '-'.repeat(500), 'a:'.repeat(250), '"'.repeat(499), 'from:'.repeat(100), ('(a OR ' ).repeat(80), 'x'.repeat(5000), ' '.repeat(5000) + 'a']) {
    const parsed = parseQuery(q)
    Object.keys(IDX).forEach(k => matches(IDX[k], parsed, NOW))
    findIn('some text '.repeat(2000), wordsToShow(parsed))
  }
  assert.ok(performance.now() - t0 < 500, 'took ' + Math.round(performance.now() - t0) + ' ms')
})

test('the inbox page has the bar, asks the server to look inside the messages, and the server looks only in kept mail', () => {
  const page = read('src/app/dashboard/mail/page.tsx')
  assert.match(page, /<MailSearchBar/)
  const bar = read('src/app/dashboard/mail/_components/mail-search.tsx')
  // What a person searches for goes in the body of a POST: not into an address, so not into a request log.
  assert.match(bar, /fetch\("\/api\/gmail\/search", \{ method: "POST"/)
  assert.doesNotMatch(bar, /\/api\/gmail\/search\?/)
  assert.match(bar, /placeholder="Search mail"/)
  assert.match(page, /found=\{search\.active \? search\.hits\[/)   // a row shows where its word was found
  const route = read('src/app/api/gmail/search/route.ts')
  assert.match(route, /requireAuth\(\)/)
  assert.match(route, /keptThreads\(/)
  assert.doesNotMatch(route, /fetchClassifiedThreads|gmailGet|googleapis/)   // a search is typed many times: it never calls Gmail
})
