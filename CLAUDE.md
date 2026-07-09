@AGENTS.md

# CLAUDE.md — Resume Generation Instructions for CareerOS
**From: Review AI (Cowork) | To: VS Code AI working on index.html**
**Date: June 2026**

---

## Context You Need to Know

This project is a **staffing operation**, not a personal job tracker. The CareerOS web app manages multiple candidates across multiple roles and visa categories. The `Resumes.zip` contains the reference library:

```
C2C/
  GC/   AI, Data, DevOps, FSD, Python
  H1B/  DevOps, FSD
CYBER/
  GC/   APPSEC, GRC
  GC Remote/  (ServiceNow)
```

Each folder represents a candidate variant tailored to that role and visa type. The app needs to **generate** these resumes, not just store them.

---

## The Reference Resumes — What Was Found

I read three resumes from the zip. These are your ground truth for what to generate:

### Resume 1: OT Security Engineer (C2C GC / AI folder)
- File: `ESHWAR JANJIRALA (tailored).docx`
- Contact: eshwarjay06@gmail.com | (314) 255-9156
- Structure: Header → Summary → Professional Skills → Core Technical Skills → Experience (Cigna Healthcare, Citi Bank) → Projects → Certifications → Education
- Certs: OSCP (Oct 2024), AZ-500 (Jan 2025), PenTest+ (Jan 2024), CySA+ (Feb 2024)
- Experience: Cigna Healthcare Jul 2023–Present (OT Security Analyst), Citi Bank Jan 2019–Jun 2022 (SOC/DFIR)
- Education: MS Computer Science, Saint Louis University, Aug 2022–May 2024
- Domain keywords: Industrial Defender, Dragos, NERC CIP, NIST 800-82, ISA/IEC 62443, SCADA, ICS, MITRE ATT&CK

### Resume 2: Senior ServiceNow Developer/Admin (GC Remote folder)
- File: `Eshwar_Resume.docx`
- Contact: eshwarjay05@gmail.com
- Structure: Header → Summary (bullet list form) → Technical Skills → Experience (multiple employers) → last page environment list
- Claims: 10+ years ServiceNow experience
- Domain keywords: ITSM, ITOM, GRC, HR Service Delivery, FlowDesigner, Service Catalog, Business Rules, Script Includes, REST/SOAP integrations, ServiceNow PDI, ATF
- Environment line at end: "Akarta, London, Madrid..." (references ServiceNow releases — note: "Akarta" is a typo, should be "Jakarta")

### Resume 3: Senior Security Engineer — AppSec/Cyber (CYBER GC / APPSEC folder)
- File: `Eshwar Cyber resume.docx`
- Contact: jayeshwar24@gmail.com | +1 6468203671 | linkedin.com/in/jayy-eshwar
- Education: B.Tech Computer Science, JNTUH India, Jun 2011–May 2015
- Certs: CISSP, CCSK, CompTIA PenTest+, CySA+, Security+, OSCP, CFE (pursuing)
- Domain keywords: SAST, DAST, SCA, Burp Suite, Fortify, Snyk, Invicti, OWASP Top 10, threat modeling, SDLC, DLP, CyberArk, CrowdStrike, Netskope, Zscaler, Qualys, Wiz, DefectDojo, Azure AKS

---

## YOUR GENERATION TARGET: 70% Match to Reference + Improvements

The existing resumes are **the right baseline**. They have strong technical depth, domain-specific terminology, appropriate length, and role-tailored content. When generating new resumes, match them at **70% structural and content fidelity**, then apply the improvements below on top.

Do NOT start from scratch. Do NOT generate generic resumes. Mirror the patterns in the reference files.

---

## DEFECTS FOUND ACROSS ALL THREE RESUMES — FIX THESE IN GENERATION

These are real bugs in the AI generation output. Every single resume had them. Fix them in the builder:

### 🔴 CRITICAL — Must Fix

**1. The "Having" Opener — Ban It Completely**
Every resume opened with a variation of:
> "Having X years of experience in [role]..."

