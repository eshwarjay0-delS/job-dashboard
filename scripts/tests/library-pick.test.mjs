// Which email a job is for, the closest resume of that email, and who the bot answers at all.
// Asked on 13 Oct 2026 (night):
//   "WhatsApp should ask which email, like 1 [first address] or 2 [second address], and if the person can just send the
//    JD and say number one ... the type of resume would be selected from [that] library ... based on the closest match"
//   "if they would like to do their own resume ... that way it would be first, also after every resume completion, say
//    to them, if you wanted to start with a different resume, please send me the resume first"
//   "the other numbers which haven't registered with our databases ... wouldn't get any replies at all ... they should
//    receive an automated message. Here, go to this website"
// A review before it shipped found the defects named in the tests below ("found in review").
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { emailChoices, numberEmails, live, choiceIn, readChoice, askWhichEmail, rankFor, saidOf, DIFFERENT_RESUME } from '../../src/lib/library-pick.ts'
import { openToAll, noticeDue, siteOf, notRegisteredMessage, NOT_CHECKED_MESSAGE, NOTICE_EVERY_MS } from '../../src/lib/whatsapp-who-core.ts'
import { linksOver } from '../../src/lib/whatsapp-link-core.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const A = 'dana05@gmail.com', B = 'dwhit44@gmail.com', TWO = [A, B]
const JD = 'Senior SOC Analyst\nKestrel Bank, Remote\n\nResponsibilities\n1. Monitor Splunk SIEM alerts and lead incident response.\n2. Tune detections and write runbooks.\nRequirements: 5+ years in a SOC, Splunk, Sentinel, MITRE ATT&CK.'
const file = (path, email, depth, keywords, more = {}) => ({ path, email, folder: path.split('/')[1] || '', name: path.split('/').pop(), depth, keywords, at: 1, ...more })

test('the emails a job can be for: the ones the resumes carry, the fullest first when they are first numbered', () => {
  assert.deepEqual(emailChoices({ [B]: 10, [A]: 13 }), [A, B])
  // Something that is not an email, and an email with nothing under it, are not offered.
  assert.deepEqual(emailChoices({ WhatsApp: 3, 'Needs email review': 2, [A]: 1, [B]: 0 }), [A])
  // The resume a person sent counts as a place to start even when Files hold nothing under its email yet.
  assert.deepEqual(emailChoices({ [A]: 2 }, B), [A, B]); assert.deepEqual(emailChoices({}, B), [B]); assert.deepEqual(emailChoices({ [A]: 2 }, A), [A])
  assert.deepEqual(emailChoices({}), []); assert.deepEqual(emailChoices({ [A]: 2 }, ''), [A])
  assert.deepEqual(emailChoices({ 'b@x.com': 2, 'a@x.com': 2 }), ['a@x.com', 'b@x.com'])
  assert.deepEqual(emailChoices({ 'Dana05@Gmail.com': 2, [A]: 3 }), [A])
})

