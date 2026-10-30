// 200 harsher offline fold cases (round 2, 2026-10-29). ALL DATA IS INVENTED (example.com, 555 numbers).
// Mixes roundTripGuard, keywordReport, planSkillsLine/applySkillsPlan and deliver() failure modes.
// Ported from v2-js-reference/folds200.mjs; run by test:hardening.
import { checkRoundTrip } from '../../src/lib/resume-round-trip-guard.ts'
import { buildKeywordReport, normTerm } from '../../src/lib/resume-keyword-report.ts'
import { planSkillsLine, applySkillsPlan, deliver, JOB_POST_LABEL } from '../../src/lib/resume-skills-line.ts'

// ---------- invented resume builder
const mk = (o = {}) => [
  ...(o.lead ?? []),
  o.name ?? 'Riley Sample',
  o.contact ?? 'riley.sample@example.com | +1 (555) 010-4400 | https://linkedin.com/in/riley-sample',
  '',
  o.summaryHeading ?? 'Summary',
  o.summary ?? 'Platform engineer building secure cloud services.',
  '',
  ...(o.skills === null ? [] : (o.skills ?? ['Skills', 'Languages: Python, Go, SQL', 'Cloud: AWS, Docker'])),
  ...(o.skills === null ? [] : ['']),
  ...(o.afterSkills ?? []),
  o.expHeading ?? 'Experience',
  `Demo Systems — Platform Engineer, ${o.d1 ?? 'Mar 2022 – Present'}`,
  ...(o.bullets1 ?? ['• Ran Terraform for 30 AWS accounts.', '• Cut deploy time 40% with Docker images.']),
  `Mock Labs — Developer, ${o.d2 ?? '07/2019 - 02/2022'}`,
  ...(o.bullets2 ?? ['• Wrote Python ETL jobs on SQL Server.']),
  '',
  'Education',
  `B.S. Computer Engineering, ${o.edu ?? '2019'}`,
  '',
].join('\n')
const R = mk()
const SRC_B1 = '• Ran Terraform for 30 AWS accounts.'

const folds = []
const add = (id, kind, run) => folds.push({ id, kind, run })
const rt = (id, a, b, ok) => add(id, 'roundtrip', () => checkRoundTrip(a, b).ok === ok || `ok=${!ok} ${checkRoundTrip(a, b).problems.join('; ')}`)
const kwSane = r => r.counts.covered + r.counts.supportedGap + r.counts.unsupportedGap === r.counts.total &&
  r.unsupportedGap.every(t => !r.supportedGap.includes(t) && !r.covered.includes(t))
const kw = (id, args, check) => add(id, 'keywords', () => { const r = buildKeywordReport(args); return (kwSane(r) || 'counts/leak') && (check(r) || JSON.stringify({ c: r.covered, s: r.supportedGap, u: r.unsupportedGap })); })
const bullets = t => t.split('\n').filter(l => /^\s*(?:[•\-*▪‣◦●–—]|\d+[.)])\s+/.test(l))
const inBullets = (t, term) => bullets(t).some(b => ` ${normTerm(b)} `.includes(` ${normTerm(term)} `))
const occurrences = (t, term) => { const h = ` ${normTerm(t)} `, n = ` ${normTerm(term)} `; let c = 0, i = 0; while ((i = h.indexOf(n, i)) >= 0) { c++; i += n.length - 1; } return c; }
// invariant checks for every plan/deliver fold
function planInvariants(src, out, plan) {
  const errs = []
  const r = checkRoundTrip(src, out); if (plan.send && !r.ok) errs.push('sent but guard fails: ' + r.problems.join('; '))
  for (const t of plan.addedTerms) { if (occurrences(out, t) < 1) errs.push(`added term missing: ${t}`); if (/[\r\n\t]/.test(t)) errs.push(`raw newline/tab in term: ${JSON.stringify(t)}`); }
  for (const t of [...plan.addedTerms, ...plan.unplacedTerms]) if (plan.filteredOut.includes(t)) errs.push(`junk placed: ${t}`);
  if (plan.addedTerms.length !== new Set(plan.addedTerms.map(normTerm)).size) errs.push('duplicate added term')
  for (const t of plan.unplacedTerms) if (!plan.caption.includes(t)) errs.push(`unplaced term not in caption: ${t}`);
  return errs.length ? errs.join(' | ') : true
}
const pl = (id, args, check = () => true) => add(id, 'plan', () => {
  const plan = planSkillsLine(args); const out = applySkillsPlan(args.resumeText, plan)
  const inv = planInvariants(args.sourceText ?? args.resumeText, out, plan); if (inv !== true) return inv
  return check(plan, out) || `reason=${plan.reason} send=${plan.send} added=${JSON.stringify(plan.addedTerms)} unplaced=${JSON.stringify(plan.unplacedTerms)} filtered=${JSON.stringify(plan.filteredOut)}`
})
const dl = (id, args, check = () => true) => add(id, 'deliver', () => {
  const d = deliver(args)
  if (d.send) { const r = checkRoundTrip(args.sourceText, d.text); if (!r.ok) return 'sent but guard fails: ' + r.problems.join('; '); }
  for (const t of d.plan.report.unsupportedGap) if (d.send && inBullets(d.text, t) && !inBullets(args.sourceText, t)) return `job-post-only term in bullet: ${t}`;
  return check(d) || `send=${d.send} reason=${d.reason} reverted=${d.revertedBullets.length} text=\n${d.text}`
})

