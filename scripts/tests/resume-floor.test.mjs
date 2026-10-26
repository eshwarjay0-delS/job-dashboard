// The resume floor. Owner, 26 Oct 2026, sending two WhatsApp resumes that came back at "JD keyword coverage: 52%" and
// "28.5%" with "This run was cut short before it could add: row-level, row-level security, peoplesoft query manager,
// manager approvals, page, public" and "close-out, f5, isc2, problem solving, adaptability, cisco":
//   "I kept repeating that I want this to be a consistent build. Even if something going wrong until then the baseline is
//    serve atleast 90% match."
// So: the real tailor, on a real .docx, with every AI provider failing, still sends a resume that shows at least 90% of
// the job post's keywords, measured on the Word file itself; the experience bullets stay the candidate's own; nothing
// junk or certification-like is written in; and the reply says plainly which terms came from the job post.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT = fileURLToPath(new URL('../../', import.meta.url))
const HOOKS = pathToFileURL(fileURLToPath(new URL('./helpers/ts-alias-hooks.mjs', import.meta.url))).href
const RUN = fileURLToPath(new URL('./helpers/resume-floor-run.mjs', import.meta.url))
const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')

// One run for every test below: about two seconds, no network (no provider key reaches the child).
const runs = (() => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'mf-floor-'))
  try {
    const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, PROJECT_DIR: PROJECT }
    const r = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', '--import', HOOKS, RUN], { cwd, env, encoding: 'utf8', timeout: 120000 })
    const line = (r.stdout || '').trim().split('\n').pop()
    if (!line || !line.startsWith('{')) throw new Error(`the floor run printed nothing usable: ${(r.stderr || '').slice(-1500)}`)
    return JSON.parse(line)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})()

test('with every AI provider down, both job posts still get a resume showing at least 90% of their keywords, measured on the Word file', () => {
  for (const [name, r] of Object.entries(runs)) {
    assert.ok(r.measured >= 0.9, `${name}: ${(r.measured * 100).toFixed(1)}% on the file (${r.shown.length}/${r.targets.length})`)
    assert.ok(r.coverage >= 90, `${name}: the tailor reports ${r.coverage}%`)
    assert.equal(r.skillsOnly, true, `${name}: said to be the skills section only`)
    assert.ok(r.status !== 'needs_review', `${name}: ${r.status}`)
  }
})

test('the floor never writes the experience: every bullet is the source resume\'s own, and the contact line is untouched', async () => {
  const { RESUME } = await import('./helpers/resume-floor-run.mjs')
  const source = RESUME.filter(l => l.startsWith('•'))
  for (const [name, r] of Object.entries(runs)) {
    assert.deepEqual(r.bullets, source, name)
    assert.equal(r.email, 'jordan.test@example.com', name)
    // A term added to a line keeps the line's formatting: each heading is still its own bold run.
    for (const head of ['Identity & Access Management:', 'Security Operations:', 'Cloud & Scripting:', 'Governance & Compliance:'])
      assert.ok(r.boldHeads.includes(head), `${name}: "${head}" is still bold (${r.boldHeads.join(' | ')})`)
  }
})

test('the keywords are the job post\'s real terms: whole product names, no sentence words, no fragments, no certifications', () => {
  const ps = runs.peoplesoft.targets, zt = runs.zerotrust.targets
  for (const k of ['peoplesoft query manager', 'data mover', 'process scheduler', 'application designer', 'row-level security', 'active directory', 'ldap', 'peopletools'])
    assert.ok(ps.includes(k), 'kept: ' + k)
  for (const k of ['page', 'public', 'row-level', 'mover', 'query', 'scheduler', 'manager approvals'])
    assert.ok(!ps.includes(k), 'not a target: ' + k)
  for (const k of ['f5', 'cisco ise', 'zscaler private access', 'bgp', 'ospf', 'sd-wan', 'palo alto', 'zero trust architecture'])
    assert.ok(zt.includes(k), 'kept: ' + k)
  for (const k of ['isc2', 'cissp', 'close-out', 'enterprise network zero trust', 'trust architecture'])
    assert.ok(!zt.includes(k), 'not a target: ' + k)
  for (const r of Object.values(runs)) assert.ok(!r.skills.some(l => /cissp|isc2/i.test(l)), 'no certification is written in')
})

