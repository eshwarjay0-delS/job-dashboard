import { NextRequest, NextResponse } from "next/server"

// ─── Work-auth detection ──────────────────────────────────────────────────────
function detectWorkAuth(text: string): string[] {
  const t = text.toLowerCase()
  const auth: string[] = []
  if (/h[-\s]?1[-\s]?b|visa spons|will spons|sponsorship avail|we sponsor|offer spons/.test(t)) auth.push("h1b")
  if (/\bopt\b|\bcpt\b|optional practical|curricular practical|stem opt|f[-\s]?1/.test(t)) auth.push("opt_cpt")
  if (/\bw[-\s]?2\b/.test(t)) auth.push("w2")
  if (/\bc2c\b|corp.?to.?corp|corp-to-corp/.test(t)) auth.push("c2c")
  if (/green card|permanent resident/.test(t)) auth.push("green_card")
  if (/no spons|not able to spons|without spons|us citizen.*only|must be.*authorized|citizens (and|or) (green|perm)/.test(t)) auth.push("no_sponsorship")
  return auth
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim()
}

// A multi-word query (e.g. the STEM presets' "software engineer developer") is a
// broad "match any of these related terms" category browse, not a literal phrase
// or an AND-of-every-word search — no single job title contains "software" AND
// "engineer" AND "developer" together, so requiring all of them (or the previous
// literal `.includes(fullQuery)` check) silently zeroed out results. Matching if
// ANY word hits is both what the STEM presets need and standard job-search-box
// behavior (Indeed/LinkedIn-style keyword search, not a strict all-terms filter).
function matchesQuery(q: string, ...fields: string[]): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = fields.join(" ").toLowerCase()
  return words.some(w => haystack.includes(w))
}

interface Job {
  id: string; title: string; company: string; location: string; remote: boolean
  salary: string | null; posted: string; description: string
  workAuth: string[]; url: string; source: string
}