// ================= A. ROUND-TRIP (70) =================
const DASHES = ['-', '–', '—', '‒', '−', '‑', ' to ']
DASHES.forEach((x, i) => rt(`RT-A${i + 1} range dash variant "${x}" identical`, mk({ d1: `Mar 2022${x}Present` }), mk({ d1: `Mar 2022${x}Present` }), true))
DASHES.forEach((x, i) => rt(`RT-B${i + 1} dash swapped "${x}" -> " – " only`, mk({ d1: `Mar 2022${x}Present` }), mk({ d1: 'Mar 2022 – Present' }), true))
;['–', '-', '—'].forEach((x, i) => rt(`RT-C${i + 1} year range no spaces "2019${x}2022" end shifted`, mk({ d2: `2019${x}2022` }), mk({ d2: `2019${x}2023` }), false))
;['–', '—', '‑'].forEach((x, i) => rt(`RT-D${i + 1} year range "2019${x}2022" start dropped`, mk({ d2: `2019${x}2022` }), mk({ d2: '2022' }), false))
const EQUIV = [['Sep 2021', 'Sept 2021'], ['Sep 2021', 'September 2021'], ['Sep 2021', '09/2021'], ['Sep 2021', '9/2021'], ['Sep 2021', '2021-09'], ['SEP 2021', 'Sep 2021'], ['Sep. 2021', 'Sep 2021'], ['Present', 'Current'], ['Present', 'now']]
EQUIV.forEach(([a, b], i) => rt(`RT-E${i + 1} equivalent "${a}" == "${b}"`, mk({ d1: `${a} – Present` }), mk({ d1: `${b} – Present` }), true))
const SHIFT = [['Sep 2021', 'Oct 2021'], ['Sep 2021', '2021'], ['Sep 2021', '09/2022'], ['Mar 2022', 'Mar 2023'], ['07/2019', '08/2019']]
SHIFT.forEach(([a, b], i) => rt(`RT-F${i + 1} shifted "${a}" -> "${b}"`, mk({ d1: `${a} – Present` }), mk({ d1: `${b} – Present` }), false))
const NAMES = ['José Núñez-García', 'Zoë O’Brien', 'Anne-Marie Dubois-Lévesque', 'Łukasz Żółć', 'Nguyễn Thị Hà', 'Søren Kierkegård', "D'Angelo Smith-Jones"]
NAMES.forEach((n, i) => rt(`RT-G${i + 1} accented/hyphen name identical: ${n}`, mk({ name: n }), mk({ name: n }), true))
rt('RT-H1 NFD vs NFC same visible name', mk({ name: 'José Núñez-García'.normalize('NFC') }), mk({ name: 'José Núñez-García'.normalize('NFD') }), true)
rt('RT-H2 accents stripped', mk({ name: 'José Núñez-García' }), mk({ name: 'Jose Nunez-Garcia' }), false)
rt('RT-H3 hyphen in name -> en dash', mk({ name: 'Anne-Marie Dubois' }), mk({ name: 'Anne–Marie Dubois' }), false)
rt('RT-H4 hyphenated surname dropped half', mk({ name: 'Ana Ruiz-Soto' }), mk({ name: 'Ana Ruiz' }), false)
rt('RT-H5 non-breaking space in name', mk({ name: 'Ana Ruiz' }), mk({ name: 'Ana\u00a0Ruiz' }), true)
rt('RT-H6 leading blank lines in export', R, '\n\n' + R, true)
rt('RT-H7 CRLF line endings', R, R.replace(/\n/g, '\r\n'), true)
rt('RT-H8 empty export', R, '', false)
const C = (p, extra = '') => `riley.sample@example.com | ${p}${extra} | https://linkedin.com/in/riley-sample`
rt('RT-I1 phone with ext identical', mk({ contact: C('+1 (555) 010-4400 ext. 27') }), mk({ contact: C('+1 (555) 010-4400 ext. 27') }), true)
rt('RT-I2 phone extension dropped', mk({ contact: C('+1 (555) 010-4400 ext. 27') }), mk({ contact: C('+1 (555) 010-4400') }), false)
rt('RT-I3 phone extension changed', mk({ contact: C('(555) 010-4400 x27') }), mk({ contact: C('(555) 010-4400 x28') }), false)
rt('RT-I4 ext style "x27" -> "ext. 27" (same)', mk({ contact: C('(555) 010-4400 x27') }), mk({ contact: C('(555) 010-4400 ext. 27') }), true)
rt('RT-I5 two phones identical', mk({ contact: C('555-010-4400', ' | 555.010.7700') }), mk({ contact: C('555-010-4400', ' | 555.010.7700') }), true)
rt('RT-I6 two phones, one digit changed', mk({ contact: C('555-010-4400', ' | 555.010.7700') }), mk({ contact: C('555-010-4400', ' | 555.010.7701') }), false)
rt('RT-I7 two phones merged into one', mk({ contact: C('555-010-4400', ' | 555.010.7700') }), mk({ contact: C('555-010-4400') }), false)
rt('RT-I8 phone en-dash separators', mk({ contact: C('555–010–4400') }), mk({ contact: C('555-010-4400') }), true)
rt('RT-I9 international phone identical', mk({ contact: C('+44 20 7946 0958') }), mk({ contact: C('+44 20 7946 0958') }), true)
rt('RT-I10 country code dropped (non-US)', mk({ contact: C('+44 20 7946 0958') }), mk({ contact: C('20 7946 0958') }), false)
rt('RT-J1 email case only', R, R.replace('riley.sample@example.com', 'Riley.Sample@Example.com'), true)
rt('RT-J2 email plus-tag added', R, R.replace('riley.sample@', 'riley.sample+jobs@'), false)
rt('RT-J3 link trailing slash', R, R.replace('riley-sample', 'riley-sample/'), true)
rt('RT-J4 link http vs https', R, R.replace('https://', 'http://'), true)
rt('RT-J5 link handle changed', R, R.replace('in/riley-sample', 'in/riley-s'), false)
rt('RT-K1 skills add C++, C#, .NET, CI/CD', R, R.replace('Cloud: AWS, Docker', 'Cloud: AWS, Docker, C++, C#, .NET, CI/CD'), true)
rt('RT-K2 skills add "Windows Server 2019" (adds a date)', R, R.replace('Cloud: AWS, Docker', 'Cloud: AWS, Docker, Windows Server 2019'), false)
rt('RT-K3 skills add ISO 27001 + NIST 800-53', R, R.replace('Cloud: AWS, Docker', 'Cloud: AWS, Docker, ISO 27001, NIST 800-53'), true)
rt('RT-K4 education year changed', R, mk({ edu: '2018' }), false)
rt('RT-L1 ext style "extension 27" == "x27"', mk({ contact: C('(555) 010-4400 extension 27') }), mk({ contact: C('(555) 010-4400 x27') }), true)
rt('RT-L2 en-dash phone, digit changed', mk({ contact: C('555–010–4400') }), mk({ contact: C('555–010–4401') }), false)
rt('RT-K5 role lines swapped order (dates preserved)', R, R.replace(/(Demo Systems.*)\n([\s\S]*?)(Mock Labs.*)/, '$3\n$2$1'), true)