test('an email keeps its number for good, however many resumes are saved after (found in review: "2" came to mean the other person)', () => {
  // First numbered by how many resumes each holds: 13 and 10.
  const first = numberEmails([], { [A]: 13, [B]: 10 })
  assert.deepEqual(first, { order: [A, B], slots: [A, B] })
  // Four more jobs for the second email: it now holds more, and its number does not move.
  const later = numberEmails(first.order, { [A]: 13, [B]: 14 })
  assert.deepEqual(later.slots, [A, B])
  assert.equal(readChoice(`${JD}\n2`, later.slots).email, B, 'the number under a job description means what it meant when it was learned')
  // Without the kept numbering the order would have turned over: this is the defect.
  assert.deepEqual(emailChoices({ [A]: 13, [B]: 14 }), [B, A])
  // A new email takes the next number; nobody else's changes.
  const third = numberEmails(later.order, { [A]: 13, [B]: 14, 'c@x.com': 40 })
  assert.deepEqual(third.slots, [A, B, 'c@x.com'])
  // An email that holds nothing now keeps its place, empty, so the numbers after it stay what they were.
  const gone = numberEmails(third.order, { [B]: 14, 'c@x.com': 40 })
  assert.deepEqual(gone.slots, ['', B, 'c@x.com']); assert.deepEqual(gone.order, [A, B, 'c@x.com']); assert.deepEqual(live(gone.slots), [B, 'c@x.com'])
  assert.equal(choiceIn('1', gone.slots), '', 'a number whose email holds nothing is not an answer')
  assert.equal(choiceIn('3', gone.slots), 'c@x.com'); assert.equal(choiceIn('2', gone.slots), B)
  const q = askWhichEmail(gone.slots)
  assert.ok(q.includes(`*2*  ${B}`) && q.includes('*3*  c@x.com') && !q.includes('*1*') && q.includes('Reply *2* or *3*.'))
  // It comes back with the number it had.
  assert.deepEqual(numberEmails(gone.order, { [A]: 1, [B]: 14, 'c@x.com': 40 }).slots, [A, B, 'c@x.com'])
  // What was kept is cleaned, never trusted: not a list, not strings, twice the same.
  assert.deepEqual(numberEmails('nonsense', { [A]: 1 }).slots, [A]); assert.deepEqual(numberEmails([A, A, 7, null, 'x'], { [A]: 1, [B]: 1 }).order, [A, B])
  // The storage keeps it per account, adds to it only, and never writes over what it could not read.
  const store = read('src/lib/library-pick-store.ts')
  assert.ok(store.includes('const next = numberEmails(order, counts, keptEmail)') && store.includes('} catch { sure = false }'))
  assert.ok(store.includes('if (sure && keep && next.order.join("\\n") !== order.join("\\n"))'))
  // A number sent with a job description is read only when the numbering could be read.
  assert.ok(read('src/app/api/whatsapp/webhook/route.ts').includes('const said = numbered.sure ? readChoice(text, slots) : { email: "", rest: text.trim() }'))
})

test('the answer is read as he said it: "number one", "1", the address', () => {
  for (const said of ['1', ' 1 ', '1.', '#1', 'no 1', 'no. 1', 'number 1', 'number one', 'Number One', 'one', 'first', 'the first one', '1st', 'option 1', 'email 1', 'email one', 'use 1', 'for 1', 'use the first one', '(1)', A, 'dana05', 'use dana05']) assert.equal(choiceIn(said, TWO), A, said)
  for (const said of ['2', 'two', 'second', 'the second email', 'number two', '#2', B, 'DWHIT44@GMAIL.COM', 'dwhit44']) assert.equal(choiceIn(said, TWO), B, said)
  // As people really answer: a polite word after it, a digit tapped from the emoji keyboard, a circled digit.
  for (const said of ['1 please', 'number 1 please', 'one, thanks', 'I want 1', '1️⃣', '①', `${A}.`]) assert.equal(choiceIn(said, TWO), A, said)
  for (const said of ['second one please', '2 pls', '2️⃣', 'go with 2', "it's 2"]) assert.equal(choiceIn(said, TWO), B, said)
  // Not an answer: a number there is no email for, a sentence, a word, nothing.
  for (const said of ['3', '0', '12', 'ok', 'yes', 'thanks', 'the job', 'one more thing', '1 or 2', 'both', '', 'someone@else.com', 'send it to 1 please and thank you']) assert.equal(choiceIn(said, TWO), '', said)
  // Found in review: "no one" was read as "No. one". "one" as a word is an answer alone or after "number"/"email".
  for (const said of ['no one', 'no one please', 'no', 'none', 'neither', 'pick one', 'choose one', 'send one', 'the one', 'take two', 'one one']) assert.equal(choiceIn(said, TWO), '', said)
  assert.equal(choiceIn('1', []), ''); assert.equal(choiceIn('2', [A]), '')
  // The part before the @ is taken only when one address is written that way.
  assert.equal(choiceIn('dana', ['dana@gmail.com', 'dana@outlook.com']), ''); assert.equal(choiceIn('dana@outlook.com', ['dana@gmail.com', 'dana@outlook.com']), 'dana@outlook.com')
})

