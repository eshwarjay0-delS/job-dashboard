// The Chief's brief (owner, 23 Oct 2026): one rule and four lines the Chief reads before every job — Me, My candidates,
// My voice (two lines in his words), Never — and a never-contact list kept as his data, not in this public code. Set and
// shown on WhatsApp ("brief") or with the chief_brief tool; every Chief prompt starts from it.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
  const module = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8')
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process, console, Intl, Date,
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return module.exports
}
const store = new Map()
const blob = { getText: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v) }, delete: async k => { store.delete(k) }, putIfAbsent: async (k, v) => { if (store.has(k)) return false; store.set(k, v); return true } }
const B = load('src/lib/chief-brief.ts', { '@/lib/storage': { blob } })
const src = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

test('an unwritten brief is his one rule and the Never that always holds, and says the rest is not written', () => {
  const block = B.briefBlock(null)
  assert.match(block, /^THE USER'S BRIEF/)
  assert.ok(block.includes('Public data only') && block.includes('Never auto-send anything') && block.includes("Never invent what's not on my resume") && block.includes('Report to me in plain words'))
  assert.ok(block.includes(B.NEVER_ALWAYS))
  assert.match(block, /Me: \(not written yet\)/)
  assert.match(block, /Never contact .*\(none listed\)/)
})

test('the four lines are read from what he types, the voice keeps two lines, and a stray line is handed back', () => {
  const { patch, unread } = B.parseBriefText([
    'brief',
    'Me: C2C cybersecurity contractor, Houston',
    'My candidates: my two profiles, never mixed',
    'My voice: Hello, following up on our call.',
    'Thank you for your time.',
    'A third voice line is too many.',
    'Never: commit to a start date',
    'Never contact: example-staffing.com, Example Firm; jane@example.org',
  ].join('\n'))
  assert.equal(patch.me, 'C2C cybersecurity contractor, Houston')
  assert.equal(patch.people, 'my two profiles, never mixed')
  assert.equal(patch.voice, 'Hello, following up on our call.\nThank you for your time.')
  assert.equal(patch.never, 'commit to a start date')
  assert.deepEqual([...patch.neverContact], ['example-staffing.com', 'Example Firm', 'jane@example.org'])
  assert.deepEqual([...unread], [])
  assert.deepEqual([...B.parseBriefText('hello there').unread], ['hello there'])
})

test('the brief never keeps an identity number, a password or a date of birth', () => {
  assert.match(B.screenBrief({ me: 'SSN 123-45-6789' }), /social security/)
  assert.match(B.screenBrief({ never: 'my password is x' }), /password/)
  assert.match(B.screenBrief({ me: 'DOB 1 Jan' }), /date of birth/)
  assert.equal(B.screenBrief({ me: 'Security engineer' }), '')
})

test('kept with his account: written, read back, merged line by line, and his Never always carries the default', async () => {
  const first = await B.writeBrief('user-1', B.mergeBrief(await B.readBrief('user-1'), { me: 'Contractor', neverContact: ['example-staffing.com'] }, 1))
  assert.equal(first.rule, B.ONE_RULE)
  const second = await B.writeBrief('user-1', B.mergeBrief(await B.readBrief('user-1'), { never: 'sign an RTR' }, 2))
  assert.equal(second.me, 'Contractor')
  assert.deepEqual([...second.neverContact], ['example-staffing.com'])
  assert.match(B.briefBlock(second), /Never without my yes: sign an RTR; and always: contact anyone, send, post, pay, or commit to a rate/)
  assert.equal((await B.readBrief('someone-else')).me, '', 'one person\'s brief is never another\'s')
  assert.match(B.briefShowText(second), /\*Never contact:\* example-staffing\.com/)
})

test('every Chief prompt starts from the brief: the chat, and the goal proposal', () => {
  assert.ok(B.startFromBrief({ me: 'Contractor' }, 'JOB').startsWith("THE USER'S BRIEF"))
  assert.ok(B.startFromBrief({ me: 'Contractor' }, 'JOB').endsWith('JOB'))
  const chat = src('src/app/api/agent/chat/route.ts')
  assert.match(chat, /const system = startFromBrief\(await readBrief\(user\.id\), `\$\{chiefSystemPrompt\(owner\)\}/)
  assert.match(src('src/lib/chief-goal.ts'), /return startFromBrief\(brief, \[/)
})

test('set and shown with the chief_brief tool and on WhatsApp; the never-contact list is read from his brief, never written in code', () => {
  const tools = src('src/app/api/agent/_tools.ts')
  assert.match(tools, /chief_brief: \{/)
  assert.match(src('src/lib/chief-commands.ts'), /\^\(\?:my\\s\+\)\?brief/)
  // Every check of the list takes it from the person's brief.
  assert.match(tools, /neverContactHit\(brief\.neverContact, to/)
  assert.match(tools, /neverContact: brief\.neverContact/)
  assert.match(src('src/app/api/whatsapp/webhook/route.ts'), /neverContactHit\(\(await readBrief\(userId\)\)\.neverContact, card\.toEmail\)/)
})