// ================= B. KEYWORD REPORT (60) =================
const RK = 'Built C/C++ and C# services on ASP.NET; ran CI/CD in Jenkins; Node.js APIs; résumé parser; Kubernetes.'
kw('KW-A1 C++ covered by C/C++', { jobTerms: ['C++'], resumeText: RK }, r => r.counts.covered === 1)
kw('KW-A2 C covered by C/C++', { jobTerms: ['C'], resumeText: RK }, r => r.counts.covered === 1)
kw('KW-A3 C# covered', { jobTerms: ['c#'], resumeText: RK }, r => r.counts.covered === 1)
kw('KW-A4 C# NOT covered by C++ alone', { jobTerms: ['C#'], resumeText: 'C++ only' }, r => r.counts.unsupportedGap === 1)
kw('KW-A5 C++ NOT covered by C# alone', { jobTerms: ['C++'], resumeText: 'C# only' }, r => r.counts.unsupportedGap === 1)
kw('KW-A6 .NET covered by ASP.NET', { jobTerms: ['.NET'], resumeText: RK }, r => r.counts.covered === 1)
kw('KW-A7 ASP.NET covered', { jobTerms: ['ASP.NET'], resumeText: RK }, r => r.counts.covered === 1)
kw('KW-A8 .NET not covered by email domain example.net', { jobTerms: ['.NET'], resumeText: 'me@example.net' }, r => r.counts.covered === 0)
kw('KW-A9 .NET Core vs .net core', { jobTerms: ['.NET Core'], resumeText: 'Used .net core 6' }, r => r.counts.covered === 1)
kw('KW-A10 VB.NET covers .NET', { jobTerms: ['.NET'], resumeText: 'VB.NET apps' }, r => r.counts.covered === 1)
const CICD = ['CI/CD', 'CI-CD', 'CI / CD', 'CICD', 'ci/cd', 'CI&CD', 'CI–CD', 'CI—CD', 'CI‑CD']
CICD.forEach((v, i) => kw(`KW-B${i + 1} CI/CD variant "${v}" matches resume CI/CD`, { jobTerms: [v], resumeText: RK }, r => r.counts.covered === 1))
;['CI–CD pipelines', 'CI-CD pipelines'].forEach((v, i) => kw(`KW-B${10 + i} resume "${v}" covers job "CI/CD"`, { jobTerms: ['CI/CD'], resumeText: v }, r => r.counts.covered === 1))
kw('KW-C1 Node.js vs "Node JS"', { jobTerms: ['Node.js'], resumeText: 'Node JS services' }, r => r.counts.covered === 1)
kw('KW-C2 NodeJS vs Node.js', { jobTerms: ['NodeJS'], resumeText: RK }, r => r.counts.covered === 1)
kw('KW-C3 accented term résumé == resume', { jobTerms: ['Resume parser'], resumeText: RK }, r => r.counts.covered === 1)
kw('KW-C4 accented job term vs plain resume', { jobTerms: ['Café POS'], resumeText: 'Cafe POS rollouts' }, r => r.counts.covered === 1)
kw('KW-C5 machine‑learning with NB hyphen', { jobTerms: ['machine learning'], resumeText: 'machine‑learning' }, r => r.counts.covered === 1)
kw('KW-D1 empty/blank/punct/emoji terms ignored', { jobTerms: ['', ' ', '---', '!!!', '🚀', '/', 'Kubernetes'], resumeText: RK }, r => r.counts.total === 1)
kw('KW-D2 non-string terms ignored (null, undefined, object, array)', { jobTerms: [null, undefined, {}, [], 'Kubernetes'], resumeText: RK }, r => r.counts.total === 1)
kw('KW-D3 numeric term kept as text', { jobTerms: [42], resumeText: 'team of 42' }, r => r.counts.total === 1)
kw('KW-D4 duplicates across case/dash/space', { jobTerms: ['CI/CD', 'ci-cd', 'CI / CD', 'CICD'], resumeText: '' }, r => r.counts.total === 1)
kw('KW-D5 duplicates Node.js/NodeJS/node js', { jobTerms: ['Node.js', 'NodeJS', 'node js'], resumeText: '' }, r => r.counts.total === 1)
kw('KW-D6 jobTerms not an array (string)', { jobTerms: 'Python', resumeText: 'Python' }, r => r.counts.total <= 1)
kw('KW-D7 supportedTerms null', { jobTerms: ['Rust'], resumeText: RK, supportedTerms: null }, r => r.counts.unsupportedGap === 1)
kw('KW-D8 resumeText null', { jobTerms: ['Rust'], resumeText: null }, r => r.counts.unsupportedGap === 1)
kw('KW-E1 Java not in JavaScript', { jobTerms: ['Java'], resumeText: 'JavaScript, TypeScript' }, r => r.counts.covered === 0)
kw('KW-E2 SQL not in NoSQL/MySQL', { jobTerms: ['SQL'], resumeText: 'NoSQL, MySQL' }, r => r.counts.covered === 0)
kw('KW-E3 Go not in Golang? (whole word) ', { jobTerms: ['Go'], resumeText: 'Golang' }, r => r.counts.covered === 0)
kw('KW-E4 R not in R&D? whole word R matches "R&D" (accepted)', { jobTerms: ['R'], resumeText: 'R and Python' }, r => r.counts.covered === 1)
kw('KW-E5 F# not C#', { jobTerms: ['F#'], resumeText: 'C#' }, r => r.counts.covered === 0)
kw('KW-F1 supported via own words keeps unsupported apart', { jobTerms: ['Wiz', 'Orca'], resumeText: RK, supportedTerms: ['I used Wiz daily'] }, r => r.supportedGap[0] === 'Wiz' && r.unsupportedGap[0] === 'Orca')
kw('KW-F2 covered beats supported', { jobTerms: ['Kubernetes'], resumeText: RK, supportedTerms: ['Kubernetes'] }, r => r.counts.covered === 1 && r.counts.supportedGap === 0)
kw('KW-F3 supported word must be whole word', { jobTerms: ['Go'], resumeText: '', supportedTerms: ['Google Cloud'] }, r => r.counts.unsupportedGap === 1)
const BIG = n => Array.from({ length: n }, (_, i) => `Tool${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}${Math.floor(i / 676) || ''}`)
;[80, 95, 120, 200].forEach((n, i) => kw(`KW-G${i + 1} ${n}-term list sums`, { jobTerms: [...BIG(n), 'Kubernetes'], resumeText: RK }, r => r.counts.total === n + 1 && r.counts.covered === 1))
kw('KW-G5 80 terms with 40 dupes', { jobTerms: [...BIG(40), ...BIG(40).map(t => t.toUpperCase())], resumeText: '' }, r => r.counts.total === 40)
kw('KW-G6 coverage pct one decimal', { jobTerms: ['Kubernetes', 'Rust', 'Zig'], resumeText: RK }, r => r.coveragePct === 33.3)
kw('KW-H1 term with trailing comma/period', { jobTerms: ['Kubernetes.', 'Jenkins,'], resumeText: RK }, r => r.counts.covered === 2)
kw('KW-H2 term inside parentheses in resume', { jobTerms: ['EKS'], resumeText: 'Kubernetes (EKS)' }, r => r.counts.covered === 1)
kw('KW-H3 fullwidth/odd spaces in resume', { jobTerms: ['Machine Learning'], resumeText: 'Machine\u2003Learning' }, r => r.counts.covered === 1)
kw('KW-H4 curly apostrophe', { jobTerms: ["Bachelor's"], resumeText: 'Bachelor’s' }, r => r.counts.covered === 1)
kw('KW-H5 term with slash list "AWS/GCP" vs resume "AWS, GCP"', { jobTerms: ['AWS/GCP'], resumeText: 'AWS GCP' }, r => r.counts.covered === 1)
kw('KW-H6 newline inside term', { jobTerms: ['gcp\niam'], resumeText: 'gcp iam' }, r => r.counts.covered === 1)
kw('KW-H7 C++ in middle of sentence with punctuation', { jobTerms: ['C++'], resumeText: 'Languages (C++, Rust).' }, r => r.counts.covered === 1)
kw('KW-H8 C# at end of sentence', { jobTerms: ['C#'], resumeText: 'Wrote tools in C#.' }, r => r.counts.covered === 1)
kw('KW-H9 .NET at line start', { jobTerms: ['.NET'], resumeText: '.NET 8 services' }, r => r.counts.covered === 1)
kw('KW-I1 Next.js vs "Next JS"', { jobTerms: ['Next.js'], resumeText: 'Next JS frontends' }, r => r.counts.covered === 1)
kw('KW-I2 CI–CD and CI-CD dedupe', { jobTerms: ['CI–CD', 'CI-CD'], resumeText: '' }, r => r.counts.total === 1)
kw('KW-H10 report never throws on 5k-char term', { jobTerms: ['x'.repeat(5000)], resumeText: RK }, r => r.counts.total === 1)

