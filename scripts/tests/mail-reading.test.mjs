// The inbox, readable (12 Oct 2026). The owner, of /dashboard/mail: "the Email inboxes are so freaking messy I can't read
// or understand anything from it", then: "only present how much a 5 year old baby could consume understand and respond,
// think, ask for clarification, question, ask for automated replies, ask for history about the mail sequence. occurence.
// details contact numbers".
// The page never showed an email: only Gmail's 140-character snippet, with "&amp;" and "&#39;" still in it, under a stack
// of reply tools. These hold what a conversation now gives the page, and that making it readable never rewords a line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decodeEntities, senderName, senderEmail, splitQuoted, dropFooter, tidy, readThread, contactsOf, sequenceOf, turnOf, aboutOf } from '../../src/lib/mail-reading.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ME = 'me@example.com'
// A made-up thread in the shape the server keeps. Nothing here is a real person or a real email.
const THREAD = {
  threadId: 't1', accountEmail: ME,
  messages: [
    { id: 'a', from: 'Dana Whitfield <dana.whitfield@northpier-staffing.example>', subject: 'Cybersecurity Analyst 220417 || State agency || Madison, WI (Hybrid)', snippet: 'Hi, I have an urgent role', internalDate: '1791800000000',
      bodyText: 'Hi,\n\nI have an urgent role with a State agency in Madison. It is hybrid, 12 months, and the rate is open.\nCould you send your updated resume and the best number to reach you?\n\nThanks &amp; Regards,\nDana Whitfield | IT Recruiter\nNorthpier Staffing\nM: (608) 555-0142 x204\ndana.whitfield@northpier-staffing.example\n\nCONFIDENTIALITY NOTICE: This e-mail and any attachments are confidential and intended only for the addressee.\nIf you are not the intended recipient, delete it.' },
    { id: 'b', from: `Me <${ME}>`, subject: 'Re: Cybersecurity Analyst 220417 || State agency || Madison, WI (Hybrid)', snippet: 'Completed my bachelor&#39;s in 2015', internalDate: '1791803600000',
      bodyText: 'Hi Dana,\n\nCompleted my bachelor&#39;s in 2015. My resume is attached and you can reach me on 555-010-7788.\n\nOn Mon, Oct 12, 2026 at 9:14 AM Dana Whitfield <dana.whitfield@northpier-staffing.example> wrote:\n> Hi,\n> I have an urgent role with a State agency in Madison.' },
    { id: 'c', from: '"Whitfield, Dana" <dana.whitfield@northpier-staffing.example>', subject: 'RE: Cybersecurity Analyst 220417 || State agency || Madison, WI (Hybrid)', snippet: 'Thank you Thanks &amp; With Regards', internalDate: '1791807200000',
      bodyText: 'Thank you. Please confirm the rate of $62/hr on C2C and sign the attached Right to Represent.\n\nThanks & With Regards,\nDana Whitfield\nDesk: 608.555.0199\n\nFrom: Me <me@example.com>\nSent: Monday, October 12, 2026 10:14 AM\nTo: Whitfield, Dana\nSubject: Re: Cybersecurity Analyst\n\nHi Dana,\nCompleted my bachelor\'s in 2015.' },
  ],
}

test('the codes Gmail leaves in a snippet become the characters they stand for', () => {
  assert.equal(decodeEntities('Completed my bachelor&#39;s in 2015! Thanks &amp; Regards &quot;soon&quot; &nbsp;ok &#x2014; done'), 'Completed my bachelor\'s in 2015! Thanks & Regards "soon"  ok — done')
  assert.equal(decodeEntities('AT&T &unknown; &#0; 5 < 6'), 'AT&T &unknown; &#0; 5 < 6', 'what is not a code is left alone')
})

