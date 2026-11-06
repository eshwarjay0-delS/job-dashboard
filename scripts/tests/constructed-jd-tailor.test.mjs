// Constructed-JD tailor. Two pre-edit passes become the JD. Coverage at or under 95
// runs one more generate-then-tailor pass. Experience shape stays. Overflow terms
// sit on the labelled skills line, and that placement is not the old "not in your resume" refusal.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../..', import.meta.url))
const read = (p) => readFileSync(path.join(root, p), 'utf8')
const tailor = read('src/lib/tailor.ts')
const claude = read('src/lib/claude.ts')

test('two pre-edit passes are summed into the JD before any draft', () => {
  assert.match(tailor, /generateRelatedMaterialTwice/)
  assert.ok(tailor.indexOf('generateRelatedMaterialTwice') < tailor.indexOf('const draftPass'))
  assert.match(tailor, /if \(expanded\.constructedJd\) jd = expanded\.constructedJd/)
  assert.match(tailor, /const scoreKws = floorTerms\(jd, targetKeywords\(jdExtracted, jdGenerated, jd\)\)/)
  assert.match(tailor, /coverageNeedsAnotherPass\(coveragePercent\(shareOf\(best\.afterKw\)\)\)/)
  assert.doesNotMatch(tailor, /deadline - Date\.now\(\) >= 8000/)
  assert.match(tailor, /weaveExperienceRepresentation/)
  const weaveAt = tailor.indexOf('const woven = weaveExperienceRepresentation')
  assert.ok(weaveAt > 0)
  assert.match(tailor.slice(weaveAt - 900, weaveAt), /bulletText/)
  assert.doesNotMatch(tailor.slice(weaveAt - 900, weaveAt), /afterKw\.has/)
  assert.match(tailor, /extraPassReserveMs/)
  assert.match(tailor, /Write every known JD term into the current role and the previous roles/)
  assert.match(read('src/lib/claude.ts'), /Write the known JD tools into EVERY role/)
  assert.match(tailor, /generateRelatedPass\(/)
  assert.match(tailor, /placeConstructedOverflow/)
  assert.match(tailor, /added: \[\]/)
  assert.match(claude, /PRE-edit|BEFORE any editing/)
  assert.match(claude, /const second = await generateRelatedPass/)
})

test('known JD terms belong in existing project bullets, and a new employer or date does not', () => {
  assert.match(tailor, /unverifiedClaims\(/)
  const source = read('src/lib/constructed-jd.ts')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  const keywordTargets = ts.transpileModule(read('src/lib/keyword-targets.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const quality = ts.transpileModule(read('src/lib/resume-quality.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const kt = {}, q = {}
  runInNewContext(keywordTargets, { exports: kt, module: { exports: kt } })
  runInNewContext(quality, { exports: q, module: { exports: q } })
  runInNewContext(js, {
    exports, module: { exports },
    require: (id) => id.includes('keyword-targets') ? kt : q,
  })
  assert.equal(exports.PRE_EDIT_PASSES, 2)
  assert.equal(exports.coverageNeedsAnotherPass(95), true)
  assert.equal(exports.coverageNeedsAnotherPass(95.1), false)
  assert.equal(exports.coverageNeedsAnotherPass(30.8), true)
  const passes = [
    exports.parseRelatedPass({ skills: ['Illumio', 'Zscaler'], experiences: ['access reviews'], points: ['orphaned accounts'], bullets: ['Monitored Splunk'], skillLines: ['Security Operations: Splunk, Illumio'], summary: 'Analyst who uses Splunk and Okta.' }),
    exports.parseRelatedPass({ skills: ['ZTNA', 'micro-segmentation'], summary: 'Zero trust work.' }),
  ]
  const jd = exports.constructJd('Monitor Splunk and Okta.', passes)
  assert.match(jd, /Monitor Splunk and Okta/)
  assert.match(jd.toLowerCase(), /illumio/)
  assert.match(jd.toLowerCase(), /micro-segmentation/)
  assert.equal(JSON.stringify(exports.unverifiedClaims(['illumio', 'zscaler'], ['illumio'], () => false)), JSON.stringify([]))
  assert.equal(JSON.stringify(exports.unverifiedClaims(['zscaler inc'], [], () => true)), JSON.stringify(['zscaler inc']))
  assert.equal(exports.inventedExperienceFrame('Administered Okta for the bank.', 'Administered Okta for Zscaler Inc in 2030.'), true)
  assert.equal(exports.inventedExperienceFrame('Administered Okta for the bank.', 'Administered Okta and SailPoint for the bank.'), false)
  const woven = exports.weaveExperienceRepresentation(
    [{ bullets: [{ idx: 1, text: 'Lead identity analyst for the bank access program.' }, { idx: 2, text: '• Administered role-based access across Okta and Azure AD, cutting orphaned accounts by 40%.' }, { idx: 3, text: 'Environments: Okta, Splunk' }] },
     { bullets: [{ idx: 4, text: 'Supported workforce identity for the earlier client.' }, { idx: 5, text: '• Onboarded business applications and documented approval workflows.' }] }],
    [],
    ['SailPoint', 'CyberArk', 'problem solving'],
  )
  const project = woven.bullets.map(b => b.text).join('\n')
  assert.match(project, /SailPoint/)
  assert.match(project, /CyberArk/)
  assert.match(project, /problem solving/)
  assert.equal(woven.bullets.some(b => b.idx === 3), false)
  assert.equal(woven.bullets.length, 3)
  assert.match(project, /, using /)
  assert.equal(exports.inventedExperienceFrame('• Administered Okta.', woven.bullets.find(b => /SailPoint/.test(b.text)).text), false)
  const line = exports.labelledSkillEdit([{ idx: 3, text: 'Security Operations: Splunk' }], ['Illumio', 'ZTNA'])
  assert.match(line.text, /Job-post terms: Illumio, ZTNA/)
  assert.match(line.text, /^Security Operations:/)
  const env = exports.keepEnvironmentsLabel('Environments: Okta, Splunk', 'Okta only')
  assert.match(env, /^Environments:/)
  const groups = exports.experienceFrame('PROFESSIONAL EXPERIENCE\nAnalyst | Acme | Dallas, TX | Jan 2022 – Present\nLead line for this role in the bank.\n• One bullet here with enough words.\nEnvironments: Okta\nEDUCATION\nBS')
  assert.equal(groups.length, 1)
  assert.equal(groups[0].paragraphs, 3)
  assert.equal(groups[0].environments, 1)
})

test('Gemini is asked twice before editing, and the second pass sees the first', async () => {
  const calls = []
  const replies = [
    JSON.stringify({ skills: ['Illumio', 'micro-segmentation'], experiences: ['access reviews'], points: ['alerts'], bullets: ['Tuned Splunk detections'], skillLines: ['Security: Splunk, Illumio'], summary: 'Analyst monitoring Splunk.' }),
    JSON.stringify({ skills: ['Zscaler', 'ZTNA'], experiences: [], points: [], bullets: [], skillLines: [], summary: 'Zero trust analyst.' }),
  ]
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const loaded = { exports: {} }
    const js = ts.transpileModule(readFileSync(path.join(root, 'src/lib', file + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    runInNewContext(js, { module: loaded, exports: loaded.exports, console, process, setTimeout, clearTimeout,
      require: (id) => {
        if (id === './llm' || id.endsWith('/llm')) return { callLLM: async (opts) => { calls.push(opts); return { text: replies.shift() || '[]' } } }
        if (id === './ai/jev') return {}
        if (id === './ai/j1') return { J1_HEADER: '', constrainResumeEdits: (e) => e }
        if (id === './docx') return {}
        return load(id.replace(/^\.\//, '').replace(/\.ts$/, ''))
      },
    })
    cache.set(file, loaded.exports)
    return loaded.exports
  }
  const material = await load('claude').generateRelatedMaterialTwice({
    keys: { gemini: 'test-key' }, jd: 'Monitor Splunk.', sourceResume: 'Used Splunk and Okta at Acme.',
    candidateInput: 'I used Splunk at Acme Bank.', timeoutMs: 1000,
  })
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.equal(call.pref, 'gemini')
    assert.match(call.system, /BEFORE any editing/)
    assert.match(call.system, /Never invent an employer/)
    assert.match(call.user, /Used Splunk and Okta at Acme/)
  }
  assert.match(calls[1].user, /ALREADY CAPTURED/)
  assert.match(calls[1].user, /illumio/)
  assert.ok(material.keywords.includes('illumio'))
  assert.ok(material.keywords.includes('zscaler'))
  assert.equal(material.passes.length, 2)
})

test('a representative file stays at or above 95% without a new employer or a new experience row', () => {
  const hooks = pathToFileURL(path.join(root, 'scripts/tests/helpers/ts-alias-hooks.mjs')).href
  const run = fileURLToPath(new URL('./helpers/constructed-jd-run.mjs', import.meta.url))
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'mf-cjd-'))
  try {
    const r = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', '--import', hooks, run], {
      cwd, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, PROJECT_DIR: root },
      encoding: 'utf8', timeout: 120000,
    })
    const line = (r.stdout || '').trim().split('\n').filter(s => s.startsWith('{')).pop()
    assert.ok(line, (r.stderr || '').slice(-2000) || r.stdout)
    const out = JSON.parse(line)
    assert.equal(out.generations, 3)
    assert.equal(out.tailorPasses, 2)
    assert.equal(out.needsExtra, true)
    assert.equal(out.firstJdHasPost, true)
    assert.equal(out.firstJdHasSum, true)
    assert.ok(out.coverageBefore <= 95, `first score ${out.coverageBefore} on ${out.coverageBeforeTotal} terms`)
    assert.ok(out.coverageAfter > 95, `final score ${out.coverageAfter}; missing ${out.missing.join(', ')}`)
    assert.equal(out.framesEqual, true, JSON.stringify({ before: out.frameBefore, after: out.frameAfter }))
    assert.equal(out.lacking, 0)
    assert.ok(out.changedBullets >= 2)
    assert.equal(out.bulletCountBefore, out.bulletCountAfter)
    assert.ok(out.inBullets.some(t => /illumio/i.test(t)), `Illumio should be in a project bullet, got ${out.inBullets.join(', ')}`)
    assert.ok(out.inBullets.some(t => /zscaler/i.test(t)))
    assert.equal(out.labelInFile, true)
    assert.equal(out.email, 'jordan.test@example.com')
    assert.equal(out.inventedEmployer, false)
    assert.equal(out.inventedDate, false)
    assert.ok(out.fileBytes > 500)
    assert.equal(out.atsPassed, true, out.atsIssues.join('; '))
    assert.equal(out.web, true, out.webReasons.join(', '))
    assert.equal(out.whatsApp, true, out.webReasons.join(', '))
    assert.ok(out.inBullets.length >= 4, `project bullets should carry the constructed JD, got ${out.inBullets.join(', ')}`)
    assert.ok(!out.blockers.includes('roles_unrewritten'))
    assert.ok(!out.blockers.includes('unverified_jd_terms'))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