// ================= C. PLAN / APPLY (40) =================
const NOSK = mk({ skills: null })
const INLINE = mk({ skills: ['Skills: Python, Go, SQL, AWS, Docker'] })
pl('PL-A1 default: gap appended to last skills line, no label in file', { jobTerms: ['gcp iam', 'AWS'], resumeText: R }, (p, o) => !o.includes(JOB_POST_LABEL) && o.includes('Cloud: AWS, Docker, gcp iam'))
pl('PL-A2 labelInFile: one labelled line', { jobTerms: ['gcp iam'], resumeText: R, options: { labelInFile: true } }, (p, o) => o.split('\n').filter(l => l.startsWith(JOB_POST_LABEL)).length === 1)
pl('PL-A3 locked: unchanged + caption', { jobTerms: ['gcp iam', 'C#'], resumeText: R, skillsLocked: true }, (p, o) => o === R && p.reason === 'skills_locked' && p.send)
pl('PL-A4 locked + captionUnplaced off: held', { jobTerms: ['gcp iam'], resumeText: R, skillsLocked: true, options: { captionUnplaced: false } }, p => !p.send && p.blockedBy === 'policy')
pl('PL-A5 locked but nothing missing: sent, reason nothing_missing', { jobTerms: ['AWS'], resumeText: R, skillsLocked: true }, p => p.send && p.reason === 'nothing_missing')
pl('PL-A6 no skills section default', { jobTerms: ['gcp iam'], resumeText: NOSK }, (p, o) => o === NOSK && p.reason === 'no_skills_section' && p.send)
pl('PL-A7 no skills + addSkillsSection', { jobTerms: ['gcp iam'], resumeText: NOSK, options: { addSkillsSection: true } }, (p, o) => o.indexOf('gcp iam') < o.indexOf('Experience') && p.reason === 'placed')
pl('PL-A8 enabled:false refuses on gap', { jobTerms: ['gcp iam'], resumeText: R, options: { enabled: false } }, (p, o) => !p.send && p.reason === 'unverified_jd_terms' && o === R)
pl('PL-A9 enabled:false + locked still old refusal', { jobTerms: ['gcp iam'], resumeText: R, skillsLocked: true, options: { enabled: false } }, p => !p.send && p.reason === 'unverified_jd_terms')
pl('PL-B1 inline "Skills: a, b" line recognised and extended', { jobTerms: ['gcp iam'], resumeText: INLINE }, (p, o) => p.reason === 'placed' && o.includes('Skills: Python, Go, SQL, AWS, Docker, gcp iam'))
pl('PL-B2 inline skills + labelInFile', { jobTerms: ['gcp iam'], resumeText: INLINE, options: { labelInFile: true } }, (p, o) => p.reason === 'placed' && o.split('\n')[o.split('\n').indexOf('Skills: Python, Go, SQL, AWS, Docker') + 1] === `${JOB_POST_LABEL}: gcp iam`)
;['TECHNICAL SKILLS', 'Core Competencies:', 'Skills & Tools', 'Tech Stack', 'Technical Proficiencies', 'SKILLS AND TOOLS'].forEach((h, i) =>
  pl(`PL-C${i + 1} skills heading "${h}" recognised`, { jobTerms: ['gcp iam'], resumeText: mk({ skills: [h, 'Python, AWS'] }) }, (p, o) => p.reason === 'placed' && o.includes('Python, AWS, gcp iam')))
