// The resume tailor run for real, with NO AI provider (every call fails), so what comes back is the floor alone: a real
// .docx resume, the two job posts of the owner's 26 Oct 2026 WhatsApp screenshots (rewritten from what the screenshots
// show), the real runTailor, and the coverage measured again on the Word file itself. Prints one JSON line.
// Run by scripts/tests/resume-floor.test.mjs from an empty folder (the project keeps its data under <cwd>/data).
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const PROJECT = process.env.PROJECT_DIR || fileURLToPath(new URL("../../../", import.meta.url))
const require = createRequire(path.join(PROJECT, 'package.json'))
const JSZip = require('jszip')
const src = (p) => pathToFileURL(path.join(PROJECT, 'src', p)).href

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
async function docx(lines) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  // A skills line is written as most resumes write it: the heading in its own bold run, the items in a plain one.
  const run = (t, bold) => `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`
  const p = (t) => {
    const head = /^[A-Z][^:]{2,40}:/.exec(t)?.[0]
    return `<w:p>${head ? run(head, true) + run(t.slice(head.length), false) : run(t, false)}</w:p>`
  }
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(p).join('')}</w:body></w:document>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}

export const RESUME = [
  'Jordan Test', 'Cyber Security Analyst', 'jordan.test@example.com | 555-010-0000 | Dallas, TX',
  'PROFESSIONAL SUMMARY',
  'Cyber Security Analyst with 9+ years of experience in identity and access management, security operations and audit support for regulated enterprises.',
  'TECHNICAL SKILLS',
  'Identity & Access Management: Okta, SailPoint IdentityIQ, Azure AD, RBAC, SSO, MFA, access reviews',
  'Security Operations: Splunk, Microsoft Sentinel, CrowdStrike, incident response, vulnerability management',
  // A "Languages:" line must stay a skills line, not start a section (26 Oct 2026 review).
  'Languages: Python, PowerShell, SQL',
  'Cloud & Scripting: AWS, Azure, Terraform',
  'Governance & Compliance: NIST 800-53, SOX controls, SOC 2, audit evidence',
  'PROFESSIONAL EXPERIENCE',
  'Cyber Security Analyst, Acme Bank, Dallas, TX | Jan 2022 – Present',
  '• Administered role-based access for 12,000 users across Okta and Azure AD, cutting orphaned accounts by 40%.',
  '• Ran quarterly access reviews and SOX control testing with application owners and internal audit.',
  '• Built Splunk dashboards for privileged access monitoring and investigated alerts with the SOC.',
  '• Wrote SQL queries to reconcile HR feeds with application accounts and flagged terminated users.',
  '• Automated provisioning tickets with Python and PowerShell, reducing turnaround from 3 days to 4 hours.',
  'IAM Analyst, Globex Corporation, Irving, TX | Mar 2019 – Dec 2021',
  '• Onboarded 60 applications to SailPoint IdentityIQ with birthright roles and approval workflows.',
  '• Designed RBAC models with business managers and documented segregation of duties rules.',
  '• Supported SSO and MFA rollout for ERP and HR systems with the infrastructure team.',
  '• Prepared audit evidence for SOX and SOC 2 examinations and tracked remediation items.',
  '• Trained service desk staff on access request handling and escalation paths.',
  'Security Analyst, Initech, Plano, TX | Jun 2016 – Feb 2019',
  '• Monitored CrowdStrike and Sentinel alerts and handled incident response for endpoint threats.',
  '• Ran vulnerability scans and coordinated patching with system owners.',
  '• Maintained firewall change records and reviewed rule requests against policy.',
  '• Produced monthly security metrics for IT leadership.',
  'EDUCATION',
  'B.S. Computer Science, University of Texas at Dallas',
]

// Posts the 26 Oct 2026 review used to catch the first floor writing what is not a skill: a clearance, a rank, a year
// and a place; benefits, the equal-opportunity line and a recruiter's name; credentials in every spelling.
export const JUNK_JOBS = {
  clearance: `Senior Security Engineer (Level III)
Location: Reston, VA
We need 10+ years of experience and an active Top Secret clearance; TS/SCI preferred.
You will brief the CISO and the VP of Engineering on the FY2027 roadmap.
Responsibilities:
- Run threat modeling and vulnerability management for cloud workloads with Splunk and CrowdStrike.
- Automate detections in Python.`,
  benefits: `Cloud Security Engineer
Responsibilities:
- Harden AWS accounts with Wiz, GuardDuty and Security Hub.
- Build detections in KQL and maintain Terragrunt modules.
Certifications: CySA+, Certified ScrumMaster, SAFe Agilist certification, AWS Solutions Architect Associate, Azure AZ-500 or (ISC)2 CISSP preferred.
Benefits: Medical, Dental, Vision and 401(k). Health Partners is an Equal Opportunity Employer.
To apply, reach out to Jane Smith on our Talent Acquisition team.`,
}

