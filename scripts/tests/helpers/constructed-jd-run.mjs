// Representative fixture for the constructed-JD tailor. No model calls.
// Two pre-edit passes are summed into the JD, a low score triggers one more pass,
// experience headers and paragraph counts stay put, and overflow terms land on the
// labelled skills line. Prints one JSON object.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const PROJECT = process.env.PROJECT_DIR || fileURLToPath(new URL('../../../', import.meta.url))
const require = createRequire(path.join(PROJECT, 'package.json'))
const JSZip = require('jszip')
const src = (p) => pathToFileURL(path.join(PROJECT, 'src', p)).href

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
async function docx(lines) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  const run = (t, bold) => `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`
  const p = (t) => {
    const head = /^[A-Z][^:]{2,40}:/.exec(t)?.[0]
    return `<w:p>${head ? run(head, true) + run(t.slice(head.length), false) : run(t, false)}</w:p>`
  }
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(p).join('')}</w:body></w:document>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}

const RESUME = [
  'Jordan Test',
  'Cyber Security Analyst',
  'jordan.test@example.com | 555-010-0000 | Dallas, TX',
  'PROFESSIONAL SUMMARY',
  'Cyber Security Analyst with 9+ years of experience in identity and access management, security operations and audit support for regulated enterprises.',
  'TECHNICAL SKILLS',
  'Identity & Access Management: Okta, Azure AD, RBAC, SSO, MFA, access reviews',
  'Security Operations: Splunk, incident response, vulnerability management',
  'Languages: Python, PowerShell, SQL',
  'PROFESSIONAL EXPERIENCE',
  'Cyber Security Analyst | Acme Bank | Dallas, TX | Jan 2022 – Present',
  'Lead identity analyst for the bank access program across workforce accounts.',
  '• Administered role-based access for 12000 users across Okta and Azure AD, cutting orphaned accounts by 40%.',
  '• Ran quarterly access reviews and SOX control testing with application owners.',
  '• Built Splunk dashboards for privileged access monitoring and investigated alerts.',
  '• Automated provisioning tickets with Python and PowerShell, reducing turnaround from 3 days to 4 hours.',
  'Environments: Okta, Splunk, Python, Azure AD',
  'IAM Analyst | Globex Corporation | Irving, TX | Mar 2019 – Dec 2021',
  'Supported workforce identity for the earlier client and kept the audit record current.',
  '• Onboarded business applications and documented approval workflows for new hires.',
  '• Designed RBAC models with business managers and reviewed privileged groups.',
  '• Supported SSO and MFA rollout for ERP and HR systems.',
  '• Prepared audit evidence for SOX examinations and tracked remediation items.',
  'Environments: Okta, Azure AD, Splunk',
  'EDUCATION',
  'B.S. Computer Science, University of Texas at Dallas',
]

const JOB = `Cloud Security Engineer
Responsibilities:
- Monitor alerts in Splunk and automate remediation in Python.
- Manage access reviews and SOX audit evidence with Okta and Azure AD.
- Strong problem solving and communication skills.
Use Illumio and Zscaler and Panorama and Guardicore and Netskope and Prisma and Tenable and Qualys and Rapid7 for micro-segmentation and ZTNA.`

function pass(skills, extra = {}) {
  return {
    skills,
    experiences: extra.experiences || ['access reviews', 'privileged monitoring'],
    points: extra.points || ['orphaned accounts'],
    bullets: extra.bullets || ['Monitored Splunk alerts for privileged access'],
    skillLines: extra.skillLines || ['Security Operations: Splunk, Okta'],
    summary: extra.summary || 'Security analyst who monitors Splunk, reviews access in Okta, and automates work in Python.',
  }
}