pl('PL-C7 skills followed by blank + unknown "LANGUAGES" section: terms stay in skills', { jobTerms: ['gcp iam'], resumeText: mk({ afterSkills: ['LANGUAGES', 'English, Spanish', ''] }) }, (p, o) => o.includes('Cloud: AWS, Docker, gcp iam') && o.includes('\nEnglish, Spanish\n'))
pl('PL-C8 skills section is the last section, trailing blanks', { jobTerms: ['gcp iam'], resumeText: 'Pat Sample\npat@example.com\nExperience\n• Did things.\nSkills\nPython\n\n\n' }, (p, o) => o.includes('Python, gcp iam'))
pl('PL-C9 skills line ends with comma', { jobTerms: ['gcp iam'], resumeText: mk({ skills: ['Skills', 'Python, AWS,'] }) }, (p, o) => o.includes('Python, AWS, gcp iam') && !o.includes(',,'))
const JUNK = ['H-1B', 'H1-B', 'W-2', 'C2C', 'GC-EAD', 'U.S. Citizen', 'TS/SCI', '10+ yrs', '3+ years', 'Bachelor’s', "Master's degree", '$120k', '$60/hr', 'Remote - US', 'Hybrid (3 days)', 'Onsite in Austin', 'Equal Opportunity Employer', '401(k)', 'Sr.', 'Candidates', 'Work authorization required']
pl('PL-D1 harsh junk list all filtered, real term kept', { jobTerms: [...JUNK, 'gcp iam'], resumeText: R }, p => JSON.stringify(p.addedTerms) === '["gcp iam"]' && p.filteredOut.length === JUNK.length)
pl('PL-D2 all junk -> nothing_missing, unchanged', { jobTerms: JUNK, resumeText: R }, (p, o) => o === R && p.reason === 'nothing_missing')
pl('PL-D3 newline/tab inside term sanitized', { jobTerms: ['gcp\niam', 'cloud\tarmor'], resumeText: R }, (p, o) => o.split('\n').length === R.split('\n').length && o.includes('gcp iam, cloud armor'))
pl('PL-D4 CI/CD dash variants dedup to one', { jobTerms: ['CI/CD', 'CI–CD', 'ci-cd', 'CICD'], resumeText: R }, p => p.addedTerms.length === 1)
pl('PL-D5 C++/C#/.NET placed, none duplicated', { jobTerms: ['C++', 'C#', '.NET', 'c++', 'C#'], resumeText: R }, p => p.addedTerms.length === 3)
pl('PL-D6 Windows Server 2019 not written, but named in caption', { jobTerms: ['Windows Server 2019', 'gcp iam'], resumeText: R }, (p, o) => !o.includes('2019,') && !o.includes('Server 2019') && /Windows Server 2019/.test(p.caption))
pl('PL-D7 ISO 27001 / NIST 800-53 / SOC 2 land and guard passes', { jobTerms: ['ISO 27001', 'NIST 800-53', 'SOC 2'], resumeText: R }, p => p.addedTerms.length === 3)
pl('PL-D8 term already in summary (not skills) -> covered', { jobTerms: ['secure cloud services'], resumeText: R }, p => p.reason === 'nothing_missing')
pl('PL-D9 term already in a bullet -> covered', { jobTerms: ['Terraform'], resumeText: R }, p => p.reason === 'nothing_missing')
pl('PL-D10 accented term placed verbatim', { jobTerms: ['Señal SIEM'], resumeText: R }, (p, o) => o.includes('Señal SIEM'))
;[80, 85, 100, 150].forEach((n, i) => pl(`PL-E${i + 1} ${n}-term list, labelled lines <=25 each, all land`, { jobTerms: BIG(n), resumeText: R, options: { labelInFile: true } }, (p, o) => {
  const lab = o.split('\n').filter(l => l.startsWith(JOB_POST_LABEL + ':'))
  return lab.length === Math.ceil(n / 25) && lab.every(l => l.split(':')[1].split(',').length <= 25) && buildKeywordReport({ jobTerms: BIG(n), resumeText: o }).coveragePct === 100
}))
pl('PL-E5 100 terms default append mode: all land, one line changed', { jobTerms: BIG(100), resumeText: R }, (p, o) => o.split('\n').length === R.split('\n').length && buildKeywordReport({ jobTerms: BIG(100), resumeText: o }).coveragePct === 100)
pl('PL-E6 100 terms, locked: all listed in caption', { jobTerms: BIG(100), resumeText: R, skillsLocked: true }, p => p.unplacedTerms.length === 100)
pl('PL-F1 "Remote Desktop Services" is a real skill, kept', { jobTerms: ['Remote Desktop Services'], resumeText: R }, p => p.addedTerms.length === 1)
pl('PL-F2 inline skills line + locked: unchanged, skills_locked', { jobTerms: ['gcp iam'], resumeText: INLINE, skillsLocked: true }, (p, o) => o === INLINE && p.reason === 'skills_locked')
pl('PL-E7 maxTermsPerLine 10', { jobTerms: BIG(35), resumeText: R, options: { labelInFile: true, maxTermsPerLine: 10 } }, (p, o) => o.split('\n').filter(l => l.startsWith(JOB_POST_LABEL)).length === 4)

