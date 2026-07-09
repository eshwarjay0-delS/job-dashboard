# CareerOS AI Assistant — "Nexus" — Design Spec
**Based on:** Reverse-engineering Jobright Orion AI  
**Date:** June 28, 2026

---

## What We Learned from Orion

From our 26-question automated interview, here's what Orion actually does under the hood:

| System | How Orion Works | What We'll Build |
|--------|----------------|-----------------|
| Job matching | Skills (highest) + Experience + Industry, weighted aggregate | Same — with visible score breakdown |
| Skill matching | Keyword + semantic embeddings (both) | OpenRouter embeddings via `text-embedding-3-small` |
| Skill aliases | Alias mapping (K8s = Kubernetes) | Pre-built alias dictionary + embedding fallback |
| Resume parsing | OCR + NLP → section detect → entity extract → structured fields | `pdf-parse` + GPT-4o for extraction |
| Seniority inference | Job titles + years + scope + progression | Same signals + explicit seniority field |
| H1B data | DOL LCA last 3-5 years + keyword detection | Same — DOL data is public |
| Deduplication | Title + company + location + description similarity | Jaccard similarity + company normalization |
| Refresh rate | At least daily | Hourly for JSearch, daily for others |
| Indexing delay | Hours to a day | Target: <2 hours via cron |
| Network/connections | Public data + real-time LinkedIn queries | LinkedIn public profiles via browser extension |
| AI model | UNKNOWN (hard-blocked) — likely GPT-4o or Claude | OpenRouter → claude-sonnet or gpt-4o |
| Context injection | UNKNOWN (hard-blocked) | We'll define ours openly |
| Internet access | UNKNOWN — likely NO (internal DB only) | NO for now — internal DB only, searchable |

---

## Architecture: CareerOS Nexus

### System Prompt (what gets injected per job)

```
You are Nexus, CareerOS's AI job assistant. You help candidates find and land jobs.

CURRENT JOB CONTEXT:
- Title: {{job.title}}
- Company: {{job.company}}
- Location: {{job.location}}
- Posted: {{job.postedAt}}
- H1B Sponsor: {{job.h1bLikely ? "Likely" : "Unknown"}}
- Full JD: {{job.description}}

CANDIDATE PROFILE:
- Name: {{profile.name}}
- Target roles: {{profile.targetRoles}}
- Skills: {{profile.skills.join(", ")}}
- Experience: {{profile.yearsExp}} years
- Current match score: {{matchScore}}%
- Work auth: {{profile.workAuth}}

CAPABILITIES YOU HAVE:
- Analyze match score breakdown on request
- Suggest resume improvements for this specific job
- Explain why H1B score was assigned
- Help draft a cover letter
- Generate interview prep questions for this role
- Answer questions about CareerOS features

TOPICS TO AVOID:
- Do not discuss competitors' internal systems
- Do not make specific salary guarantees
- Do not make hiring predictions
```

---

## Feature Spec

### 1. Match Score Engine

```typescript
interface MatchScore {
  total: number;           // 0-100
  breakdown: {
    skills: number;        // weight: 45%
    experience: number;    // weight: 30%
    education: number;     // weight: 15%
    location: number;      // weight: 10%
  };
  missingSkills: string[];
  matchedSkills: string[];
  aliasesUsed: string[];   // e.g., "K8s → Kubernetes"
}
```

**Scoring algorithm:**
1. Extract required skills from JD using GPT-4o
2. Compare to candidate skills using:
   - Exact match: 1.0 score
   - Alias match (K8s/Kubernetes): 0.95 score
   - Semantic embedding similarity > 0.85: 0.8 score
   - No match: 0.0
3. Skills score = (matched skills / required skills) × 100
4. Experience score = compare years in JD vs profile (within 1yr = 100%, 2yr gap = 70%, 3+ = 40%)
5. Education = match degree level to requirement
6. Location = remote OK = 100%, same city = 100%, different city = 60%

### 2. H1B Scoring

**Data source:** US DOL PERM/H1B LCA disclosure files (public)  
**Download:** https://www.dol.gov/agencies/eta/foreign-labor/performance  
**Update:** Annually (new fiscal year data released ~Q2)

**Scoring:**
```typescript
function getH1BScore(companyName: string): 'likely' | 'possible' | 'unknown' {
  const normalized = normalizeCompanyName(companyName);
  const petitions = dolData.filter(r => 
    r.employer_name_normalized === normalized &&
    r.fiscal_year >= currentYear - 3
  );
  if (petitions.length >= 10) return 'likely';
  if (petitions.length >= 1)  return 'possible';
  return 'unknown';
}
```

**UI:** Same badge system as Jobright — "H1B Sponsor Likely 🟢" / "H1B Possible 🟡"

### 3. Resume Parser