const PASS_A = pass(['Illumio', 'Zscaler', 'Panorama', 'Guardicore', 'micro-segmentation'])
const PASS_B = pass(['Netskope', 'Prisma', 'Tenable', 'Qualys', 'Rapid7', 'ZTNA', 'problem solving'])
const PASS_C = pass(['SentinelOne', 'Demisto', 'Phantom', 'Exabeam'])

const userDir = path.resolve('data/user-resumes/u1')
const file = path.join(userDir, 'jordan.test@example.com', 'Identity', 'Cyber Security Analyst.docx')
mkdirSync(path.dirname(file), { recursive: true })
writeFileSync(file, await docx(RESUME))

const constructed = await import(src('lib/constructed-jd.ts'))
const keywords = await import(src('lib/keywords.ts'))
const targets = await import(src('lib/keyword-targets.ts'))
const docxMod = await import(src('lib/docx.ts'))
const atsMod = await import(src('lib/resume-ats.ts'))
const accept = await import(src('lib/whatsapp-resume-acceptance.ts'))
const roles = await import(src('lib/tailor-ship-on-rollback.ts'))
const qualityMod = await import(src('lib/resume-quality.ts'))

const buf = readFileSync(file)
const zones = await docxMod.extractZones(buf)
const sourceText = await docxMod.extractText(buf)

function score(text, jd, generated) {
  const extracted = keywords.extractJdKeywords(jd)
  const terms = targets.floorTerms(jd, targets.targetKeywords(extracted, generated, jd))
  const shown = keywords.coveredJdKeywords(text, terms)
  const matched = terms.filter(t => shown.has(t)).length
  return {
    percent: qualityMod.coveragePercent(terms.length ? matched / terms.length : 0),
    matched, total: terms.length,
    missing: terms.filter(t => !shown.has(t)),
    terms,
  }
}

const firstJd = constructed.constructJd(JOB, [PASS_A, PASS_B])
const generated = constructed.sumPassKeywords([PASS_A, PASS_B])
const before = score(sourceText, firstJd, generated)
const needsExtra = constructed.coverageNeedsAnotherPass(before.percent)

let jd = firstJd
let generations = 2
let tailorPasses = 1
if (needsExtra) {
  generations += 1
  tailorPasses += 1
  jd = constructed.constructJd(jd, [PASS_C])
}
const generatedAll = constructed.sumPassKeywords([PASS_A, PASS_B, ...(needsExtra ? [PASS_C] : [])])

const sources = zones.roles.flatMap(r => r.bullets.map(b => ({ idx: b.idx, text: b.text })))
const woven = constructed.weaveExperienceRepresentation(
  zones.roles.map(r => ({ bullets: r.bullets.map(b => ({ idx: b.idx, text: b.text })) })),
  [],
  generatedAll,
)
const dropped = constructed.dropInventedExperienceEdits({
  bullets: [{ idx: sources[0].idx, text: 'Opened a new employer at Zscaler Inc from Jan 2030.' }],
  added: [{ text: 'Invented a new employer row at Zscaler Inc from Jan 2030.' }],
}, sources)
if (dropped.removed < 2 || dropped.edits.bullets.length) throw new Error('an invented employer or date was kept')
const edits = {
  headline: { title: '', tagline: '' },
  summary: zones.summaryText,
  skills: [],
  bullets: woven.bullets,
  extras: [],
  added: [],
}

const draft = await docxMod.applyRewrites(buf, { ...edits, added: [] }, zones)
let draftText = await docxMod.extractText(draft.buffer)
let measured = score(draftText, jd, generatedAll)