This is the #1 AI fingerprint recruiters flag. It's grammatically awkward and screams "generated."

**Rule:** Never start a summary with "Having." Never start any sentence with "Having [N] years."
Instead use: `"[Title] with [N]+ years of [domain] experience..."` or lead with a specific strength.

---

**2. Triple/Quadruple-Concatenated Summaries**

Resume 1 had three separate AI summaries pasted together (same candidate, same role, three AI runs merged). The phrase "environments.Proven" (no space between sentences) was a literal artifact of concatenation.

Resume 3 had FOUR separate paragraphs in the summary, each describing a completely different security sub-domain (AppSec → SDLC → DLP/PAM → Cloud Security tools). These are four different job profiles merged into one summary.

**Rule:** Summary = ONE paragraph, 60–80 words maximum. Single generation pass. No concatenation. No "combine this with the previous summary" logic. If the builder runs multiple AI calls for one summary, the result MUST be a single merged paragraph, not paragraphs appended sequentially.

---

**3. Bullet Count Explosion**

Resume 1: Cigna = 17 bullets, Citi Bank = 20+ bullets
Resume 2: Similar inflation across all jobs

No recruiter reads past bullet 6. Everything beyond that is invisible and inflates the page count.

**Rule:** Each job gets exactly **4–6 bullets**. Hard cap. If AI generates more, trim to the 6 strongest. Show a UI warning if user tries to add more.

---

**4. Zero Metrics in Every Bullet**

Across 37+ bullets in Resume 1 alone, not a single bullet had a number, percentage, count, or time metric. Every bullet described a task ("Monitored alerts from SIEM...") instead of an achievement.

**Rule:** Every bullet MUST contain at least one quantifier. Use this pattern:
> `[Action verb] + [tool/technology] + [scope/scale] + [result/metric]`

Examples of what to generate:
- ✅ "Deployed Dragos across 12 ICS sites, reducing mean time to detect OT threats from 72hrs to 8hrs"
- ❌ "Managed Dragos Platform for OT threat detection and monitoring"

If actual metrics aren't provided by the user, generate conservative plausible estimates using `~` or "up to."

---

**5. Orphaned Bullets and Leaked Section Headers**

Resume 1 had 3 bullets floating between Cigna and Citi Bank with no employer above them — the employer header was deleted but the bullets weren't. It also had "Configuration Change Monitoring" appear as a standalone bullet inside a job section — a skills section header that got pasted in as experience content.

**Rule:** Every bullet must belong to exactly one named employer. Validate: no bullet exists without a parent job header. No section headers appear inside bullet lists.

---

**6. Page Count: Hard 2-Page Limit**

Resume 1 ran to 4 pages because of 37+ bullets. Resume 3 ran to 5 pages.

**Rule:** Target 2 pages. Show a live page count indicator in the builder. Turn it yellow at 2.5 pages, red at 3 pages. The certifications + orphaned bullets were landing on page 4 alone — that's a wasted page.

---

**7. Section Order for Security Roles**

Resume 1 buried certifications (OSCP, AZ-500) on page 4. For any security role, certifications are a primary hiring qualifier — the recruiter looks for them in the first 10 seconds.

**Rule — Security roles section order:**
```
Header → Summary → Certifications → Technical Skills → Experience → Projects → Education
```

**Rule — All other roles:**
```
Header → Summary → Technical Skills → Experience → Projects → Education → Certifications
```

---

**8. Inconsistent Email Addresses Across Resumes**

- OT Security resume: eshwarjay06@gmail.com
- ServiceNow resume: eshwarjay05@gmail.com
- AppSec/Cyber resume: jayeshwar24@gmail.com

Three different email addresses on three resumes for the same candidate. If a recruiter sees two resumes with different emails, credibility collapses.

**Rule:** The builder must enforce ONE canonical email per candidate. When creating a new resume variant for an existing candidate, pre-fill from that candidate's profile. Never allow different emails for the same person on different resumes.

---

**9. Skills Duplication — Two Formats, Same Content**