test('a sender is shown by name, once', () => {
  assert.deepEqual([senderName('Dana Whitfield <dana@x.example>'), senderName('"Whitfield, Dana" <dana@x.example>'), senderName('dana.whitfield@x.example'), senderName('<dana@x.example>')], ['Dana Whitfield', 'Dana Whitfield', 'dana.whitfield', 'dana'], '"Whitfield, Dana" is said the way people say it')
  assert.equal(senderName('Northpier Staffing, Inc <jobs@x.example>'), 'Northpier Staffing, Inc', 'a company with a comma is not a person to turn round')
  assert.equal(senderEmail('Dana Whitfield <Dana.Whitfield@X.example>'), 'dana.whitfield@x.example')
})

test('what a person wrote is split from the history their mail program quoted under it', () => {
  const gmail = splitQuoted(THREAD.messages[1].bodyText), outlook = splitQuoted(THREAD.messages[2].bodyText)
  assert.ok(gmail.said.endsWith('555-010-7788.') && gmail.earlier.startsWith('On Mon, Oct 12, 2026'))
  assert.ok(outlook.said.endsWith('Desk: 608.555.0199') && outlook.earlier.startsWith('From: Me'))
  assert.deepEqual(splitQuoted('Just a note.\nNo history here.'), { said: 'Just a note.\nNo history here.', earlier: '' })
  const forward = '---------- Forwarded message ---------\nFrom: Someone\nThe role is open.'
  assert.equal(splitQuoted(forward).said, forward, 'a forward with nothing written above it is the message')
  assert.equal(splitQuoted('From: the hiring manager I heard it is urgent.').earlier, '', 'the word "From:" in a sentence is not a quoted header')
})

test('the notice at the foot is set aside, and never the message itself', () => {
  const body = dropFooter(tidy(splitQuoted(THREAD.messages[0].bodyText).said))
  assert.ok(body.cut && body.text.endsWith('dana.whitfield@northpier-staffing.example') && !/CONFIDENTIALITY/.test(body.text))
  assert.deepEqual(dropFooter('Unsubscribe me from this list please, I am not looking.'), { text: 'Unsubscribe me from this list please, I am not looking.', cut: false }, 'a message that opens with the word is not all footer')
})

test('tidying changes spacing and noise, and not one word', () => {
  const wrapped = 'I have an urgent role with a State agency in Madison and it is a hybrid\nposition for twelve months.\n\n\n\n- one\n- two\n[image: logo.png]\nSee https://track.example/c/' + 'a'.repeat(90) + ' today.'
  const out = tidy(wrapped)
  assert.ok(out.startsWith('I have an urgent role with a State agency in Madison and it is a hybrid position for twelve months.\n\n- one\n- two'), out)
  assert.ok(out.endsWith('See https://track.example/… today.') && !/\[image/.test(out))
  const words = (t) => t.replace(/https?:\S+/g, '').replace(/\[image[^\]]*\]/g, '').split(/\s+/).filter(Boolean)
  assert.deepEqual(words(out), words(wrapped), 'the same words in the same order')
})

test('a link is shown by its name and where it goes, and a staffing system\'s opt-out notice is set aside', () => {
  // The shape of a real recruiter mail read on 12 Oct 2026 (the words here are made up): a signing link with a tail of
  // 400 characters, and a notice under the signature that every mail from that system carries.
  const tail = 'signPDF.jsp?role=0&roleid=' + '1'.repeat(40) + '&enccode=' + 'Ab3'.repeat(60)
  const mail = `Hi,\n\nPlease find the Right to Represent form.\n\n* [RTR_Form_#12345](https://sign.staffing.example/${tail})\n\nBest Regards\nNorthpier Staffing\n\n*You have received this message because either you have contacted our Company or you have posted your resume. You may opt out at anytime by clicking here[](https://sign.staffing.example/optout.jsp?d=${'9'.repeat(70)}).*`
  const body = dropFooter(tidy(mail))
  assert.equal(body.text, 'Hi,\n\nPlease find the Right to Represent form.\n\n* RTR_Form_#12345 (link: sign.staffing.example)\n\nBest Regards\nNorthpier Staffing')
  assert.equal(body.cut, true)
  assert.equal(tidy('> - RTR_Form_#12345\n> <https://sign.staffing.example/' + tail + '>'), '> - RTR_Form_#12345\n> (link: sign.staffing.example)', 'the same link as a reply quotes it: its tail is gone there too')
  assert.equal(tidy('Sign here <https://sign.staffing.example/' + tail + '> today.'), 'Sign here (link: sign.staffing.example) today.')
  assert.equal(tidy('See https://example.com/jobs for more.'), 'See https://example.com/jobs for more.', 'a short link is left as it is')
})