const missingShown = measured.missing.map(t => targets.jdSpelling(t, jd))
const soft = missingShown.filter(t => targets.SOFT_SKILL.test(t))
const hard = missingShown.filter(t => !soft.includes(t))
const skillLines = zones.skills.map(s => ({ idx: s.idx, text: s.text }))
const skillEdit = constructed.labelledSkillEdit(skillLines, hard)
const summary = soft.length ? constructed.strengthsSummary(zones.summaryText, soft) : zones.summaryText
const finalEdits = {
  ...edits,
  added: [],
  summary,
  skills: skillEdit ? [skillEdit] : [],
  bullets: edits.bullets,
}
const out = await docxMod.applyRewrites(buf, finalEdits, zones)
const outText = await docxMod.extractText(out.buffer)
const outZones = await docxMod.extractZones(out.buffer)
const after = score(outText, jd, generatedAll)
const ats = atsMod.atsCheck(outText, outZones)
const frameBefore = constructed.experienceFrame(sourceText)
const frameAfter = constructed.experienceFrame(outText)

const sourceBullets = new Set(zones.roles.flatMap(r => r.bullets.map(b => b.text.trim())))
const changed = edits.bullets.filter(b => !sourceBullets.has(b.text.trim())).length
const lacking = zones.roles.filter(r => {
  const n = r.bullets.filter(b => edits.bullets.some(e => e.idx === b.idx && e.text.trim() !== b.text.trim())).length
  return r.bullets.length >= 2 && n < Math.max(1, Math.ceil(r.bullets.length * 0.3))
}).length

const labelled = hard.filter(t => constructed.textHasTerm(outText, t))
const claims = constructed.unverifiedClaims(generatedAll, labelled, () => false)
const experienceBlob = outZones.roles.map(r => r.bullets.map(b => b.text).join('\n')).join('\n')
const inBullets = generatedAll.filter(t => constructed.textHasTerm(experienceBlob, t))

const quality = qualityMod.resumeQuality({
  matched: after.matched, total: after.total, missing: after.missing,
  partial: false, unfinished: false, unchanged: false,
})
const result = {
  token: 'constructed-fixture',
  coverage: after.percent,
  supported_coverage: 100,
  diff: edits.bullets.filter(b => b.text).slice(0, 2).map(b => ({ section: 'Experience', before: 'source', after: b.text })),
  quality,
  ats,
  quality_blockers: roles.roleQualityBlockers({
    splitDraft: true, skillsOnly: false, lackingRoleCount: lacking,
    experienceComplete: true, jdGate: true, bulletsReverted: 0,
  }),
  unverified_added_keywords: [],
}

const fileBytes = out.buffer.length
writeFileSync(path.join('data', 'constructed-fixture.docx'), out.buffer)

console.log(JSON.stringify({
  generations,
  tailorPasses,
  needsExtra,
  firstJdHasPost: firstJd.includes('Cloud Security Engineer') && firstJd.toLowerCase().includes('illumio'),
  firstJdHasSum: generated.includes('illumio') && generated.includes('ztna'),
  coverageBefore: before.percent,
  coverageBeforeTotal: before.total,
  coverageAfter: after.percent,
  matched: after.matched,
  total: after.total,
  missing: after.missing,
  framesEqual: JSON.stringify(frameBefore) === JSON.stringify(frameAfter),
  frameBefore,
  frameAfter,
  changedBullets: changed,
  lacking,
  labelled: labelled.slice(0, 12),
  labelInFile: /job-post terms\s*:/i.test(outText),
  strengths: /strengths\s*:/i.test(outText),
  email: (outText.match(/[\w.]+@[\w.]+/) || [''])[0],
  inventedEmployer: /zscaler inc/i.test(outText),
  inventedDate: /2030/.test(outText),
  fileBytes,
  atsPassed: ats.passed,
  atsIssues: ats.issues,
  web: accept.acceptableWebResume(result),
  whatsApp: accept.whatsappRewriteUsable(result),
  webReasons: accept.whatsappResumeRejectionReasons(result, { strict: true }),
  blockers: result.quality_blockers,
  claimsBlocked: claims,
  inBullets,
  bulletCountBefore: sourceText.split('\n').filter(l => l.trim().startsWith('•')).length,
  bulletCountAfter: outText.split('\n').filter(l => l.trim().startsWith('•')).length,
}))
