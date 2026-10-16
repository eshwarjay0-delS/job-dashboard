import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function harness(reply) {
  const calls = []
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const module = { exports: {} }
    const source = readFileSync(new URL('../../src/lib/' + file + '.ts', import.meta.url), 'utf8')
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    runInNewContext(js, { module, exports: module.exports, console, process, setTimeout, clearTimeout,
      require: id => {
        if (id === './llm') return { callLLM: async opts => {
          calls.push(opts)
          return { text: JSON.stringify(reply || { summary: '', skills: [{ idx: 2, text: 'Microsoft Sentinel, Python' }], bullets: [{ idx: 10, text: 'Tuned Microsoft Sentinel detections.' }, { idx: 20, text: 'Automated log analysis with Python.' }] }) }
        } }
        if (id === './ai/jev') return {}
        return load(id.replace(/^\.\//, ''))
      },
    })
    cache.set(file, module.exports)
    return module.exports
  }
  return { adapt: load('claude').adapt, expandTwice: load('claude').expandJdKeywordsTwice, calls }
}
const zones = { summaryText: '', skills: [{ idx: 2, text: 'Security operations' }], roles: [
  { role: 'Analyst at Current Client', current: true, bullets: [{ idx: 10, text: 'Tuned Microsoft Sentinel detections.' }] },
  { role: 'Analyst at Earlier Client', current: false, bullets: [{ idx: 20, text: 'Automated log analysis with Python.' }] },
] }
const base = { keys: {}, jd: 'Security Analyst\nMicrosoft Sentinel and Python', zones, jdKeywords: ['Microsoft Sentinel', 'Python'], preferences: '', mode: 'full' }

test('profile generation receives evidence from current and earlier roles without gaining permission to rewrite their bullets', async () => {
  const h = harness()
  const result = await h.adapt({ ...base, part: 'profile' })
  assert.match(h.calls[0].cacheContext, /Tuned Microsoft Sentinel detections/)
  assert.match(h.calls[0].cacheContext, /Automated log analysis with Python/)
  assert.equal(result.skills.length, 1)
  assert.equal(result.bullets.length, 0)
})

test('an earlier-role pass retains its own edits and cannot change the current role or skills', async () => {
  const h = harness()
  const result = await h.adapt({ ...base, part: 'experience', roles: [1] })
  assert.match(h.calls[0].cacheContext, /\[20\] Automated log analysis with Python/)
  assert.equal(result.bullets.length, 1)
  assert.equal(result.bullets[0].idx, 20)
  assert.equal(result.skills.length, 0)
})


test('locked summary and headline are excluded from both prompt scope and returned edits', async () => {
  const h = harness({ summary: 'Changed summary', headline: { title: 'Changed title' }, skills: [{ idx: 2, text: 'Microsoft Sentinel, Python' }] })
  const result = await h.adapt({ ...base, part: 'profile', sections: { summary: false, headline: false } })
  assert.match(h.calls[0].user, /Summary is LOCKED/)
  assert.match(h.calls[0].user, /Headline is LOCKED/)
  assert.equal(result.summary, '')
  assert.equal(result.headline.title, '')
  assert.match(h.calls[0].system, /retain every existing technical expertise category/)
})


test('keyword review calls Gemini twice and gives first-pass terms to the second pass', async () => {
  const h = harness(['SIEM', 'Microsoft Sentinel', 'siem'])
  const terms = await h.expandTwice({ keys: { gemini: 'test-key', openai: 'must-not-use' }, jd: 'Use Microsoft Sentinel for SIEM monitoring.', known: ['monitoring'], timeoutMs: 100 })
  assert.equal(h.calls.length, 2)
  for (const call of h.calls) {
    assert.equal(call.pref, 'gemini')
    assert.equal(call.keys.openai, undefined)
    assert.match(call.system, /PRECISION/)
  }
  assert.match(h.calls[1].user, /ALREADY CAPTURED.*monitoring, siem, microsoft sentinel/)
  assert.equal(terms.length, 2)
})