export const JOBS = {
  peoplesoft: `Job Title: Senior PeopleSoft Security Analyst
Location: Remote (US)
Duration: 12 months contract
Responsibilities:
- Administer PeopleSoft security including user profiles, roles, permission lists and row-level security.
- Build and maintain queries in PeopleSoft Query Manager and manage Query security trees.
- Process access requests and manager approvals through the security workflow; perform quarterly access reviews and SOX audits.
- Support PeopleSoft HCM and Financials security, Process Scheduler security and component interfaces.
- Use SQL against the Oracle database to report on security access; document page and public access.
- Integrate PeopleSoft with Active Directory and LDAP for single sign-on.
Requirements:
- 7+ years of PeopleSoft security experience with PeopleTools 8.5x, Application Designer and Data Mover.
- Strong problem solving and communication skills.`,
  zerotrust: `Senior Enterprise Network Zero Trust Security Engineer
Location: Quantico, VA (onsite)
We are seeking an engineer to design and implement zero trust architecture across the enterprise network.
Responsibilities:
- Design micro-segmentation with Palo Alto firewalls, Panorama and Illumio.
- Deploy ZTNA with Zscaler Private Access and Cisco ISE for network access control.
- Manage F5 load balancers, SD-WAN, BGP and OSPF routing in a Cisco environment.
- Lead project close-out documentation and change management.
Qualifications:
- 8+ years of network security engineering; CISSP or another ISC2 certification preferred.
- Problem solving, adaptability and clear communication.`,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const userDir = path.resolve('data/user-resumes/u1')
  const file = path.join(userDir, 'jordan.test@example.com', 'Identity and Access Management', 'Cyber Security Analyst.docx')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, await docx(RESUME))
  const { runTailor } = await import(src('lib/tailor.ts'))
  const { extractText } = await import(src('lib/docx.ts'))
  const { extractJdKeywords, coveredJdKeywords } = await import(src('lib/keywords.ts'))
  const { targetKeywords, floorTerms } = await import(src('lib/keyword-targets.ts'))
  const out = {}
  const runs = [
    ...Object.entries(JOBS).map(([name, jd]) => ({ name, jd, summary: false })),
    ...Object.entries(JUNK_JOBS).map(([name, jd]) => ({ name, jd, summary: false })),
    // The person left the summary open to rewriting: strengths may go into it.
    { name: 'peoplesoftOpenSummary', jd: JOBS.peoplesoft, summary: true },
  ]
  for (const { name, jd, summary } of runs) {
    const r = await runTailor({ jd, keys: {}, userResumeDir: userDir, givenPath: file, mode: 'full', maxMs: 15000, noCache: true, sections: { summary, skills: true, experience: true } })
    const bytes = readFileSync(path.join('data', 'tailored', `${r.token}.docx`))
    const text = await extractText(bytes)
    const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml').async('string')
    // Every skills heading is still its own bold run after the floor added terms to its line.
    const boldHeads = [...xml.matchAll(/<w:r><w:rPr><w:b\/><\/w:rPr><w:t[^>]*>([^<]*)<\/w:t><\/w:r>/g)].map(m => m[1].replace(/&amp;/g, '&'))
    // The set the tailor scores and the floor fills: the post's own skill terms (made-floor.ts measures the same).
    const targets = floorTerms(jd, targetKeywords(extractJdKeywords(jd), [], jd))
    const shown = coveredJdKeywords(text, targets)
    out[name] = {
      coverage: r.coverage, status: r.quality?.status, skillsOnly: !!r.skills_only, placed: r.placed_from_jd || [], placedSummary: r.placed_in_summary || [], text,
      targets, shown: [...shown], measured: shown.size / targets.length,
      summary: text.split('\n').find(l => l.startsWith('Cyber Security Analyst with')) || '',
      skills: text.split('\n').filter(l => /^(Identity|Security Operations|Languages|Cloud|Governance)/.test(l)),
      email: (text.match(/[\w.]+@[\w.]+/) || [''])[0],
      bullets: text.split('\n').filter(l => l.startsWith('•')),
      boldHeads,
    }
  }
  console.log(JSON.stringify(out))
}