test('the email may come with the job description, on a line of its own, and nothing inside it is taken for it', () => {
  assert.deepEqual(readChoice(`${JD}\n1`, TWO), { email: A, rest: JD })
  assert.deepEqual(readChoice(`${JD}\n\nnumber two\n`, TWO), { email: B, rest: JD })
  assert.deepEqual(readChoice(`${JD}\r\n2\r\n`, TWO), { email: B, rest: JD })
  assert.deepEqual(readChoice(`${JD}\n${A}`, TWO), { email: A, rest: JD })
  // Said in words it may also come first.
  assert.deepEqual(readChoice(`number two\n${JD}`, TWO), { email: B, rest: JD })
  // The job description alone: its own numbered lines ("1. Monitor ...") and "5+ years" are not a choice.
  assert.deepEqual(readChoice(JD, TWO), { email: '', rest: JD })
  assert.equal(readChoice('1. Monitor Splunk SIEM alerts\n2. Tune detections and write the runbooks for them', TWO).email, '')
  // Found in review: lines of the job description itself that were read as a choice. A bare number at the top is the
  // paste's own; a line with a sign, a colon or brackets is the job description's.
  for (const top of ['1', '1.', '#1', '2']) assert.equal(readChoice(`${top}\n${JD}`, TWO).email, '', `top: ${top}`)
  for (const end of ['$2', '2%', '| 2 |', '(1)', 'Select one:', 'Positions: 2', '2 openings', 'Page 1 of 2', 'Level 2', 'Job 2', '02', 'Reply to dana05@gmail.com', 'Thanks,\nRavi\nravi@staffing.example']) assert.equal(readChoice(`${JD}\n${end}`, TWO).email, '', `end: ${end}`)
  // With one email (or none) there is nothing to choose, so a last line of "1" stays part of what was sent.
  assert.deepEqual(readChoice(`${JD}\n1`, [A]), { email: '', rest: `${JD}\n1` })
  assert.equal(readChoice(`${JD}\n3`, TWO).email, '')
})

test('the question names each email with its number, and says how not to be asked', () => {
  const q = askWhichEmail(TWO)
  assert.ok(q.startsWith('Which email is this job for?') && q.includes(`*1*  ${A}`) && q.includes(`*2*  ${B}`) && q.includes('Reply *1* or *2*.'))
  assert.ok(q.includes('put the number on a line of its own under the job description'))
  assert.ok(askWhichEmail([A, B, 'c@x.com']).includes('Reply *1*, *2* or *3*.'))
})

test('inside the chosen email the closest resume wins, and never one of another email', () => {
  const asked = ['splunk', 'siem', 'incident response', 'sentinel']
  const all = [
    file(`${A}/SIEM and Incident Response/SOC Analyst - Kestrel`, A, 1, ['splunk', 'siem', 'incident response']),
    file(`${A}/DevOps and Platform Engineering/Platform Engineer`, A, 1, ['jenkins', 'splunk']),
    file(`${A}/Identity and Access Management/Resume`, A, 0, ['okta', 'siem']),
    // Everything the job asks for, but another person's profile: it is never looked at for this email.
    file(`${B}/SIEM and Incident Response/SOC Lead`, B, 1, ['splunk', 'siem', 'incident response', 'sentinel']),
  ]
  const { ranked } = rankFor(all, A, asked)
  // The most shown first; of two that show the same, the one the person wrote comes before one made for a job.
  assert.deepEqual(ranked.map(r => [r.candidate.folder, r.shows, r.of]), [['SIEM and Incident Response', 3, 4], ['Identity and Access Management', 1, 4], ['DevOps and Platform Engineering', 1, 4]])
  assert.ok(ranked.every(r => r.candidate.email === A))
  assert.equal(rankFor(all, B, asked).ranked[0].shows, 4)
  assert.deepEqual(rankFor(all, 'nobody@x.com', asked), { ranked: [], builtOnAlready: 0 })
  // Said to the person before the work starts. The email is said first by the bot, on its own.
  assert.equal(saidOf(ranked[0]), 'your saved *SIEM and Incident Response* resume (SOC Analyst - Kestrel), which already shows 3 of the 4 things this job asks for')
  assert.ok(read('src/app/api/whatsapp/webhook/route.ts').includes('`${source.email ? `For *${source.email}*. ` : ""}Tailoring from ${source.said}'))
})

test('a resume built on a saved resume is never built on again; ties go to the one the person wrote, then the newest', () => {
  const asked = ['splunk', 'siem']
  const copyOfCopy = file(`${A}/SIEM and Incident Response/Second pass (tailored)`, A, 2, ['splunk', 'siem'])
  const made = file(`${A}/SIEM and Incident Response/First pass (tailored)`, A, 1, ['splunk'], { at: 5 })
  const older = file(`${A}/SIEM and Incident Response/Older pass (tailored)`, A, 1, ['splunk'], { at: 2 })
  const written = file(`${A}/Network Security/Resume`, A, 0, ['splunk'])
  const out = rankFor([copyOfCopy, older, made, written], A, asked)
  assert.equal(out.builtOnAlready, 1)
  assert.deepEqual(out.ranked.map(r => r.candidate.name), ['Resume', 'First pass (tailored)', 'Older pass (tailored)'])
  assert.deepEqual(rankFor([copyOfCopy], A, asked), { ranked: [], builtOnAlready: 1 })
  // The resume the person sent is one more place to start, and is named as theirs.
  const kept = { ...file('kept.docx', A, 0, ['splunk', 'siem']), name: 'Dana Resume', kept: true }
  const withKept = rankFor([made, kept], A, asked)
  assert.equal(withKept.ranked[0].candidate.kept, true)
  assert.equal(saidOf(withKept.ranked[0]), 'your resume *Dana Resume*, which already shows 2 of the 2 things this job asks for')
})