// ================= D. DELIVER (30) =================
const draftB1 = t => R.replace(SRC_B1, t)
const BUL = ['•', '-', '*', '▪', '–', '1.']
BUL.forEach((b, i) => {
  const src = R.replaceAll('• ', `${b} `)
  dl(`DL-A${i + 1} bullet char "${b}": job-post term in bullet reverted`, { jobTerms: ['gcp iam'], sourceText: src, draftText: src.replace(`${b} Ran Terraform for 30 AWS accounts.`, `${b} Ran Terraform and gcp iam for 30 AWS accounts.`) },
    d => d.send && d.revertedBullets.length === 1 && d.text.includes(`${b} Ran Terraform for 30 AWS accounts.`))
})
;['Work History', 'PROFESSIONAL EXPERIENCE', 'Employment History', 'Relevant Experience', 'Career History'].forEach((h, i) =>
  dl(`DL-B${i + 1} experience heading "${h}": bullet reverted`, { jobTerms: ['gcp iam'], sourceText: mk({ expHeading: h }), draftText: mk({ expHeading: h, bullets1: ['• Ran Terraform and gcp iam for 30 AWS accounts.', '• Cut deploy time 40% with Docker images.'] }) },
    d => d.send && d.revertedBullets.length === 1))
dl('DL-C1 two terms in two bullets, both reverted', { jobTerms: ['gcp iam', 'Chronicle'], sourceText: R, draftText: R.replace(SRC_B1, '• Ran Terraform with gcp iam for 30 AWS accounts.').replace('• Wrote Python ETL jobs on SQL Server.', '• Wrote Python ETL jobs feeding Chronicle.') }, d => d.revertedBullets.length === 2 && d.send)
dl('DL-C2 brand-new bullet with term dropped', { jobTerms: ['gcp iam'], sourceText: R, draftText: R.replace(SRC_B1, `${SRC_B1}\n• Owned gcp iam policy.`) }, d => !d.text.includes('Owned gcp iam') && d.send)
dl('DL-C3 writer reordered bullets + term: exact source text restored', { jobTerms: ['gcp iam'], sourceText: R, draftText: R.replace(`${SRC_B1}\n• Cut deploy time 40% with Docker images.`, '• Cut deploy time 40% with Docker images.\n• Ran Terraform (gcp iam too) for 30 AWS accounts.') }, d => d.text.includes(SRC_B1) && d.send)
dl('DL-C4 term with C++ in bullet reverted', { jobTerms: ['C++'], sourceText: R, draftText: draftB1('• Ran Terraform for 30 AWS accounts in C++.') }, d => d.revertedBullets.length === 1)
dl('DL-C5 term already in source bullet: not reverted', { jobTerms: ['Terraform'], sourceText: R, draftText: draftB1('• Ran Terraform for thirty AWS accounts.') }, d => d.revertedBullets.length === 0 && d.text.includes('thirty'))
dl('DL-C6 supported term may stay in bullet', { jobTerms: ['Wiz'], sourceText: R, supportedTerms: ['Wiz'], draftText: draftB1('• Ran Terraform and Wiz for 30 AWS accounts.') }, d => d.revertedBullets.length === 0)
dl('DL-C7 writer changed a date -> held (round_trip)', { jobTerms: ['gcp iam'], sourceText: R, draftText: R.replace('Mar 2022', 'Apr 2022') }, d => !d.send && d.blockedBy === 'round_trip')
dl('DL-C8 writer changed the name -> held', { jobTerms: ['gcp iam'], sourceText: mk({ name: 'José Núñez-García' }), draftText: mk({ name: 'Jose Nunez-Garcia' }) }, d => !d.send)
dl('DL-C9 writer added a 2nd phone -> held', { jobTerms: [], sourceText: R, draftText: R.replace('+1 (555) 010-4400', '+1 (555) 010-4400 | 555-010-9999') }, d => !d.send)
dl('DL-C10 locked: writer edits to skills undone', { jobTerms: ['gcp iam'], sourceText: R, draftText: R.replace('Cloud: AWS, Docker', 'Cloud: AWS, Docker, gcp iam'), skillsLocked: true }, d => d.text === R && d.send && /gcp iam/.test(d.caption))
dl('DL-C11 no skills section: bullet reverted, caption lists term', { jobTerms: ['gcp iam'], sourceText: NOSK, draftText: NOSK.replace(SRC_B1, '• Ran Terraform and gcp iam for 30 AWS accounts.') }, d => d.text === NOSK && d.reason === 'no_skills_section' && /gcp iam/.test(d.caption))
dl('DL-C12 idempotent: deliver(deliver(x)) adds nothing', { jobTerms: ['gcp iam', 'C#'], sourceText: R, draftText: R }, d => { const again = deliver({ jobTerms: ['gcp iam', 'C#'], sourceText: R, draftText: d.text }); return again.text === d.text && again.send; })
dl('DL-C13 enabled:false: refusal, text untouched', { jobTerms: ['gcp iam'], sourceText: R, draftText: R, options: { enabled: false } }, d => !d.send && d.reason === 'unverified_jd_terms')
dl('DL-C14 en dash date ranges kept through deliver', { jobTerms: ['gcp iam'], sourceText: mk({ d2: '2019–2022' }), draftText: mk({ d2: '2019–2022' }) }, d => d.send && d.text.includes('2019–2022'))
dl('DL-C15 phone with extension kept through deliver', { jobTerms: ['gcp iam'], sourceText: mk({ contact: C('(555) 010-4400 ext. 27') }), draftText: mk({ contact: C('(555) 010-4400 ext. 27') }) }, d => d.send)
dl('DL-C16 80+ terms through deliver, bullets clean', { jobTerms: [...BIG(85), 'gcp iam'], sourceText: R, draftText: draftB1('• Ran Terraform and gcp iam for 30 AWS accounts.') }, d => d.send && buildKeywordReport({ jobTerms: BIG(85), resumeText: d.text }).coveragePct === 100)
dl('DL-C17 term in bullet AND on writer skills line: one copy, not in bullet', { jobTerms: ['gcp iam'], sourceText: R, draftText: draftB1('• Ran Terraform and gcp iam for 30 AWS accounts.').replace('Cloud: AWS, Docker', 'Cloud: AWS, Docker, gcp iam') }, d => occurrences(d.text, 'gcp iam') === 1)
dl('DL-C18 summary edit with term is allowed (not a bullet)', { jobTerms: ['gcp iam'], sourceText: R, draftText: R.replace('secure cloud services.', 'secure cloud services and gcp iam.') }, d => d.send && occurrences(d.text, 'gcp iam') === 1)
dl('DL-C19 empty draft -> held', { jobTerms: ['gcp iam'], sourceText: R, draftText: '' }, d => !d.send)

// ---------- run: one node:test case per fold
import test from 'node:test'
import assert from 'node:assert/strict'
test('folds200: exactly 200 folds built', () => assert.equal(folds.length, 200))
for (const f of folds) test(`fold [${f.kind}] ${f.id}`, () => { assert.equal(f.run(), true) })