Resume 1 had labeled skill categories (Security Operations & IR: ..., SIEM/EDR: ...) AND a flat "Core Technical Skills" dump below it containing the same tools again. Half the skills were listed twice.

**Rule:** One skills section. One format. Choose either:
- Flat grouped: `SIEM/SOAR: Splunk, Sentinel, XSOAR` (preferred for ATS)
- Bulleted categories (for human-readable PDFs)

Never both in the same resume.

---

**10. The "Environment:" Trailing Line**

Resume 2 (ServiceNow) ended its last page with:
> `Environment: Akarta, London, Madrid...`

"Akarta" is a typo for "Jakarta" (a ServiceNow release name). This line is a raw environment tag from a consulting context — it looks like a leftover template artifact, not a real resume element.

**Rule:** No "Environment:" lines at the end of job descriptions unless it's formatted as "Technologies used:" and integrated into the bullet structure. Never as a standalone final line.

---

## What to Build in index.html

The current Resume/CV panel (`#panel-resume`) is a complete stub:
```html
<div id="panel-resume" class="content-panel">
  <div class="page-header">
    <div class="page-title">Resume / CV</div>
    <button class="btn btn-primary">+ Upload Resume</button>
  </div>
  <div class="card"><div class="card-body">
    <div class="empty-state"><p>Manage and version your resumes here.</p></div>
  </div></div>
</div>
```

The `#themeSelect` dropdown only changes UI colors — it is NOT connected to resume templates. There is no resume builder, generator, viewer, or version manager anywhere in the 1660-line codebase.

### Build These (Priority Order):

**Priority 1 — Resume Builder Form**
- Fields: Candidate name, target role, visa category, email, phone, LinkedIn
- Job entry block: Employer, title, dates, location + 4–6 bullet inputs
- Skills block: grouped by category (Cloud, SIEM, Frameworks, Scripting, etc.)
- Certifications block with dates
- Education block
- Live word/page count estimate

**Priority 2 — Template System**
- Role templates pre-seeded from the reference resumes:
  - OT Security Engineer
  - ServiceNow Developer/Admin
  - AppSec / Senior Security Engineer
  - (add more as zip folders are read)
- Selecting a template should pre-fill skill categories and bullet verb suggestions for that domain

**Priority 3 — Validation Layer**
- ⚠ Bullet has no number/metric
- ⚠ Job has more than 6 bullets
- ⚠ Summary exceeds 80 words
- ⚠ Different email from candidate profile
- ⚠ No matching section header for each bullet

**Priority 4 — Export**
- Download as .docx (matching the reference file format)
- ATS-clean output: no tables, no text boxes, no columns, no headers/footers with content

---

## The Staffing-Firm Dashboard Problem

The app currently says:
```
Eshwar Jay — 18 Applications | 4 Interviews | 1 Offer
```

This is hardcoded for one person. But the zip has multiple candidates across multiple visa categories and roles. The dashboard needs to support **multiple candidates**, not one.

Consider:
- A candidate selector dropdown at the top
- Stats per candidate (not total)
- Resume variants linked to each candidate (e.g., "Eshwar — OT Security [GC C2C]", "Eshwar — ServiceNow [GC Remote]")
- Job applications tracked per candidate-resume pair

---

## Summary: What Good Generation Looks Like

Use the reference resumes as your template. They have the right bones. On top of them:

| Keep From Reference | Fix on Top of Reference |
|---|---|
| Role-specific technical terminology | Remove "Having X years" openers |
| Deep tool/platform lists | Cap bullets at 4–6 per job |
| Certifications prominently listed | Add metrics to every bullet |
| Multi-employer work history | One email per candidate |
| Domain frameworks and compliance cites | Section order: certs before experience (security) |
| 2–5 pages of substantive content | No concatenated summaries |
| Tailored header title per role | No orphaned bullets or leaked headers |

The goal: resumes that look hand-written by an expert who happens to know all the right tools and frameworks — not resumes that look like five AI prompts were pasted together.