test('a conversation is read oldest first, each message with its own words and who wrote it', () => {
  const r = readThread(THREAD, [ME])
  assert.equal(r.subject, 'Cybersecurity Analyst 220417 || State agency || Madison, WI (Hybrid)', 'the subject without its "Re:"')
  assert.deepEqual(r.messages.map((m) => [m.who, m.mine]), [['Dana Whitfield', false], ['Me', true], ['Dana Whitfield', false]])
  assert.ok(r.messages[1].text.includes("bachelor's") && !r.messages[1].text.includes('wrote:'), 'no code and no quoted history in what is read')
  assert.ok(r.messages[1].earlier.includes('I have an urgent role'), 'the history is kept for "show earlier"')
  assert.ok(r.messages[2].text.startsWith('Thank you. Please confirm the rate of $62/hr on C2C'), 'the latest message says what it says, not its signature')
  assert.deepEqual(sequenceOf(r), { count: 3, first: 1791800000000, last: 1791807200000, lastMine: false })
  const bare = readThread({ threadId: 't2', accountEmail: ME, messages: [{ id: 'x', from: 'A <a@b.example>', subject: 'Hello', snippet: 'Thanks &amp; regards', internalDate: '5' }] }, [ME])
  assert.equal(bare.messages[0].text, 'Thanks & regards', 'with no stored text, Gmail\'s own first line is shown, decoded')
  assert.equal(readThread({ threadId: 't3', accountEmail: ME, messages: Array.from({ length: 20 }, (_, i) => ({ id: 'm' + i, from: 'A <a@b.example>', subject: 's', snippet: 'x', internalDate: String(i) })) }, []).messages.length, 12)
})

test('the numbers and addresses to reach them are the ones THEY wrote', () => {
  const c = contactsOf(readThread(THREAD, [ME]))
  assert.deepEqual(c.phones, [{ number: '(608) 555-0142 ext. 204', who: 'Dana Whitfield' }, { number: '(608) 555-0199', who: 'Dana Whitfield' }])
  assert.deepEqual(c.emails.map((e) => e.email), ['dana.whitfield@northpier-staffing.example'])
  assert.ok(!JSON.stringify(c).includes('555-010-7788') && !JSON.stringify(c).includes('5550107788') && !JSON.stringify(c).includes(ME), 'never the person\'s own number or address')
  const none = contactsOf({ subject: '', messages: [{ id: '1', who: 'A', email: 'a@b.example', mine: false, at: 0, text: 'Job 166719, posted 10/12/2026, pay 62.50, ref 2204170098765.', earlier: '', footer: false }] })
  assert.deepEqual(none.phones, [], 'a job number, a date and a long reference are not phone numbers')
})

