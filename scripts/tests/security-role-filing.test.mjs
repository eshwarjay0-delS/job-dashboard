// Where a made resume is filed for a plain security role. Owner, 20 Oct 2026, with a "Security Analyst" post (Java,
// Kotlin, AWS and Docker in its skills): "Resume mapping isn't accurate". The made resume was filed in "Data and Software
// Engineering". A security role with no speciality is General Security; a job already made under the old folder is
// still found, and is taken out of it as the new one goes in (one job, one file).
import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as RL from '../../src/lib/resume-library.ts'
import * as RO from '../../src/lib/resumeOrganization.ts'

const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
  const module = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8')
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process, console, Buffer, setTimeout, require: id => id in mocks ? mocks[id] : require(id),
  })
  return module.exports
}

const POST = `Hi,

The client is looking for a extremely skilled Security Analyst. The position is located in New York, NY.

Role: Security Analyst
Location: New York, NY (Hybrid)
Duration: 12 Months

Technical skills
- Must possess basic knowledge of EC2, Elastic Beanstalk, CloudWatch, Docker, ActiveMQ, RDS/Postgres, Firebase and Sentry.
- Must possess knowledge of languages including Java, Kotlin and SQL. Optionally React, HTML/CSS and JavaScript.
- Knowledge of React Native and Kotlin is desired but not required.`
const SOC_POST = `Security Analyst
Role: Security Analyst
You will triage alerts in Splunk and Microsoft Sentinel, run incident response, and tune SIEM detections with SOAR playbooks.`

test('a plain security role is General Security, whatever tools the post lists; real specialities and other roles are unchanged', () => {
  assert.equal(RL.legacyCategoryForJob(POST), 'Data and Software Engineering', 'where it was filed before')
  assert.equal(RL.categoryForJob(POST), 'General Security')
  assert.deepEqual(RL.categoriesForJob(POST), ['General Security', 'Data and Software Engineering'])
  // A security analyst post that is really about the SIEM stays in the SIEM folder.
  assert.equal(RL.categoryForJob(SOC_POST), 'SIEM and Incident Response')
  // Other roles are not touched.
  const soft = 'Software Engineer\nRole: Software Engineer\nReact, Node, Kotlin and Java for our web apps.'
  assert.equal(RL.categoryForJob(soft), RL.legacyCategoryForJob(soft))
  assert.deepEqual(RL.categoriesForJob(soft), [RL.categoryForJob(soft)])
  assert.equal(RL.categoryForJob('Cloud Security Engineer\nWe secure AWS: GuardDuty, Security Hub, CloudTrail and AWS Config.'), 'AWS Security')
})

// In-memory storage, so the store runs for real.
function memory() {
  const files = new Map()
  const under = dir => [...files.keys()].filter(k => k.startsWith(dir + '/'))
  const api = {
    readPath: async p => files.get(p) ?? null,
    readPathText: async p => (files.has(p) ? files.get(p).toString() : null),
    writePath: async (p, data) => { files.set(p, Buffer.isBuffer(data) ? data : Buffer.from(String(data))) },
    deletePath: async p => { files.delete(p) },
    existsPath: async p => files.has(p),
    listFiles: async dir => under(dir),
    movePath: async (a, b) => { files.set(b, files.get(a)); files.delete(a) },
  }
  return { files, api }
}