// ─── Source 1: JSearch / RapidAPI ─────────────────────────────────────────────
// Aggregates LinkedIn, Indeed, Glassdoor via official publishing agreements.
// Free tier: 200 req/month. Set RAPID_API_KEY in .env.local to enable.
// Get key at: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
async function fetchJSearch(q: string, loc: string, remote: boolean, type: string, key: string | null): Promise<Job[]> {
  if (!key) return []
  try {
    const query = [q || "software engineer", loc, remote ? "remote" : ""].filter(Boolean).join(" ")
    // Contract board asks for real contractor roles → JSearch employment_types filter.
    const empType = type === "contract" ? "&employment_types=CONTRACTOR" : ""
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=3&date_posted=3days${empType}`
    const res = await fetch(url, {
      headers: { "x-rapidapi-host": "jsearch.p.rapidapi.com", "x-rapidapi-key": key },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.data || []).map((j: {
      job_id: string; job_title: string; employer_name: string; job_city: string;
      job_state: string; job_is_remote: boolean; job_description: string;
      job_posted_at_datetime_utc: string; job_apply_link: string;
      job_min_salary?: number; job_max_salary?: number; job_publisher?: string;
    }) => {
      const desc = stripHtml(String(j.job_description || "")).slice(0, 700)
      const loc2 = j.job_is_remote ? "Remote" : [j.job_city, j.job_state].filter(Boolean).join(", ") || "Remote"
      const sMin = j.job_min_salary, sMax = j.job_max_salary
      const pub = (j.job_publisher || "").toLowerCase()
      return {
        id: "js-" + j.job_id,
        title: j.job_title,
        company: j.employer_name || "Company",
        location: loc2,
        remote: j.job_is_remote,
        salary: sMin ? `$${Math.round(sMin / 1000)}k – $${Math.round((sMax || sMin * 1.3) / 1000)}k` : null,
        posted: j.job_posted_at_datetime_utc || new Date().toISOString(),
        description: desc,
        workAuth: detectWorkAuth(desc),
        url: j.job_apply_link || "#",
        source: pub.includes("linkedin") ? "linkedin"
              : pub.includes("glassdoor") ? "glassdoor"
              : pub.includes("indeed") ? "indeed"
              : "jsearch",
      }
    })
  } catch { return [] }
}

// ─── Source 2: Infosecjobs.net ────────────────────────────────────────────────
// Cybersecurity-specific job board. Uses their public RSS feed (no key needed).
async function fetchInfosecjobs(q: string): Promise<Job[]> {
  try {
    // Infosecjobs provides an RSS feed; parse it server-side
    const res = await fetch("https://infosecjobs.com/feed/", {
      next: { revalidate: 3600 },
      headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
    })
    if (!res.ok) return []
    const xml = await res.text()

    // Parse RSS items with regex (no DOM on server)
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1])
    const jobs: Job[] = []

    for (const item of items.slice(0, 30)) {
      const title   = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1] || item.match(/<title>(.*?)<\/title>/i)?.[1] || "").trim()
      const link    = (item.match(/<link>(.*?)<\/link>/i)?.[1] || "#").trim()
      const desc    = stripHtml((item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] || item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "")).slice(0, 700)
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1] || new Date().toISOString()
      const company = (item.match(/<author>(.*?)<\/author>/i)?.[1] || item.match(/company[:\s]+(.*?)(?:\n|<)/i)?.[1] || "Company").trim()
      const id      = link.replace(/[^a-z0-9]/gi, "").slice(-16) || String(Math.random())

      if (!title) continue
      const isRemote = /remote|anywhere/i.test(desc + " " + title)

      // Filter by query if provided
      if (q && !matchesQuery(q, title, desc)) continue

      jobs.push({
        id: "isj-" + id,
        title,
        company,
        location: isRemote ? "Remote" : "US",
        remote: isRemote,
        salary: null,
        posted: new Date(pubDate).toISOString(),
        description: desc,
        workAuth: detectWorkAuth(desc),
        url: link,
        source: "infosecjobs",
      })
    }
    return jobs
  } catch { return [] }
}

// ─── Source 3: USA Jobs (Federal / Government roles) ─────────────────────────
// Covers federal/DoD/DHS/CISA roles. NOTE: despite USAJobs' own docs implying
// search works unauthenticated, live testing (2026-07-09) confirmed the API
// 401s on every request without an Authorization-Key — a key IS required.
// It's free and instant at developer.usajobs.gov though, unlike RapidAPI.
async function fetchUSAJobs(q: string, remote: boolean, key: string | null): Promise<Job[]> {
  if (!key) return []
  try {
    const keyword = encodeURIComponent(q || "cybersecurity")
    const url = `https://data.usajobs.gov/api/search?Keyword=${keyword}&ResultsPerPage=25&Fields=Min`
    // USAJobs requires a contact email in the User-Agent. Keep it out of source —
    // set USAJOBS_CONTACT_EMAIL in the environment; fall back to a neutral address.
    const contact = process.env.USAJOBS_CONTACT_EMAIL || "support@marketfit.app"
    const res = await fetch(url, {
      headers: {
        "Host": "data.usajobs.gov",
        "User-Agent": `marketfit-app/1.0 (${contact})`,
        "Authorization-Key": key,
      },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    const items = data.SearchResult?.SearchResultItems || []
    return items.map((item: {
      MatchedObjectId: string;
      MatchedObjectDescriptor: {
        PositionTitle: string; OrganizationName: string; PositionLocationDisplay: string;
        PositionRemuneration: Array<{ MinimumRange: string; MaximumRange: string; RateIntervalCode: string }>;
        PublicationStartDate: string; ApplicationCloseDate: string;
        PositionURI: string; QualificationSummary: string; UserArea?: {
          Details?: { TeleworkEligible?: string; };
        };
      };
    }) => {
      const d = item.MatchedObjectDescriptor
      const pay = d.PositionRemuneration?.[0]
      const salary = pay?.RateIntervalCode === "PA"
        ? `$${Math.round(Number(pay.MinimumRange) / 1000)}k – $${Math.round(Number(pay.MaximumRange) / 1000)}k`
        : null
      const desc = stripHtml(d.QualificationSummary || "").slice(0, 700)
      const isRemote = d.UserArea?.Details?.TeleworkEligible === "True" || /remote|telework/i.test(d.PositionLocationDisplay)
      if (remote && !isRemote) return null
      return {
        id: "usa-" + item.MatchedObjectId,
        title: d.PositionTitle,
        company: d.OrganizationName || "US Government",
        location: d.PositionLocationDisplay || "Washington, DC",
        remote: isRemote,
        salary,
        posted: d.PublicationStartDate || new Date().toISOString(),
        description: desc,
        workAuth: ["green_card"],  // Federal jobs typically require US citizenship/GC
        url: d.PositionURI || "https://www.usajobs.gov",
        source: "usajobs",
      }
    }).filter(Boolean)
  } catch { return [] }
}

// ─── Source 4: Handshake (Intern roles) ───────────────────────────────────────
// NOTE: Handshake requires institutional partnership for API access.
// Their partner API is not publicly available. Until a partnership is established,
// intern roles are sourced via JSearch with "intern" qualifier.
// Set HANDSHAKE_TOKEN in .env.local if a token is obtained.
async function fetchHandshakeInterns(q: string, rapidKey: string | null): Promise<Job[]> {
  const token = process.env.HANDSHAKE_TOKEN
  if (!token) {
    // Fallback: JSearch with intern filter — covers Indeed + LinkedIn intern postings
    return fetchJSearchInterns(q, rapidKey)
  }
  // Handshake partner API (when token available)
  try {
    const res = await fetch("https://app.joinhandshake.com/api/v1/jobs?employment_type_names[]=internship", {
      headers: { "Authorization": `Bearer ${token}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).map((j: { id: string; title: string; employer: { name: string }; city: string; state_name: string; remote_type: string; expiration_date: string; description: string; url: string; }) => {
      const desc = stripHtml(j.description || "").slice(0, 700)
      const isRemote = j.remote_type === "Remote"
      return {
        id: "hs-" + j.id,
        title: j.title,
        company: j.employer?.name || "Company",
        location: isRemote ? "Remote" : `${j.city || ""}, ${j.state_name || ""}`.trim().replace(/^,\s*/, ""),
        remote: isRemote,
        salary: null,
        posted: new Date().toISOString(),
        description: desc,
        workAuth: detectWorkAuth(desc),
        url: j.url || "https://app.joinhandshake.com/jobs",
        source: "handshake",
      }
    })
  } catch { return [] }
}

async function fetchJSearchInterns(q: string, key: string | null): Promise<Job[]> {
  if (!key) return []
  try {
    const query = `${q || "software"} intern internship`
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=2&date_posted=week&employment_types=INTERN`
    const res = await fetch(url, {
      headers: { "x-rapidapi-host": "jsearch.p.rapidapi.com", "x-rapidapi-key": key },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.data || []).filter((j: { job_employment_type?: string }) =>
      /intern/i.test(j.job_employment_type || "")
    ).map((j: {
      job_id: string; job_title: string; employer_name: string; job_city: string;
      job_state: string; job_is_remote: boolean; job_description: string;
      job_posted_at_datetime_utc: string; job_apply_link: string; job_publisher?: string;
    }) => {
      const desc = stripHtml(j.job_description || "").slice(0, 700)
      return {
        id: "hsi-" + j.job_id,
        title: j.job_title,
        company: j.employer_name,
        location: j.job_is_remote ? "Remote" : `${j.job_city || ""}, ${j.job_state || ""}`.trim(),
        remote: j.job_is_remote,
        salary: null,
        posted: j.job_posted_at_datetime_utc || new Date().toISOString(),
        description: desc,
        workAuth: detectWorkAuth(desc),
        url: j.job_apply_link || "#",
        source: "handshake",  // branded as Handshake even though via JSearch
      }
    })
  } catch { return [] }
}

// ─── Sample fallback (labeled to match real sources) ──────────────────────────
function dAgo(d: number) { return new Date(Date.now() - d * 86400000).toISOString() }
const SAMPLE: Job[] = [
  {
    id:"s1", title:"OT/ICS Security Engineer", company:"Dragos", location:"Remote", remote:true,
    salary:"$140k – $185k", posted:dAgo(0), workAuth:["h1b","w2","c2c","green_card"],
    url:"https://dragos.com/careers", source:"infosecjobs",
    description:`Dragos is the global leader in OT/ICS cybersecurity. We protect the world's most critical infrastructure — power grids, oil & gas pipelines, water systems, and manufacturing plants — from sophisticated cyber threats.

Role Overview: As an OT/ICS Security Engineer, you will monitor, detect, and respond to threats targeting industrial control systems across energy, utilities, and manufacturing sectors.

Responsibilities:
• Deploy and tune the Dragos Platform across customer ICS/SCADA environments (12+ sites per engagement)
• Perform threat hunting using MITRE ATT&CK for ICS; reduce mean time to detect from days to hours
• Evaluate OT network architectures against NERC CIP, NIST 800-82, and ISA/IEC 62443 frameworks
• Lead incident response for SCADA/DCS/PLC compromises; coordinate with plant operations teams
• Develop detection rules for Modbus, DNP3, OPC-UA, and EtherNet/IP protocol anomalies

Requirements:
• 3+ years OT/ICS security experience; familiarity with industrial environments (energy or utilities preferred)
• Hands-on with Industrial Defender, Claroty, Nozomi, or Dragos Platform
• NERC CIP compliance experience; GICSP, GRID, or OSCP certification strongly preferred
• Understanding of PLC/HMI/DCS architecture and OT network segmentation
• CySA+, AZ-500, or CISSP a plus

Visa Sponsorship: H-1B sponsorship available. Green card support provided. C2C welcome. W2 position.`,
  },
  {
    id:"s2", title:"Senior AppSec Engineer — SAST/DAST/SCA", company:"Microsoft", location:"Redmond, WA", remote:true,
    salary:"$185k – $245k", posted:dAgo(1), workAuth:["h1b","opt_cpt","green_card","w2"],
    url:"https://careers.microsoft.com", source:"linkedin",
    description:`Microsoft's Security Response Center is hiring a Senior Application Security Engineer to protect Azure and M365 services used by hundreds of millions of customers worldwide.

Role Overview: Drive secure development lifecycle (SDLC) practices, lead AppSec reviews, and operate SAST/DAST/SCA tooling at cloud scale.

Responsibilities:
• Own SAST/DAST/SCA pipelines using Fortify, Checkmarx, Snyk, and Microsoft Defender for DevOps
• Conduct threat modeling and architecture reviews for Azure AKS microservices and M365 APIs
• Perform web application penetration testing (Burp Suite Pro, OWASP ZAP, Invicti) across 50+ services quarterly
• Integrate DefectDojo and Wiz into CI/CD pipelines; drive findings remediation with development teams
• Develop OWASP Top 10 and SANS Top 25 training material; mentor junior AppSec engineers
• Respond to critical CVEs; coordinate with MSRC on responsible disclosure

Requirements:
• 5+ years application security experience; deep knowledge of OWASP Top 10, threat modeling, SDLC
• Proficiency with Burp Suite Pro, Fortify, Snyk, Veracode, SonarQube, or equivalent
• Cloud security experience: Azure AKS, AWS Security Hub, Prisma Cloud, or Wiz
• CISSP, OSCP, CCSK, or AWS Security Specialty preferred
• Experience with DLP (Netskope, Zscaler) and PAM (CyberArk, BeyondTrust) a strong plus
• Python, Go, or Java for automation and tooling

Visa: H-1B sponsorship and green card support. OPT/CPT welcome. W2 only.`,
  },
  {
    id:"s3", title:"Senior ServiceNow Developer / Platform Admin", company:"Accenture Federal Services", location:"Remote", remote:true,
    salary:"$130k – $175k", posted:dAgo(0), workAuth:["h1b","w2","green_card"],
    url:"https://www.accenture.com/us-en/careers", source:"linkedin",
    description:`Accenture Federal Services is looking for a Senior ServiceNow Developer/Admin with deep platform expertise to lead enterprise ITSM/ITOM transformations for Fortune 500 and federal clients.

Role Overview: Design, build, and maintain ServiceNow solutions across ITSM, ITOM, GRC, and HR Service Delivery modules. Lead a 4–6 person development team from discovery through UAT.

Responsibilities:
• Architect and implement ITSM, ITOM, GRC, and HR Service Delivery modules; own end-to-end delivery
• Build Flow Designer workflows, Service Catalog items, Business Rules, Script Includes, and Client Scripts
• Develop REST/SOAP integrations using IntegrationHub, MID Server, and custom Scripted REST APIs
• Lead ATF (Automated Test Framework) adoption; target 80%+ test coverage across production instances
• Upgrade instances across ServiceNow releases (Jakarta through Xanadu); manage release planning and rollback
• Mentor junior developers on GlideScript, Jelly, and ServiceNow PDI best practices

Requirements:
• 8+ years ServiceNow development experience across multiple releases
• Certified System Administrator (CSA) + Certified Application Developer (CAD) required; CIS-ITSM preferred
• Strong JavaScript, Glide API, REST API, and SOAP expertise
• Experience with Performance Analytics, Reporting, and ServiceNow integration patterns
• Federal experience or clearance eligibility a strong plus

Visa: H-1B sponsorship available. Green card support provided. W2 position.`,
  },
  {
    id:"s4", title:"Senior Security Engineer — Cloud & Endpoint", company:"Palo Alto Networks", location:"Santa Clara, CA", remote:true,
    salary:"$170k – $230k", posted:dAgo(1), workAuth:["h1b","w2","green_card","c2c"],
    url:"https://paloaltonetworks.com/company/careers", source:"glassdoor",
    description:`Palo Alto Networks is the global cybersecurity leader. Join our internal Red/Blue team to protect the company that protects the world.

Role Overview: Senior Security Engineer responsible for cloud security posture management, endpoint detection, and advanced threat response across a hybrid Azure/AWS environment.

Responsibilities:
• Manage CrowdStrike Falcon EDR/XDR across 15,000+ endpoints; tune detections to reduce false positives by 40%
• Operate Netskope CASB and Zscaler ZTNA; enforce DLP policies across M365 and Google Workspace
• Lead cloud security reviews using Wiz and Prisma Cloud; enforce IaC security via Checkov and tfsec
• Deploy and maintain CyberArk PAM for 500+ privileged accounts; integrate with ITSM ticketing
• Hunt threats using Cortex XSOAR playbooks; reduce mean time to respond from 4 hours to under 30 minutes
• Conduct quarterly red team exercises; report findings to CISO with remediation roadmaps

Requirements:
• 5+ years security engineering experience; deep knowledge of EDR, SIEM, CASB, and PAM
• Proficiency with CrowdStrike, Netskope, Zscaler, CyberArk, Qualys, or equivalent platforms
• CISSP, CCSK, OSCP, or CompTIA PenTest+ preferred; AZ-500 a strong plus
• Cloud security hands-on: Azure Sentinel, AWS Security Hub, GCP SCC, or Wiz
• Scripting: Python, PowerShell, or Bash for automation and threat hunting

Visa sponsorship available. Green card support. C2C and W2 welcome.`,
  },
  {
    id:"s5", title:"OT Security Analyst — Critical Infrastructure", company:"Honeywell", location:"Houston, TX", remote:true,
    salary:"$125k – $165k", posted:dAgo(2), workAuth:["h1b","w2","green_card"],
    url:"https://careers.honeywell.com", source:"indeed",
    description:`Honeywell's Industrial Cybersecurity team protects critical infrastructure across energy, utilities, and process industries globally. We are expanding our OT Security practice and seeking an experienced analyst.

Role Overview: Monitor and respond to threats targeting SCADA, DCS, and PLC systems at client sites across the energy sector. Partner with plant operations teams to improve OT/IT convergence security.

Responsibilities:
• Monitor ICS networks using Industrial Defender and Claroty for anomalous OT traffic and protocol deviations
• Perform vulnerability assessments of OT assets (PLCs, HMIs, DCS) per NIST 800-82 and IEC 62443 guidelines
• Develop and maintain NERC CIP compliance documentation; support audit preparation for CIP-002 through CIP-013
• Lead SCADA incident response tabletop exercises; reduce detection-to-containment time
• Analyze MITRE ATT&CK for ICS TTPs; develop custom signatures for Modbus/DNP3 anomalies
• Produce executive-level risk reports and asset inventory dashboards

Requirements:
• 3+ years OT/ICS security or industrial networking experience
• Familiarity with SCADA, DCS, PLC, HMI, and OT network protocols (Modbus, DNP3, OPC-UA)
• NERC CIP knowledge required; GICSP, GRID, or CSSA certification preferred
• SIEM experience (Splunk, IBM QRadar, or Microsoft Sentinel) for OT log aggregation
• OSCP, CySA+, or AZ-500 certification a strong plus

H-1B sponsorship and green card support available. W2 position.`,
  },
  {
    id:"s6", title:"ServiceNow Platform Engineer — GRC & SecOps", company:"Deloitte", location:"Remote", remote:true,
    salary:"$120k – $160k", posted:dAgo(0), workAuth:["h1b","w2","green_card"],
    url:"https://www2.deloitte.com/us/en/careers", source:"linkedin",
    description:`Deloitte's Government & Public Services practice is looking for a ServiceNow Platform Engineer with GRC and SecOps module expertise to support large-scale federal and commercial implementations.

Role Overview: Lead design and development of ServiceNow GRC, SecOps, and ITSM workflows for enterprise clients. Own integration architecture and ensure compliance with client security standards.

Responsibilities:
• Design and implement ServiceNow GRC (Risk Management, Policy & Compliance, Audit Management) for Fortune 500 clients
• Build SecOps (Vulnerability Response, Security Incident Response, Threat Intelligence) module integrations with Splunk and CrowdStrike
• Develop complex Flow Designer automations, Scripted REST APIs, and IntegrationHub spoke configurations
• Configure CMDB and Discovery to maintain accurate asset inventory across hybrid environments
• Perform ATF test automation; maintain 85%+ regression test coverage across 3 production instances
• Lead client workshops; translate business requirements into technical ServiceNow solutions

Requirements:
• 6+ years ServiceNow development; CSA + CAD certifications required; CIS-GRC or CIS-SecOps preferred
• Strong Glide API, JavaScript, REST/SOAP, and Flow Designer expertise
• Experience across ServiceNow releases from Jakarta through Xanadu
• Federal government or healthcare sector experience preferred
• ITIL Foundation certification a plus

H-1B visa sponsorship available. Green card support provided. W2 position.`,
  },
  {
    id:"s7", title:"Lead Penetration Tester / Red Team Engineer", company:"Rapid7", location:"Remote", remote:true,
    salary:"$145k – $195k", posted:dAgo(1), workAuth:["h1b","c2c","w2"],
    url:"https://rapid7.com/careers", source:"infosecjobs",
    description:`Rapid7 is looking for a Lead Penetration Tester to join our managed security services team. You will conduct offensive security engagements for Fortune 1000 clients across finance, healthcare, and critical infrastructure.

Responsibilities:
• Lead external/internal network and web application penetration tests; deliver executive and technical reports
• Perform adversary simulation using Metasploit Pro, Cobalt Strike, and custom tooling
• Conduct OSCP-style exploits, post-exploitation, lateral movement, and privilege escalation assessments
• Test SCADA/ICS environments per ISA/IEC 62443 methodology (OT experience a strong differentiator)
• Develop custom exploitation scripts in Python, Bash, and PowerShell
• Mentor junior penetration testers; quality-review deliverables before client release

Requirements:
• 4+ years penetration testing experience across network, web app, and cloud environments
• OSCP required; GPEN, GWAPT, CEH, or OSEP a strong plus
• Proficiency with Burp Suite Pro, Nessus, Metasploit, BloodHound, Impacket, and Covenant
• Cloud penetration testing experience (AWS, Azure, GCP)
• CySA+ or PenTest+ certifications welcome

H-1B sponsorship available. C2C and W2 both accepted.`,
  },
  {
    id:"s8", title:"DevSecOps Engineer — Pipeline Security", company:"CrowdStrike", location:"Austin, TX", remote:true,
    salary:"$155k – $210k", posted:dAgo(2), workAuth:["h1b","w2","c2c"],
    url:"https://crowdstrike.com/careers", source:"indeed",
    description:`CrowdStrike is redefining modern security. Our DevSecOps team embeds security throughout the software development lifecycle to protect the platform that stops breaches.

Responsibilities:
• Own SAST/SCA integration across 30+ GitHub Actions and GitLab CI pipelines using Snyk, Checkov, and Trivy
• Manage container security scanning for 500+ Docker images; enforce policy-as-code via OPA/Rego
• Operate Kubernetes (EKS) security hardening: RBAC, network policies, pod security standards
• Integrate Fortify and DefectDojo into developer workflows; track and drive vulnerability remediation SLAs
• Automate secrets detection using GitLeaks and Trufflehog; manage Vault-based secrets rotation
• Build security guardrails in Terraform IaC; enforce CIS benchmarks across AWS and Azure

Requirements:
• 4+ years DevSecOps or cloud security engineering experience
• Proficiency with Kubernetes, Terraform, Docker, GitHub Actions, and Jenkins
• SAST/SCA experience: Snyk, Checkmarx, Fortify, Veracode, or SonarQube
• AWS or Azure cloud security certifications (AZ-500, AWS Security Specialty) preferred
• CompTIA Security+, CISSP, or CySA+ a plus

H-1B sponsorship available. C2C and W2 both welcome.`,
  },
  {
    id:"s9", title:"GRC Analyst / Security Compliance Manager", company:"Coalfire", location:"Remote", remote:true,
    salary:"$100k – $140k", posted:dAgo(3), workAuth:["h1b","w2"],
    url:"https://coalfire.com/careers", source:"infosecjobs",
    description:`Coalfire is a leading cybersecurity advisory firm. Our GRC practice serves financial institutions, healthcare organizations, and technology companies across 40+ states.

Role Overview: Lead risk assessments, compliance audits, and policy development engagements for enterprise clients pursuing SOC 2, ISO 27001, FedRAMP, and HIPAA compliance.

Responsibilities:
• Conduct NIST CSF, SOC 2 Type II, ISO 27001, PCI DSS, and HIPAA gap assessments for 8–12 clients simultaneously
• Lead FedRAMP readiness assessments and System Security Plan (SSP) development for cloud service providers
• Perform third-party vendor risk assessments; develop vendor risk scoring methodology
• Draft and maintain Information Security Policies, BCP/DR plans, and risk registers
• Present findings and remediation roadmaps to C-suite and board-level stakeholders
• Maintain Drata, Vanta, or Archer GRC platform configurations

Requirements:
• 4+ years GRC, risk management, or compliance experience
• Deep knowledge of NIST CSF, SOC 2, ISO 27001, PCI DSS, HIPAA, and FedRAMP
• CISA, CRISC, CISSP, or CISM certification preferred; CompTIA Security+ accepted
• Experience with GRC platforms: ServiceNow GRC, Archer RSA, Drata, or OneTrust
• Strong written communication skills for audit reports and executive presentations

H-1B sponsorship available. W2 position.`,
  },
  {
    id:"s10", title:"Senior Cloud Security Engineer", company:"AWS", location:"Seattle, WA", remote:true,
    salary:"$175k – $235k", posted:dAgo(0), workAuth:["h1b","w2","green_card"],
    url:"https://aws.amazon.com/careers", source:"linkedin",
    description:`Amazon Web Services is the world's largest cloud provider. Join our Security team to help protect 1 million+ active customers across 245 countries.

Role Overview: Senior Cloud Security Engineer responsible for AWS security posture management, threat detection, and zero trust architecture initiatives across AWS commercial and GovCloud regions.

Responsibilities:
• Design and implement IAM, SCPs, and permission boundaries for AWS Organization with 5,000+ accounts
• Operate AWS Security Hub, GuardDuty, Inspector, and Macie; build custom EventBridge rules and Lambda remediators
• Lead cloud security architecture reviews for Tier-1 AWS services; enforce CIS AWS Foundations Benchmark
• Develop infrastructure-as-code security policies using AWS Config, Terraform, and OPA
• Build automated incident response runbooks in Python; reduce MTTR from 2 hours to under 15 minutes
• Mentor 4 junior cloud security engineers; own the security champions program

Requirements:
• 5+ years cloud security engineering; deep AWS expertise required (Azure or GCP a plus)
• AWS Security Specialty certification required; CISSP, CCSK, or OSCP preferred
• Strong Python, Terraform, and CloudFormation for security automation
• Knowledge of zero trust, identity federation, CASB, and CSPM tools
• Experience with Wiz, Prisma Cloud, or AWS Security Hub at enterprise scale

H-1B sponsorship and green card support. W2 position.`,
  },
  {
    id:"s11", title:"Cybersecurity Engineer — SIEM & Threat Detection", company:"Cigna Healthcare", location:"Philadelphia, PA", remote:true,
    salary:"$120k – $160k", posted:dAgo(1), workAuth:["h1b","w2","green_card"],
    url:"https://jobs.cigna.com", source:"infosecjobs",
    description:`Cigna Healthcare's Cyber Threat Intelligence team protects 180 million+ customer health records and one of the largest healthcare networks in the US.

Role Overview: Cybersecurity Engineer focused on SIEM engineering, threat detection, and incident response in a highly regulated HIPAA/HITRUST environment.

Responsibilities:
• Engineer and optimize Splunk SIEM with 50+ custom detection rules; reduce alert fatigue by 35%
• Lead DFIR investigations for phishing, ransomware, and insider threat incidents
• Develop threat intelligence feeds and IOC enrichment workflows using MITRE ATT&CK TTPs
• Perform vulnerability management using Nessus and Qualys; track remediation SLAs across 8 business units
• Operate CrowdStrike Falcon EDR across 25,000 endpoints; respond to critical detections within 15 minutes
• Produce weekly threat landscape reports for CISO and IT leadership

Requirements:
• 4+ years SOC, DFIR, or security engineering experience in a large enterprise or healthcare environment
• Proficiency with Splunk, IBM QRadar, Microsoft Sentinel, or equivalent SIEM platforms
• DFIR experience: memory forensics, log analysis, malware triage, and chain-of-custody documentation
• CySA+, GCIA, GCIH, or GCFE certification preferred; CompTIA Security+ accepted
• Healthcare sector or HIPAA compliance experience a strong plus

H-1B sponsorship and green card support. W2 position.`,
  },
  {
    id:"s12", title:"ServiceNow ITSM/ITOM Architect", company:"ServiceNow", location:"Santa Clara, CA", remote:true,
    salary:"$160k – $215k", posted:dAgo(0), workAuth:["h1b","w2","green_card"],
    url:"https://careers.servicenow.com", source:"linkedin",
    description:`ServiceNow is the fastest-growing enterprise software company in history. Join our Platform Architecture team and help our largest customers transform how work gets done.

Role Overview: ServiceNow Architect responsible for designing and delivering enterprise-scale ITSM, ITOM, and CMDB implementations for Global 2000 clients.

Responsibilities:
• Lead discovery and design workshops; translate complex enterprise requirements into scalable ServiceNow architecture
• Architect ITSM (Incident, Problem, Change, Service Catalog) and ITOM (Discovery, Service Mapping, Event Management) for organizations with 50,000+ users
• Design CMDB population strategy using Discovery, Service Graph Connectors, and custom import transforms
• Develop IntegrationHub spokes, REST APIs, and MID Server configurations for multi-cloud environments
• Review and improve Flow Designer, Business Rules, and Script Includes for performance and maintainability
• Advise clients on ServiceNow upgrade paths from older releases (Jakarta, Kingston) to current (Xanadu)

Requirements:
• 10+ years ServiceNow experience; CSA + CAD + at least one CIS certification required
• Deep expertise in ITSM, ITOM, CMDB, Performance Analytics, and Service Portal
• Strong JavaScript, Glide API, HTML/CSS, and REST/SOAP integration experience
• Customer-facing consulting or pre-sales architecture experience preferred
• ITIL Expert or Master certification a strong plus

H-1B sponsorship and green card support available. W2 position.`,
  },
  {
    id:"s13", title:"Information Security Analyst — SOC Tier 2/3", company:"Booz Allen Hamilton", location:"McLean, VA", remote:false,
    salary:"$105k – $145k", posted:dAgo(1), workAuth:["green_card"],
    url:"https://boozallen.com/careers", source:"usajobs",
    description:`Booz Allen Hamilton supports the US Department of Defense and Intelligence Community's most sensitive cybersecurity missions. Join our 24x7 federal SOC protecting national security infrastructure.

Role Overview: SOC Tier 2/3 analyst responsible for advanced threat detection, incident response, and forensic investigation supporting classified government environments.

Responsibilities:
• Perform Tier 2/3 triage and investigation of security events from Splunk SIEM and ArcSight across federal networks
• Lead DFIR for APT intrusions; conduct memory forensics, malware analysis, and host-based investigations
• Develop and tune SIEM correlation rules; reduce false positive rate by 25% across 8 detection categories
• Analyze threat actor TTPs aligned to MITRE ATT&CK; produce finished intelligence reports
• Perform hunt missions for nation-state adversaries using custom Python and PowerShell tooling
• Support CISA and NSA incident coordination; manage chain-of-custody for digital evidence

Requirements:
• 4+ years SOC or DFIR experience; federal or cleared environment strongly preferred
• Security clearance required (TS/SCI eligible; clearance sponsorship available for qualified candidates)
• Proficiency with Splunk, ArcSight, or IBM QRadar; SIEM engineering experience preferred
• Certifications: GCIA, GCIH, GCFE, GCFA, or OSCP required; CISSP or CySA+ a plus
• US citizenship or green card required for clearance eligibility

Green card holders eligible. Clearance sponsorship for US citizens.`,
  },
]

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q      = searchParams.get("q") || ""
  const loc    = searchParams.get("location") || ""
  const remote = searchParams.get("remote") === "true"
  const intern = searchParams.get("intern") === "true"
  const type   = searchParams.get("type") || ""   // "contract" → W2/C2C/contractor roles

  // Keys can come from a user's own Settings page (saved client-side, sent as a
  // header — see src/lib/jobsClient.ts) so a non-technical user never has to
  // edit .env.local. Fall back to server env vars for anyone who does set them
  // there (e.g. a real deployment).
  const rapidKey   = request.headers.get("x-rapid-api-key") || process.env.RAPID_API_KEY || null
  const usajobsKey = request.headers.get("x-usajobs-api-key") || process.env.USAJOBS_API_KEY || null

  // Pull all live sources in parallel
  const [jsearch, infosec, usajobs, interns] = await Promise.all([
    fetchJSearch(q, loc, remote, type, rapidKey),    // LinkedIn + Indeed + Glassdoor
    fetchInfosecjobs(q),                              // Infosecjobs.com — cyber-specific
    fetchUSAJobs(q, remote, usajobsKey),              // USAJobs.gov — federal roles
    intern ? fetchHandshakeInterns(q, rapidKey) : Promise.resolve([] as Job[]),  // Handshake intern roles
  ])

  // Merge; de-dupe on normalized company+title
  const seen = new Set<string>()
  const merged: Job[] = []
  // Priority: JSearch (LinkedIn/Indeed/Glassdoor) → Infosecjobs → USAJobs → Handshake interns
  for (const j of [...jsearch, ...infosec, ...usajobs, ...interns]) {
    const k = (j.company + "|" + j.title).toLowerCase().replace(/[^a-z0-9|]/g, "")
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(j)
  }

  if (merged.length) {
    const sources = [...new Set(merged.map(j => j.source))]
    return NextResponse.json({ jobs: merged.slice(0, 80), source: sources.join("+"), live: true, sources })
  }

  // Fallback: curated sample data (cyber + federal + intern roles)
  let filtered = [...SAMPLE]
  if (q) {
    filtered = filtered.filter(j => matchesQuery(q, j.title, j.company, j.description))
  }
  if (loc) {
    const lt = loc.toLowerCase()
    filtered = filtered.filter(j => j.location.toLowerCase().includes(lt) || (j.remote && /remote/i.test(lt)))
  }
  if (remote) filtered = filtered.filter(j => j.remote)
  if (intern) filtered = filtered.filter(j => /intern/i.test(j.title))
  if (type === "contract") {
    filtered = filtered.filter(j =>
      j.workAuth.includes("w2") || j.workAuth.includes("c2c") ||
      /\bcontract|c2c|corp.?to.?corp|w-?2\b/i.test(j.description)
    )
  }
  return NextResponse.json({ jobs: filtered, source: "sample", live: false, sources: ["sample"] })
}
