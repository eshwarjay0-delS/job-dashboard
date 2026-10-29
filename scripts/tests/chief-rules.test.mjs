// The Chief's appointment (owner, 19 Oct 2026: "appoint chief with the rules as well"): every user's Chief works under the
// rules, and the owner's own facts (profiles, phone, marketing firms, follow-up letter) reach only his own Chief. Until
// then they were in the prompt every user's Chief was given.
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
    module, exports: module.exports, process, console,
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return module.exports
}
const rules = load('src/lib/agent/chief-rules.ts')
const { chiefSystemPrompt, AGENT_SYSTEM_PROMPT } = load('src/lib/agent/system-prompt.ts', { './chief-rules': rules })
const OWNER_ONLY = ['646-820-3671', 'eshwarjay05@gmail.com', 'jayeshwar44@gmail.com', 'TekBlu', 'CloudQuestIT', 'TeksolveIT', 'Ramireddy', 'Regards, Eshwar']

test('every user\'s Chief works under the appointed rules', () => {
  for (const owner of [false, true]) {
    const prompt = chiefSystemPrompt(owner)
    assert.match(prompt, /CHIEF RULES \(appointed by the owner/)
    for (const r of rules.CHIEF_RULES) assert.ok(prompt.includes(r.rule), r.id)
    assert.match(prompt, /You do the whole job while the user is away/)
    assert.match(prompt, /chief_watch/)
    assert.ok(!prompt.includes('$50 a month') && !prompt.includes('$50,000'), 'the article money is not an instruction')
  }
  assert.ok(rules.CHIEF_RULES.some(r => r.id === 'nothing-without-yes') && rules.CHIEF_RULES.some(r => r.id === 'blank-price'))
  assert.equal(rules.CHIEF_RULES[0].id, 'whole-work-away')
  assert.ok(rules.CHIEF_RULES.some(r => r.id === 'only-voice'))
})

test('the owner\'s own facts reach only his own Chief', () => {
  const someone = chiefSystemPrompt(false)
  for (const fact of OWNER_ONLY) {
    assert.ok(!someone.includes(fact), 'another user\'s Chief must not be told: ' + fact)
    assert.ok(!AGENT_SYSTEM_PROMPT.includes(fact), 'the shared prompt must not hold: ' + fact)
  }
  const his = chiefSystemPrompt(true)
  for (const fact of ['646-820-3671', 'eshwarjay05@gmail.com', 'jayeshwar44@gmail.com', 'TekBlu', 'Regards, Eshwar']) assert.ok(his.includes(fact), fact)
  assert.match(someone, /You do the whole job while the user is away/)
  assert.match(his, /THIS CHAT/)
  assert.ok(!someone.includes("THIS CHAT"), "another user's Chief is not given this chat")
  assert.match(readFileSync(new URL('../../src/app/api/agent/chat/route.ts', import.meta.url), 'utf8'), /chiefSystemPrompt\(owner\)/)
})