test('a job made under the old folder is still found, and is taken out of it when the new one is saved', async () => {
  const { files, api } = memory()
  const store = load('src/lib/resume-library-store.ts', {
    '@/lib/storage': api, '@/lib/docx': { extractText: async b => b.toString() }, '@/lib/resumeOrganization': RO,
    '@/lib/keywords': { extractJdKeywords: () => [], coveredJdKeywords: () => new Set() }, '@/lib/pdf-text': {}, '@/lib/resume-library': RL,
  })
  const USER = path.join('/data', 'u1')
  const E = 'a@x.com'
  const OLD = 'Data and Software Engineering'
  const oldRel = `${E}/${OLD}/Security Analyst - InfoPeople (tailored)__${'1'.repeat(16)}.docx`
  const lib = RL.recordRun(RL.emptyLibrary(), { path: oldRel, email: E, category: OLD, role: 'Security Analyst', company: 'InfoPeople', depth: 1, jd: POST, asked: ['java'], covers: ['java'] }, 100)
  await api.writePath(path.join(USER, oldRel), Buffer.from(`${E} old resume`))
  await api.writePath(path.join(USER, E, OLD, '_library.json'), JSON.stringify(RL.shelfOnly(lib, E, OLD)))

  // Not migrated yet: the job is found where it was filed.
  const found = await store.existingForJob(USER, E, POST)
  assert.equal(found?.file.path, oldRel)

  // Made again (a different resume to start from): the new file goes under General Security and the old one leaves.
  const saved = await store.saveTailored({ userDir: USER, bytes: Buffer.from(`${E} new resume`), jd: POST, role: 'Security Analyst', company: 'InfoPeople', depth: 1, asked: ['java'], covers: ['java'] })
  assert.equal(saved.category, 'General Security')
  assert.equal(saved.rel.startsWith(`${E}/General Security/`), true)
  assert.equal(files.has(path.join(USER, oldRel)), false, 'the same job is not kept in two folders')
  assert.equal((await store.readShelf(USER, E, OLD)).files.length, 0, 'nor in the old folder\'s record')
  const now = await store.existingForJob(USER, E, POST)
  assert.equal(now?.file.path, saved.rel)
  // A different job in the old folder is left alone.
  const other = `${E}/${OLD}/Data Engineer - Acme (tailored)__${'2'.repeat(16)}.docx`
  const lib2 = RL.recordRun(await store.readShelf(USER, E, OLD), { path: other, email: E, category: OLD, role: 'Data Engineer', company: 'Acme', depth: 1, jd: 'Data Engineer\nSpark and Kafka pipelines in Snowflake.', asked: ['spark'], covers: ['spark'] }, 200)
  await api.writePath(path.join(USER, other), Buffer.from(`${E} data resume`))
  await api.writePath(path.join(USER, E, OLD, '_library.json'), JSON.stringify(RL.shelfOnly(lib2, E, OLD)))
  await store.saveTailored({ userDir: USER, bytes: Buffer.from(`${E} newer`), jd: POST, role: 'Security Analyst', company: 'InfoPeople', depth: 1, asked: ['java'], covers: ['java'] })
  assert.equal(files.has(path.join(USER, other)), true)
})

// Owner, 26 Oct 2026, two WhatsApp screenshots: a Senior PeopleSoft Security Analyst post filed under "Application and
// API Security" and then "Data Protection and Privacy". Its work is access control inside an application (user profiles,
// roles, permission lists, row-level security), which is Identity and Access Management.
test('a PeopleSoft security post is filed under Identity and Access Management, not AppSec or Data Protection', () => {
  const post = `Senior PeopleSoft Security Analyst
PeopleTools & Module Security (Core Focus)
* PeopleSoft Enterprise Modules: PeopleSoft HCM, FSCM, EPM, Campus Solutions.
* PeopleTools Security Infrastructure: User Profiles, Roles, Permission Lists, Component-Level Security, Page-Level Security, Field-Level Security, Row-Level Security.
* Data protection: encryption of sensitive fields, application security reviews.`
  assert.equal(RL.categoryForJob(post), 'Identity and Access Management')
  // The other kinds stay where they were.
  assert.equal(RL.categoryForJob('Senior Network Security Engineer\nPalo Alto firewalls, Cisco, VPN and zero trust.'), 'Network Security')
  assert.equal(RL.categoryForJob('Application Security Engineer\nOWASP Top 10, SAST, DAST and Burp Suite testing.'), 'Application and API Security')
})