test('an ask is open only if they made it after you last wrote', () => {
  // Measured on the owner's inboxes, 12 Oct 2026: 39 emails were listed as "need your reply"; in 30 the last word was his.
  const m = (from, at, category) => ({ from, internalDate: String(at), category })
  const asked = m('Dana <dana@x.example>', 1, 'RTR Request'), mine = m(`Me <${ME}>`, 2, 'General Correspondence'), thanks = m('Dana <dana@x.example>', 3, 'Submission Confirmation'), again = m('Dana <dana@x.example>', 4, 'Rate Confirmation')
  assert.deepEqual([turnOf([asked], [ME]).lastMine, turnOf([asked], [ME]).since.length], [false, 1], 'never answered: it is your turn')
  assert.deepEqual([turnOf([asked, mine], [ME]).lastMine, turnOf([asked, mine], [ME]).since.length], [true, 0], 'you answered: their turn, nothing open')
  assert.deepEqual(turnOf([asked, mine, thanks], [ME]).since.map((x) => x.category), ['Submission Confirmation'], 'a thank-you after your answer is not a new ask')
  assert.deepEqual(turnOf([again, asked, thanks, mine].sort(() => 0.5 - Math.random()), [ME]).since.map((x) => x.category), ['Submission Confirmation', 'Rate Confirmation'], 'read in the order it was written, however it arrives')
  assert.deepEqual(turnOf([], [ME]), { lastMine: false, myLastAt: 0, since: [] })
  // The server uses exactly this to decide "your turn" and "you wrote last".
  const lib = read('src/app/api/gmail/_lib.ts')
  assert.match(lib, /const turn = turnOf\(t\.messages, \[t\.accountEmail\]\)/)
  assert.match(lib, /yourTurn: !!askKind\(pendingAsk\?\.category\)/); assert.match(lib, /lastMine: turn\.lastMine/)
})