test('whose a resume is comes from the email written in it, not from its folder (found in review)', () => {
  const index = read('src/lib/keywords.ts'), store = read('src/lib/library-pick-store.ts')
  // The index keeps the emails beside the keywords; an entry from before is read once more.
  assert.ok(index.includes('emails: resumeEmails(text)') && index.includes('typeof e.yoe === "number" && Array.isArray(e.emails)'))
  // So a resume that was never put in an email folder is still found, and the emails offered are the ones resumes carry.
  assert.ok(store.includes('const mine = Object.entries(index).flatMap(([abs, entry]) => (emailOf(entry) === email ? [{ abs, rel: relOf(userDir, abs), entry }] : []))'))
  assert.ok(store.includes('for (const entry of Object.values(index)) { const email = emailOf(entry); if (email) counts[email] = (counts[email] || 0) + 1 }'))
  // The file is opened and asked once more before it is used; one that cannot be opened is not called "wrong email".
  assert.ok(store.includes('if (emails.length === 1 && emails[0] === email) return { pick: one, usable: ranked.length, builtOnAlready, wrongEmail, unread }'))
  assert.ok(store.includes('if (!bytes) { unread++; continue }'))
  // A file made for a job that no record knows is not built on.
  assert.ok(store.includes('const depth: 0 | 1 | 2 = !isTailoredName(parts[parts.length - 1]) ? 0 : known && known.depth !== 2 ? 1 : 2'))
})

test('the bot asks before it tailors, takes the answer, and says the small message after every resume', () => {
  const bot = read('src/app/api/whatsapp/webhook/route.ts')
  // 1. A resume sent for this job is used as it is; 2. the email is settled or asked; 3. the closest of that email.
  assert.ok(bot.includes('if (own && original) return { source: own }'))
  assert.ok(bot.includes('if (emails.length > 1) return { ask: slots }'))
  assert.ok(bot.includes('const found = await closestFor(userDir, email, jd, kept_, resumes.index)'))
  // The question waits with the job description.
  assert.ok(bot.includes('session.ask = start.ask\n    await saveSession(from, session)'))
  assert.ok(bot.includes('const said = numbered.sure ? readChoice(text, slots)') && bot.includes('session.jd = said.rest'))
  // Found in review: an answer sent as a reply to the question went to "change a resume". It is read first.
  const answer = bot.indexOf('const answer = waiting ? choiceIn(text, waiting) : ""'), change = bot.indexOf('if (replyTo) return refine(from, replyTo, text, who)')
  assert.ok(answer > 0 && answer < change && change < bot.indexOf('That looks too short to be a job description'))
  // Found in review: the default account every unjoined number shares was still looked through for the email on a
  // sent resume. It is not looked through at all, and "library" does not list it.
  assert.ok(bot.indexOf('if (!who.own) return own ? { source: own } : { say: NO_RESUME }') < bot.indexOf('const resumes = choice.resumes || await libraryOf(userDir)'))
  assert.ok(bot.includes('const resumes = who.own ? await libraryOf(userDirOf(userId)) : null') && bot.includes('if (!who.saves || !who.own) return sendText(from, `Nothing is saved in Files for this number yet.'))
  // Found in review: a resume marked "sent for the next job" never stopped being so, and won over an email the person
  // said. It ends with the job made from it, a quiet day, or "reset"; and an email said for the job wins over it.
  assert.ok(bot.includes('if (own && session.resumeFresh && !(choice.email && keptEmail && choice.email !== keptEmail)) return { source: { ...own, email: keptEmail || undefined } }'))
  assert.ok(bot.includes('if (s.updatedAt && Date.now() - s.updatedAt > ttl) return { ...kept(s), resumeFresh: false }') && bot.includes('await saveSession(from, { ...kept(session), resumeFresh: false })'))
  assert.ok(bot.includes('resumeFresh: sameResume && usedKept ? false : now.resumeFresh,'))
  // Found in review: a resume with no email that can be read was taken to be the only email's. It is used as it
  // always was, and never put among another email's resumes.
  assert.ok(bot.includes('if (own && !keptEmail && emails.length === 1) return { source: own }'))
  assert.ok(bot.includes('const kept_ = own && keptEmail === email ? await keptCandidate('))
  // Found in review: the job that finishes wrote back the session of a minute ago and wiped a question asked since.
  // It reads the session again and puts away its own job only.
  assert.ok(bot.includes('const loaded = await loadSession(from)\n  const now = loaded.seen?.length ? loaded : session\n  const another = !!now.jd && jobKeyOf(now.jd) !== jobKeyOf(session.jd)'))
  assert.ok(bot.includes('...(another ? now : kept(now)),'))
  // A job description that takes the place of one still waiting for its email says so.
  assert.ok(bot.includes('This job description takes the place of the one that was waiting for its email.'))
  // The small message, after every new resume.
  assert.equal(DIFFERENT_RESUME, '_To start from a different resume, send me that resume first, then the job description._')
  assert.ok(bot.includes('try { await sendText(from, DIFFERENT_RESUME) } catch { /* ignore */ }'))
  // The time spent finding the resume comes out of the minute the tailoring has.
  assert.ok(bot.includes('const budget = () => TAILOR_BUDGET_MS - (Date.now() - lookedAt)') && bot.includes('maxMs = Math.max(20_000, maxMs - (Date.now() - lookedAt))'))
  // The same decision can be asked for without a message to the bot, and asking changes nothing.
  const api = read('src/app/api/resumes/library-pick/route.ts')
  assert.ok(api.includes('const userId = await authenticatedUserId(request)') && api.includes('await numberedEmails(userId, resumes.counts, "", false)'))
})