test('placed terms go where they belong: access terms with access, network terms together, strengths in the summary', () => {
  const line = (r, head) => r.skills.find(l => l.startsWith(head)) || ''
  const ps = runs.peoplesoft, zt = runs.zerotrust
  for (const k of ['Active Directory', 'LDAP', 'row-level security']) assert.ok(line(ps, 'Identity & Access').includes(k), k + ' in: ' + line(ps, 'Identity & Access'))
  const net = line(zt, 'Security Operations')
  for (const k of ['F5', 'BGP', 'OSPF', 'SD-WAN', 'Palo Alto', 'Cisco ISE']) assert.ok(net.includes(k), k + ' with the other network terms: ' + net)
  assert.ok(!line(zt, 'Identity & Access').includes('BGP') && !line(zt, 'Governance').includes('OSPF'), 'not scattered')
  assert.match(ps.summary, /Strengths: problem solving, communication skills\.$/)
  assert.ok(!ps.skills.some(l => /problem solving|communication skills/i.test(l)), 'a strength is not a skills-line item')
  // Each placed term is named, so the reply can say which ones came from the job post alone.
  assert.ok(ps.placed.includes('PeopleSoft Query Manager') && zt.placed.includes('F5'))
})

test('the reply names what came from the job post, never says "cut short", and a resume made below the floor is made again', () => {
  const bot = read('src/app/api/whatsapp/webhook/route.ts'), choose = read('src/app/api/resumes/choose/route.ts'), tailor = read('src/lib/tailor.ts')
  assert.ok(!bot.includes('This run was cut short before it could add'))
  assert.ok(bot.includes('Added to your skills from the job post: ${placed.slice(0, 8).join(", ")}'))
  assert.ok(bot.includes('if (result.skills_only) out.push('))
  assert.ok(bot.includes('if (have && await madeMeetsFloor(have.abs, job.jd)) return sendSaved('), 'WhatsApp resends a made resume only above the floor')
  assert.ok(choose.includes('const have = found && await madeMeetsFloor(found.abs, jd) ? found : null'), 'Apply offers a made resume only above the floor')
  // The floor runs last, after the certificate clean-up, and also when no AI writer answered.
  const at = (s) => tailor.indexOf(s)
  assert.ok(at('if (best) best = await stripAddedCerts(best)') < at('const floored = await placeEverything(best)'))
  assert.ok(at('if (!best && !refine) {') > 0 && at('if (!best && !refine) {') < at('const floored = await placeEverything(best)'))
})

test('a made resume is offered again only when it still shows 90% of the job post\'s keywords', async () => {
  const T = await import('../../src/lib/keyword-targets.ts')
  assert.ok(T.isCertification('ISC2') && T.isCertification('isc2 certification'))
  // made-floor.ts imports storage and docx with extensionless paths, so it is loaded the way the app loads it.
  const jd = 'Administer PeopleSoft security, row-level security and PeopleSoft Query Manager. Integrate with Active Directory and LDAP.'
  const code = `const m = await import(${JSON.stringify(pathToFileURL(path.join(PROJECT, 'src/lib/made-floor.ts')).href)}); console.log(JSON.stringify([m.floorShare(process.argv[2], process.argv[1]), m.floorShare(process.argv[3], process.argv[1])]))`
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'mf-floor-'))
  try {
    const r = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', '--import', HOOKS, '--input-type=module', '-e', code, jd,
      'Skills: PeopleSoft security, row-level security, PeopleSoft Query Manager, Active Directory, LDAP', 'Skills: Okta, Splunk'],
      { cwd, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PROJECT_DIR: PROJECT }, encoding: 'utf8', timeout: 60000 })
    const [full, thin] = JSON.parse((r.stdout || '').trim().split(/\r?\n/).pop() || 'null') || []
    assert.ok(full >= 0.9, `a resume with the terms: ${full} (${r.stderr.slice(-400)})`)
    assert.ok(thin < 0.9, `a resume without them: ${thin}`)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