test('"no news yet, I will follow up" leaves the turn with them', async () => {
  // Read on the owner's mail, 12 Oct 2026: the first mail under "Your turn" was a recruiter saying there was no update.
  const { saysWaitForUs } = await import('../../src/lib/mail-reading.ts')
  assert.equal(saysWaitForUs("Hi,\n\nWe haven't received any updates regarding this role yet. I will follow up and provide you with an update as soon as I receive one.\nThank you!"), true)
  assert.equal(saysWaitForUs('No update yet from the client. We will keep you posted.'), true)
  assert.equal(saysWaitForUs('Still awaiting feedback from the manager.'), true)
  assert.equal(saysWaitForUs('I will follow up with the client. Could you send your updated resume?'), false, 'one question and it is an ask')
  assert.equal(saysWaitForUs('No update yet. Please confirm your rate in the meantime.'), false)
  assert.equal(saysWaitForUs('Please sign the attached Right to Represent.'), false)
  assert.equal(saysWaitForUs('I will let you know.\n\nOn Mon, Oct 12, 2026 at 9:14 AM Me <me@example.com> wrote:\n> Could you confirm?'), true, 'a question in the quoted history is not theirs')
  assert.equal(saysWaitForUs(''), false)
  const lib = read('src/app/api/gmail/_lib.ts')
  assert.match(lib, /&& !saysWaitForUs\(turn\.since\[turn\.since\.length - 1\]\?\.bodyText/)
  assert.equal(tidy('Reach me at dana@site.example<mailto:dana@site.example> or call.'), 'Reach me at dana@site.example or call.', 'an address written twice by a mail program is shown once')
  assert.match(read('src/app/dashboard/mail/_components/mail-row.tsx'), /decodeEntities\(m\.preview\)\.replace\(\/\[_=\*~-\]\{4,\}\/g, " "\)/, 'a row of underscores is not how a mail begins')
})

test('a row says what the mail is about in the words a person would use: the job', () => {
  // The shapes of real subject lines on those inboxes; the words are made up.
  assert.equal(aboutOf('Re: Urgent Hiring II Cybersecurity Analyst 220417 II State agency - Department of Records II Madison, WI (HYBRID)'), 'Cybersecurity Analyst')
  assert.equal(aboutOf('Details required for submission !! Sr. Security Engineer #44310 at Atlanta GA for Northwind Air'), 'Sr. Security Engineer')
  assert.equal(aboutOf('DFI - Security Analyst II ( 220417) ---- RTR &amp; On-site Requirement Acknowledgement'), 'Security Analyst II', 'a grade is not a divider, and the request number goes')
  assert.equal(aboutOf('Fwd: Immediate need: IAM Architect (C2C)'), 'IAM Architect')
  assert.equal(aboutOf('Senior IAM Engineer'), 'Senior IAM Engineer')
  // Two real shapes read on his mail on 12 Oct that the first version got wrong ("SRE", "-Network Security Analyst 1").
  assert.equal(aboutOf('Interview Slots Available - SRE With Java Experience -100% Remote (Fulltime)'), 'SRE With Java Experience')
  assert.equal(aboutOf('Jordan Rivera - 220417 -Network Security Analyst 1 - Austin, TX - State Health Commission'), 'Network Security Analyst 1')
  assert.equal(aboutOf('On-site Security Engineer - Denver'), 'On-site Security Engineer', 'a hyphen inside a word is not a divider')
  assert.equal(aboutOf('RTR Confirmation_State Of Wisconsin'), 'RTR Confirmation State Of Wisconsin', 'no job named: the subject, tidied')
  assert.equal(aboutOf('Northwind - Right to Represent - Please respond ASAP'), 'Northwind - Right to Represent - Please respond ASAP')
  assert.equal(aboutOf(''), ''); assert.ok(aboutOf('x'.repeat(200)).length <= 78)
})

test('the inbox is three piles by whose turn it is, and the number in the heading is the true one', () => {
  const page = read('src/app/dashboard/mail/page.tsx'), row = read('src/app/dashboard/mail/_components/mail-row.tsx')
  assert.match(page, /const waiting = \(x: Mail\) => \(x\.yourTurn \?\? !!x\.needsReply\) && !answered\.includes\(x\.id\)/, 'your turn is what the server found open, not every thread that ever held an ask')
  assert.match(page, /const theirsList = live\.filter\(x => !!x\.lastMine && !waiting\(x\)\)/)
  assert.match(page, /\["needs", "Your turn", needsList\.length\],\s*\["theirs", "Their turn", theirsList\.length\],\s*\["all", "Everything", live\.length\],/)
  assert.match(page, /\["roles", "By role", roles\.length\],\s*\["drafts", "Drafts", drafts\.length\],\s*\["waiting", "No answer yet", radar\.length\],/, 'the other three ways of looking wait behind "More"')
  assert.ok(/\{more \? "Less" : "More"\}/.test(page) && /waiting on you\./.test(page) && !/emails need"\} your reply/.test(page))
  assert.ok(/aboutOf\(m\.role\) \|\| decodeEntities\(m\.role\)/.test(row) && /m\.lastMine \? `You wrote last/.test(row), 'a row names the job, and says when the last word was yours')
  // The two other pages that list what needs a reply use the same answer.
  assert.match(read('src/app/dashboard/today/page.tsx'), /mails\.filter\(m => m\.needsReply && m\.yourTurn !== false\)/)
  assert.match(read('src/app/dashboard/workflows/page.tsx'), /if \(!m\.needsReply \|\| m\.yourTurn === false\) continue/)
})

test('the page reads first: the title comes before any control, and a row is one line each', () => {
  const page = read('src/app/dashboard/mail/page.tsx'), row = read('src/app/dashboard/mail/_components/mail-row.tsx'), pane = read('src/app/dashboard/mail/_components/reading-pane.tsx')
  // The ignore bar used to be the first thing on the page, above the title, and a bare tick box hung beside every row.
  assert.ok(page.indexOf('<header className="mf-home-heading">') < page.indexOf('<IgnoreControls'), 'the title first')
  // They also step aside while a search is on: they work on the pile's list, not on what a search found.
  assert.match(page, /\{\(tidying \|\| showIgnored\) && !search\.active && \(\s*<>\s*<IgnoreControls/, 'the ignore controls wait behind "Tidy up"')
  assert.match(page, /\{\(tidying \|\| showIgnored\) && !search\.active && \(\s*<input type="checkbox"/, 'and so do the tick boxes')
  assert.match(page, /\{showIgnored && !search\.active && \(/, 'no "Bring it back" on a search result that is not hidden')
  assert.match(page, /<ReadingPane key=\{`\$\{m\.account\}:\$\{m\.id\}`\}/, 'the conversation is read in the reading pane')
  assert.ok(!/<p [^>]*>\{m\.preview\}<\/p>/.test(page) && !/\{m\.from\} · \{m\.fromEmail\}/.test(page), 'no bare snippet and no raw "Name <address>" header in the pane')
  // The three sample forms said things nobody had checked. They are not shown.
  assert.ok(!/<RtrReply m=|<AvailabilityReply m=|<RateReply m=/.test(page.slice(page.indexOf('export default function MailPage'))))
  // Five uses for four lines: the third line is either how the mail begins or, after a search, where the searched word stands.
  assert.equal((row.match(/\.\.\.oneLine/g) || []).length, 5, 'who, what about, how it begins (or where the searched word is), where from: one line each')
  assert.match(row, /\{found \? \(\s*<div style=\{\{ \.\.\.oneLine/)
  assert.ok(/decodeEntities\(m\.role\)/.test(row) && /decodeEntities\(m\.preview\)/.test(row), 'no "&amp;" or "&#39;" in a row')
  assert.ok(!/var\(--text-soft\)/.test(row + pane), 'small text is the readable grey: the soft grey measured 3.6 to 1 on a chosen row')
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test((row + pane).replace(/&#\d+;|#all\/|#44310|#12345/g, '')), 'colours come from the theme')
})

test('the reading pane says in one sentence who wants what, and offers three things to do', async () => {
  const pane = read('src/app/dashboard/mail/_components/reading-pane.tsx')
  // The sentence is worked out from the stage, never written by a model. The function is checked here by its own text.
  const body = pane.slice(pane.indexOf('export function narrate'), pane.indexOf('type Panel'))
  const narrate = new Function('m', 'first', 'youWroteLast', body.slice(body.indexOf('{') + 1, body.lastIndexOf('}')).replace(/: string/g, ''))
  assert.equal(narrate({ needsReply: 'rtr', stage: 'rtr' }, 'Dana', false), 'Dana wants your go-ahead to put you forward for this job (a Right to Represent).')
  assert.equal(narrate({ needsReply: 'availability', stage: 'invite' }, 'Lena', false), 'Lena wants to set up an interview and is waiting for your times.')
  assert.equal(narrate({ needsReply: 'rate', stage: 'rate', rate: '$62/hr C2C' }, 'Omar', false), 'Omar wants you to confirm the pay rate of $62/hr C2C.')
  assert.equal(narrate({ needsReply: 'rtr', stage: 'rtr' }, 'Dana', true), 'You answered Dana. Now it is their turn.')
  assert.equal(narrate({ stage: 'rejected' }, 'Sam', false), 'Sam says this one is not going ahead. Nothing to do.')
  assert.equal(narrate({ stage: 'invite', when: 'Thu 2:00 PM' }, 'Lena', false), 'Your interview is set: Thu 2:00 PM.')
  assert.equal(narrate({ stage: 'applied' }, 'Talent', false), 'Talent is keeping you posted. Nothing is being asked of you yet.')
  for (const text of ['"Reply"', '`History (${seq.count})`', '"Contact and details"']) assert.ok(pane.includes(text), text)
  assert.match(pane, /fetch\(`\/api\/gmail\/reading\?id=\$\{encodeURIComponent\(m\.id\)\}&account=\$\{encodeURIComponent\(m\.account\)\}`\)/)
  assert.match(pane, /href=\{`tel:/); assert.match(pane, /href=\{`mailto:/); assert.match(pane, /Open the original in Gmail/)
})

test('the endpoint reads the kept copy of one conversation and makes no call to Gmail for it', () => {
  const route = read('src/app/api/gmail/reading/route.ts')
  assert.match(route, /from\("mfit_gmail_threads"\)\.select\("data, account_email"\)\.eq\("user_id", ctx\.userId\)\.eq\("thread_id", id\)/)
  assert.ok(route.indexOf('mfit_gmail_threads') < route.indexOf('fetchClassifiedThreads(ctx.userId'), 'the kept copy first; the list\'s own fetch only when it is not there')
  assert.match(route, /requireAuth\(\)/); assert.match(route, /checkRateLimit\(`gmail-reading:/)
  assert.match(route, /readThread\(thread, mine\)/)
})

// ── Found by the review of 12 Oct 2026, each with the case that failed ───────────────────────────────────────────────

test('one email with a very long run of spaces cannot stall the page that reads it', async () => {
  // Measured before the fix: "a" + 40,000 spaces + "b" took 2.7 s to tidy, and 99,000 spaces then a full stop took 16 s.
  // A body is kept up to 100,000 characters, anyone can send one, and the inbox search tidies every kept message.
  const bodies = ['a' + ' '.repeat(40000) + 'b', 'a' + ' '.repeat(99000) + '.', 'a' + ' \t'.repeat(49000) + 'b\nnext', ('word' + ' '.repeat(900) + 'x\n').repeat(100), 'a' + ' '.repeat(50000) + '\n' + ' '.repeat(49000) + 'b', 'a ' + '<'.repeat(50000), '['.repeat(50000) + 'x', 'On '.repeat(30000) + 'x', '_'.repeat(90000) + ' x', '>'.repeat(90000)]
  const t0 = performance.now()
  for (const body of bodies) dropFooter(tidy(splitQuoted(body).said))
  const took = performance.now() - t0
  assert.ok(took < 1500, 'ten such bodies took ' + Math.round(took) + ' ms')
  // And the two rewritten patterns still do what they did.
  assert.equal(tidy('Sign the form   \n <https://site.example/a-very-long-tail>  \nThanks   '), 'Sign the form (link: site.example)\nThanks')
  assert.equal(tidy('Sign here <https://site.example/x> and reply\t\t'), 'Sign here (link: site.example) and reply')
  assert.equal(tidy('one   \ntwo\t \n   three'), 'one\ntwo\n   three', 'spaces at the end of a line go; spaces at its start stay')
})

test('what the writer typed is told apart from a reply with nothing typed in it', async () => {
  const { ownPart } = await import('../../src/lib/mail-reading.ts')
  assert.equal(ownPart(THREAD.messages[1].bodyText), splitQuoted(THREAD.messages[1].bodyText).said)
  const forward = '---------- Forwarded message ---------\nFrom: Someone\nThe role is open.'
  assert.equal(ownPart(forward), '', 'a bare forward: none of it was typed by the sender')
  assert.equal(splitQuoted(forward).said, forward, 'the reading pane still shows it, so there is something to read')
  assert.equal(ownPart('On Mon, Oct 5, 2026 at 9:12 AM Dana <dana@x.example> wrote:\n> Please send your resume.'), '')
  assert.equal(ownPart('Just a note.'), 'Just a note.')
  assert.equal(ownPart(''), '')
})

test('a rule to hide a sender matches the row it was made for, display name and all', async () => {
  const { ignoreReason, validIgnoreRule } = await import('../../src/lib/gmail-ignore.ts')
  const row = { account: ME, id: 't9', fromEmail: 'Vik Rao <Vik@Blastmail.example>', subject: 'Java Developer', preview: 'Hot requirement', stage: 'new' }
  const sender = { account: ME, kind: 'sender', value: 'vik@blastmail.example' }, domain = { account: ME, kind: 'domain', value: 'blastmail.example' }
  assert.equal(validIgnoreRule(sender) && validIgnoreRule(domain), true)
  // Until this fix the whole From line was compared with the address, so both of these were null: the inbox went on
  // showing the sender, and the page that hid them said they were hidden.
  assert.equal(ignoreReason(row, [sender]), 'Your sender rule: vik@blastmail.example')
  assert.equal(ignoreReason(row, [domain]), 'Your domain rule: blastmail.example')
  assert.equal(ignoreReason({ ...row, fromEmail: 'vik@blastmail.example' }, [sender]), 'Your sender rule: vik@blastmail.example')
  assert.equal(ignoreReason({ ...row, fromEmail: 'Someone Else <else@other.example>' }, [sender, domain]), null)
  assert.equal(ignoreReason(row, [{ ...sender, account: 'another@example.com' }]), null, 'a rule belongs to one inbox')
  assert.equal(ignoreReason(row, [sender, { account: ME, kind: 'thread', value: 't9', action: 'allow' }]), null, '"Bring it back" still wins for that one conversation')
  // The inbox's own Tidy up built its rules from the whole line too: "vik rao <vik@...>" has a space and the server
  // refused it; the domain ended in ">". It now takes the address out first.
  const controls = read('src/app/dashboard/mail/_components/ignore-controls.tsx')
  assert.match(controls, /kind === "sender" \? senderEmail\(m\.fromEmail\) : senderEmail\(m\.fromEmail\)\.split\("@"\)\[1\]/)
  assert.doesNotMatch(controls, /m\.fromEmail\.toLowerCase\(\)/)
  assert.equal(validIgnoreRule({ account: ME, kind: 'sender', value: senderEmail('Vik Rao <Vik@Blastmail.example>') }), true)
  assert.equal(validIgnoreRule({ account: ME, kind: 'sender', value: 'vik rao <vik@blastmail.example>' }), false, 'what it used to send')
})

test('a search with one inbox chosen is counted in that inbox, and a conversation asked for by its address is shown', () => {
  const page = read('src/app/dashboard/mail/page.tsx'), bar = read('src/app/dashboard/mail/_components/mail-search.tsx'), route = read('src/app/api/gmail/search/route.ts')
  // The inbox goes with the search and is applied on the server before anything is counted or cut to the newest 60.
  assert.match(page, /useMailSearch\(mails, account === "all" \? "" : account\)/)
  assert.match(bar, /body: JSON\.stringify\(\{ q: typed, tz, account: inbox \}\)/)
  assert.match(bar, /answer\.q === typed && answer\.inbox === inbox/, 'an answer for another inbox is not shown as this one\'s')
  assert.ok(route.indexOf('r.thread.accountEmail.toLowerCase() === account') < route.indexOf('const found = all.filter'), 'the inbox first, then the count')
  assert.match(route, /searched: all\.length, count: found\.length/)
  // A reply quotes every message before it: each line is made searchable once, and all of it, not the first 6,000 characters.
  assert.match(route, /const seen = new Set<string>\(\)/)
  assert.doesNotMatch(route, /slice\(0, 6000\)/)
  // The same work for the same person is not started twice while it is under way.
  assert.match(route, /const under = making\.get\(key\)\s*if \(under\) return under/)
  // While still looking, with nothing on the page itself, no number is said.
  assert.match(bar, /\{!\(n === 0 && search\.pending\) && \(/)
  // ?open=<conversation>: brought into view, and shown even when the list does not hold it (filed, or its sender hidden).
  assert.match(page, /const wantedIsHere = !!wanted && mails\.some\(x => x\.id === wanted\)/)
  assert.match(page, /setSel\(wanted\); setOpened\(wanted\); setView\("all"\); setWanted\(null\)\s*setTimeout\(\(\) => document\.getElementById\("reply"\)\?\.scrollIntoView/)
  assert.match(page, /shown\.find\(x => x\.id === sel\) \?\? \(sel && sel === opened \? mails\.find\(x => x\.id === sel\) : undefined\) \?\? shown\[0\]/)
})
