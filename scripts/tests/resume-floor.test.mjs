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

test('with every AI provider down, every job post still gets a resume showing at least 90% of its skills, measured on the Word file', () => {
  for (const [name, r] of Object.entries(runs)) {
    assert.ok(r.measured >= 0.9, `${name}: ${(r.measured * 100).toFixed(1)}% on the file (${r.shown.length}/${r.targets.length})`)
    assert.ok(r.coverage >= 90, `${name}: the tailor reports ${r.coverage}%`)
    assert.equal(r.skillsOnly, true, `${name}: said to be the skills section only`)
    assert.ok(r.status !== 'needs_review', `${name}: ${r.status}`)
  }
})

test('the floor never writes the experience, and never a summary the person left as written', async () => {
  const { RESUME } = await import('./helpers/resume-floor-run.mjs')
  const source = RESUME.filter(l => l.startsWith('•')), summary = RESUME.find(l => l.startsWith('Cyber Security Analyst with'))
  for (const [name, r] of Object.entries(runs)) {
    assert.deepEqual(r.bullets, source, name)
    assert.equal(r.email, 'jordan.test@example.com', name)
    if (name !== 'peoplesoftOpenSummary') assert.equal(r.summary, summary, `${name}: the locked summary is untouched`)
    // A term added to a line keeps the line's formatting: each heading is still its own bold run.
    for (const head of ['Identity & Access Management:', 'Security Operations:', 'Languages:', 'Cloud & Scripting:', 'Governance & Compliance:'])
      assert.ok(r.boldHeads.includes(head), `${name}: "${head}" is still bold (${r.boldHeads.join(' | ')})`)
  }
  // A "Languages:" line is a skills line: the lines after it are still the skills section and still take terms.
  assert.ok(runs.benefits.skills.find(l => l.startsWith('Cloud & Scripting')).includes('GuardDuty'))
})

test('the keywords are the job post\'s real skills: whole product names, no sentence words, fragments, credentials, ranks, places or people', () => {
  const ps = runs.peoplesoft.targets, zt = runs.zerotrust.targets
  for (const k of ['peoplesoft query manager', 'data mover', 'process scheduler', 'application designer', 'row-level security', 'active directory', 'ldap', 'peopletools'])
    assert.ok(ps.includes(k), 'kept: ' + k)
  for (const k of ['page', 'public', 'row-level', 'mover', 'query', 'scheduler', 'manager approvals'])
    assert.ok(!ps.includes(k), 'not a target: ' + k)
  for (const k of ['f5', 'cisco ise', 'zscaler private access', 'bgp', 'ospf', 'sd-wan', 'palo alto', 'zero trust architecture'])
    assert.ok(zt.includes(k), 'kept: ' + k)
  for (const k of ['isc2', 'cissp', 'close-out', 'enterprise network zero trust', 'trust architecture'])
    assert.ok(!zt.includes(k), 'not a target: ' + k)
  // A clearance, a rank, a fiscal year and a place; benefits, the equal-opportunity line, a recruiter; credentials.
  const junk = /\b(?:ts|sci|top secret|clearance|ciso|vp|fy2027|reston|level iii|jane smith|talent acquisition|medical|dental|vision|401|equal opportunity|health partners|cysa|scrummaster|safe|agilist|solutions architect associate|az-500|azure az|isc|cissp)\b/i
  for (const name of ['clearance', 'benefits']) {
    const r = runs[name]
    assert.ok(!r.targets.some(t => junk.test(t)), `${name}: ${r.targets.join(', ')}`)
    assert.ok(!r.skills.some(l => junk.test(l)), `${name}: nothing of the kind is written: ${r.skills.join(' / ')}`)
  }
  for (const k of ['threat modeling', 'splunk', 'python']) assert.ok(runs.clearance.targets.includes(k), 'kept: ' + k)
  for (const k of ['guardduty', 'kql', 'terragrunt', 'wiz', 'security hub']) assert.ok(runs.benefits.targets.includes(k), 'kept: ' + k)
})

test('placed terms go where they belong: access with access, network together, strengths into an open summary only', () => {
  const line = (r, head) => r.skills.find(l => l.startsWith(head)) || ''
  const ps = runs.peoplesoft, zt = runs.zerotrust, open = runs.peoplesoftOpenSummary
  for (const k of ['Active Directory', 'LDAP', 'row-level security', 'PeopleSoft Security']) assert.ok(line(ps, 'Identity & Access').includes(k), k + ' in: ' + line(ps, 'Identity & Access'))
  const net = line(zt, 'Security Operations')
  for (const k of ['F5', 'BGP', 'OSPF', 'SD-WAN', 'Palo Alto', 'Cisco ISE']) assert.ok(net.includes(k), k + ' with the other network terms: ' + net)
  assert.ok(!line(zt, 'Identity & Access').includes('BGP') && !line(zt, 'Governance').includes('OSPF'), 'not scattered')
  assert.ok(line(runs.benefits, 'Cloud & Scripting').includes('Terragrunt') && line(runs.benefits, 'Security Operations').includes('KQL'))
  // Summary open: the strengths go into it, as one sentence, and not onto a skills line.
  assert.match(open.summary, /Strengths: problem solving, communication skills\.$/)
  assert.ok(!open.skills.some(l => /problem solving|communication skills/i.test(l)))
  assert.deepEqual(open.placedSummary, ['problem solving', 'communication skills'])
  // Each placed term is named, so the reply can say which ones came from the job post alone.
  assert.ok(ps.placed.includes('PeopleSoft Query Manager') && zt.placed.includes('F5'))
})

test('the reply names what came from the job post, never says "cut short", and a resume made below the floor is made again', () => {
  const bot = read('src/app/api/whatsapp/webhook/route.ts'), choose = read('src/app/api/resumes/choose/route.ts'), tailor = read('src/lib/tailor.ts')
  assert.ok(!bot.includes('This run was cut short before it could add'))
  assert.ok(bot.includes('Added to your skills from the job post: ${placed.slice(0, 8).join(", ")}'))
  assert.ok(bot.includes('if (result.skills_only) out.push('))
  assert.ok(bot.includes('if (have && await madeMeetsFloor(have.abs, job.jd, have.file.at)) return sendSaved(') && bot.includes('if (have) redo = true'), 'WhatsApp resends a made resume only above the floor, and remakes it from the person\'s own')
  assert.ok(choose.includes('const have = found && await madeMeetsFloor(found.abs, jd, found.file.at) ? found : null') && choose.includes('...(found && !have ? { redo: true } : {})'), 'Apply likewise')
  // A resume the floor wrote job-post terms onto is a copy: never the start of another job. One made without any AI
  // writer is not filed as the job's resume, so the job is written in full next time.
  assert.ok(bot.includes('depth: floorMade ? 2 : 1') && bot.includes('depth: files.depth === 0 && !floorMade ? 1 : 2') && bot.includes('filed = result.skills_only ? null :'))
  assert.ok(read('src/lib/tailor-file.ts').includes('o.result.placed_from_jd?.length || o.result.placed_in_summary?.length || o.result.skills_only ? 2 : 1'))
  // Only the post's own skills are scored and written; a run the floor carried is never cached as complete.
  assert.ok(tailor.includes('const scoreKws = floorTerms(jd, targetKeywords(jdExtracted, [], jd))') && tailor.includes('const left = scoreKws.filter(k => floorKws.has(k) && !cur.afterKw.has(k) && !isCertification(k))'))
  assert.ok(tailor.includes('partial: skillsOnly || floorCarried ||') && tailor.includes('const oneSummary = sec.summary !== false &&'))
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