test('only a registered number is answered; one that is not gets one automated message a day and nothing else', () => {
  // Open to every number only when the deployment says so in these exact words.
  assert.equal(openToAll('0'), true)
  for (const v of [undefined, '', '1', 'true', 'false', 'no', ' 00 ']) assert.equal(openToAll(v), false, String(v))
  // One message a day to a number that is not registered; the "could not check" one may be said again sooner.
  const now = 1_800_000_000_000
  assert.equal(noticeDue(null, 'unregistered', now), true); assert.equal(noticeDue({}, 'unregistered', now), true)
  assert.equal(noticeDue({ unregistered: now - 60_000 }, 'unregistered', now), false)
  assert.equal(noticeDue({ unregistered: now - NOTICE_EVERY_MS.unregistered + 1 }, 'unregistered', now), false)
  assert.equal(noticeDue({ unregistered: now - NOTICE_EVERY_MS.unregistered }, 'unregistered', now), true)
  assert.equal(noticeDue({ unregistered: now - 60_000 }, 'unchecked', now), true, 'each kind is counted on its own')
  assert.equal(noticeDue({ unchecked: now - 5 * 60_000 }, 'unchecked', now), false); assert.equal(noticeDue({ unchecked: now - 11 * 60_000 }, 'unchecked', now), true)
  assert.equal(NOTICE_EVERY_MS.unregistered, 24 * 60 * 60 * 1000)
  // The message says where to go, in steps, and names no price and no plan that does not exist.
  const say = notRegisteredMessage('https://app.example.com')
  assert.ok(say.startsWith('This number is not registered with MarketFit') && say.includes('1. Open app.example.com and sign in.') && say.includes('2. Add this mobile number and type the code we text you.'))
  assert.ok(!/subscri|\$|price|plan/i.test(say))
  assert.ok(notRegisteredMessage('').includes('1. Open MarketFit and sign in.'))
  // Found on the live site the same night: the text-message service was refusing our account, so "type the code we
  // text you" led nowhere. While codes cannot be texted the message names the way that works: the code from the site.
  const other = notRegisteredMessage('https://app.example.com', false)
  assert.ok(other.includes('2. Open *WhatsApp* there and press *Link this number*.') && other.includes('3. Send me the code it shows, like this: link ABCD-1234') && !other.includes('we text you'))
  assert.ok(!/subscri|\$|price|plan/i.test(other))
  const whoSrc = read('src/lib/whatsapp-who.ts')
  assert.ok(whoSrc.includes('try { works = (await phoneVerifyStatus()).state === "ok" } catch { works = false }'))
  assert.ok(read('src/app/api/whatsapp/webhook/route.ts').includes('notRegisteredMessage(siteOf(process.env.NEXT_PUBLIC_APP_URL, request.nextUrl.origin), await textCodesWork())'))
  assert.ok(NOT_CHECKED_MESSAGE.includes('on our side') && !/not registered/i.test(NOT_CHECKED_MESSAGE))
  // Only a real https address is put in front of a stranger.
  assert.equal(siteOf('https://app.example.com/dashboard?x=1'), 'https://app.example.com')
  assert.equal(siteOf('http://localhost:3000', 'https://app.example.com'), 'https://app.example.com')
  assert.equal(siteOf(undefined, '', 'javascript:alert(1)', 'http://app.example.com'), '')
})