```typescript
// Pipeline:
// 1. pdf-parse → raw text
// 2. GPT-4o extract → structured JSON
// 3. Store in candidate profile

const PARSE_PROMPT = `
Extract the following from this resume text as JSON:
{
  "name": "",
  "email": "",
  "phone": "",
  "linkedIn": "",
  "skills": [],
  "yearsExperience": 0,
  "seniorityLevel": "entry|mid|senior|staff|principal",
  "jobs": [{ "title": "", "company": "", "startDate": "", "endDate": "", "bullets": [] }],
  "education": [{ "degree": "", "field": "", "school": "", "year": "" }],
  "certifications": []
}

Resume text:
{{resumeText}}
`;
```

**Seniority inference rules:**
- Titles containing "Senior/Sr/Lead/Principal/Staff": senior+
- 0-2 years: entry
- 3-5 years: mid
- 6-10 years: senior
- 10+ years: staff/principal
- Override with explicit title

### 4. Nexus Chat Interface

**Where it appears:**
- Job detail panel (right side) — pre-loaded with job context
- Dashboard widget — general career Q&A
- Resume builder — suggestions mode

**Context injection flow:**
```
User opens job → 
  loadJobContext(jobId) → 
  loadCandidateProfile() → 
  computeMatchScore() → 
  buildSystemPrompt() → 
  initNexusChat()
```

**Capabilities Nexus should have:**

| Command | What it does |
|---------|-------------|
| "Why is my score X%?" | Returns breakdown by category with specific missing skills |
| "How can I improve?" | Lists specific skills to add to resume for this job |
| "Write my cover letter" | Generates tailored cover letter using JD + profile |
| "Prep me for interviews" | Returns 10 likely interview questions for this role |
| "Is this job H1B friendly?" | Explains H1B score with DOL data summary |
| "Tailor my resume" | Returns bullet improvements matching JD keywords |
| "What skills am I missing?" | Diff of required vs candidate skills |

### 5. Deduplication Engine

```typescript
function isDuplicate(jobA: Job, jobB: Job): boolean {
  if (normalizeCompany(jobA.company) !== normalizeCompany(jobB.company)) return false;
  
  const titleSim = jaccardSimilarity(
    tokenize(jobA.title), tokenize(jobB.title)
  );
  if (titleSim > 0.7) return true;
  
  const descSim = cosineSimilarity(
    embed(jobA.description.slice(0,500)),
    embed(jobB.description.slice(0,500))
  );
  return descSim > 0.9;
}
```

### 6. Feedback Loop (what Jobright wouldn't tell us)

Our implementation — transparent:
```typescript
// When user clicks Not Interested:
await supabase.from('job_feedback').insert({
  candidate_id, job_id, signal: 'not_interested',
  job_role_category: job.roleCategory,
  job_seniority: job.seniority,
  timestamp: new Date()
});

// When computing Recommended feed:
const dislikedCategories = await getDislikedCategories(candidateId);
// Down-rank jobs in those categories by 30%
```

---

## Implementation Plan (phased)

### Phase 1 — Core Chat (1-2 days)
- [ ] Add `/api/nexus` route using OpenRouter
- [ ] System prompt template with job + profile injection
- [ ] Chat UI component (already have AI Copilot base)
- [ ] Wire to job detail panel

### Phase 2 — Match Score Breakdown (1 day)
- [ ] Skill extraction from JD via GPT
- [ ] Alias dictionary (200 common tech aliases)
- [ ] Score breakdown UI (donut chart with Skills/Exp/Edu/Location)

### Phase 3 — H1B Data (2 days)
- [ ] Download + parse DOL LCA CSV (2021-2024)
- [ ] Company name normalization
- [ ] Badge scoring logic
- [ ] Store in Supabase for fast lookup

### Phase 4 — Resume Parser Enhancement (1 day)
- [ ] Upgrade current parser to GPT-4o extraction
- [ ] Seniority inference
- [ ] Skills auto-population into profile

### Phase 5 — Recommendations + Feedback (2 days)
- [ ] Not Interested / Apply signals stored
- [ ] Recommended feed re-ranking based on signals
- [ ] Weekly "jobs you might have missed" email digest

---

## Key Differentiators vs Jobright

| Feature | Jobright | CareerOS Nexus |
|---------|---------|----------------|
| Match score breakdown | Hidden | Fully visible by category |
| H1B data years | 3-5 years (they said) | User-selectable (1-5 years) |
| Skill aliases | Silent | Shows "We matched K8s → Kubernetes" |
| AI model | Unknown | Shown in UI (transparency feature) |
| Feedback loop | Unknown | Explicit — "Based on 12 Not Interested clicks in DevOps..." |
| Data freshness | Hours to a day | Target: <2 hours |
| Multi-candidate | No | Yes (staffing firm mode) |

---

## API Routes to Build

```
POST /api/nexus              → AI chat with job + profile context
POST /api/match-score        → Compute match % breakdown for job+profile pair
GET  /api/h1b/:company       → H1B sponsorship likelihood + history
POST /api/resume/parse       → Upload PDF → extract structured profile
POST /api/jobs/feedback      → Record Not Interested / Apply signals
GET  /api/jobs/recommended   → Personalized job feed with feedback weighting
```