test('a number that IS registered is never told it is not, when the store does not answer (found in review)', async () => {
  // The link store as it is on a bad day: reading throws.
  const held = new Map([['whatsapp/links/15550100.json', JSON.stringify({ userId: 'user-1', at: 1 })]])
  let down = false
  const store = { getText: async (k) => { if (down) throw new Error('503'); return held.get(k) ?? null }, put: async (k, v) => { held.set(k, v) }, delete: async (k) => { held.delete(k) } }
  const links = linksOver(store)
  assert.deepEqual(await links.linkedUserIdChecked('+1 555 0100'), { userId: 'user-1', checked: true })
  assert.deepEqual(await links.linkedUserIdChecked('15550199'), { userId: null, checked: true }, 'nobody joined it, and that is known')
  down = true
  assert.deepEqual(await links.linkedUserIdChecked('15550100'), { userId: null, checked: false }, 'not known: the bot says so instead of "not registered"')
  assert.equal(await links.linkedUserId('15550100'), null, 'the old reader could not tell the two apart')
  const who = read('src/lib/whatsapp-who.ts')
  assert.ok(who.includes('const linked = await linkedUserIdChecked(from)') && who.includes('if (!linked.checked) checked = false'))
  assert.ok(who.includes('if (error) { checked = false;') && who.includes('} catch { checked = false'))
  // With the store down, "you are not registered" is not sent at all, and "I could not check" still is.
  assert.ok(who.includes('} catch { return kind === "unchecked" }'))
})

test('the bot asks who a number is before anything else, and its replies to a stranger are counted', () => {
  const bot = read('src/app/api/whatsapp/webhook/route.ts'), who = read('src/lib/whatsapp-who.ts')
  assert.ok(bot.includes('const kind = sender.checked ? "unregistered" : "unchecked"') && bot.includes('if (await claimNotice(from, kind)) {'))
  assert.ok(bot.indexOf('if (!who && !linking) {') < bot.indexOf('const session = await loadSession(from)'), 'nothing of an unregistered number is loaded or kept')
  // "link <code>" is how a number registers itself, so it is still read from a number that is not registered yet.
  assert.ok(bot.includes('if (linking) who = await link(from, linking[1], who)'))
  // Found in review: after five wrong codes every further one got a reply. The limit is said once an hour.
  assert.ok(bot.includes('if (await claimNotice(from, "link_limit")) await sendText(from, "That is five codes in an hour'))
  assert.equal(NOTICE_EVERY_MS.link_limit, 60 * 60 * 1000)
  // Registered: it sent a code, the owner named it, or its mobile code was confirmed. Nothing else.
  assert.ok(who.includes('by: "code"') && who.includes('by: "owner"') && who.includes('by: "verified"'))
  assert.ok(who.includes('if (openToAll(process.env.WHATSAPP_IDENTITY_BINDING_REQUIRED)) return { who: who(FALLBACK_USER_ID, false), by: "open", checked }\n  return { who: null, by: null, checked }'))
  // The record of the one message is written before the answer is given.
  assert.ok(who.includes('if (!noticeDue(last, kind, now)) return false\n    await blob.put(noticeKey(from), JSON.stringify({ ...last, [kind]: now }))\n    return true'))
  // The owner can ask "would this number be answered" without a message to the bot; the number is never sent back.
  const api = read('src/app/api/whatsapp/who/route.ts')
  assert.ok(api.includes('if (!isAdminEmail(user.email)) return { refuse:') && api.includes('const sender = await resolveWhatsAppUser(digits)') && !api.includes('number: digits'))
})
