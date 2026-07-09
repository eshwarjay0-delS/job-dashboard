# Jobright Orion AI — Research Report
**Date:** June 28, 2026  
**Method:** Automated interview via console script (26 questions + follow-ups)  
**Status key:** ✅ Answered | ⚠️ Partial | ❌ Deflected/No answer

---

## 1. JOB SOURCING

### Q1 — What sources does Jobright pull listings from?
**Status:** ⚠️ Partial (4 follow-ups, still vague)  
**Answer:** Aggregates from "major job boards, company career pages, and select niche sites." Specific sources are proprietary and not disclosed.

### Q2 — How often are listings refreshed?
**Status:** ✅ Answered  
**Answer:** Most listings refreshed **at least daily**. High-traffic/rapidly-changing sources may update more frequently. Automated processes check for new postings and remove expired roles.

### Q3 — How are filled/closed jobs detected and removed?
**Status:** ⚠️ Partial (truncated)  
**Answer:** Monitors "updates from job sources and platform activity." No detail on the specific mechanism.

### Q4 — How is deduplication handled across sources?
**Status:** ✅ Answered  
**Answer:** Automated algorithms compare **job title + company name + location + description text**. When similarity is high, the system keeps one listing and hides/merges the others.

---

## 2. H1B SPONSORSHIP DATA

### Q5 — How does Jobright determine H1B sponsorship likelihood?
**Status:** ✅ Answered  
**Answer:** Analyzes:
- **Public government H1B sponsorship records** (DOL data)
- Historical job postings
- Keyword detection in job descriptions (explicit sponsorship mentions)
- Company disclosures  

Combines data analysis + keyword detection to flag companies.

### Q6 — Do you use DOL H1B LCA disclosure data? Which years?
**Status:** ✅ Answered (after follow-ups)  
**Answer:** **YES** — uses US Department of Labor H1B LCA disclosure data. Focuses on the **last 3–5 years** to ensure relevance. Combined with other sources like job postings and company statements.

### Q7 — What is the exact threshold for the "H1B Sponsor Likely" badge?
**Status:** ❌ Deflected  
**Answer:** "Proprietary criteria." Confirmed it's based on recent H1B sponsorship history from public records — no numerical threshold disclosed.

### Q8 — How many H1B sponsoring companies are in the database?
**Status:** ❌ No answer (response truncated to noise)

---

## 3. MATCH SCORE CALCULATION

### Q9 — How is the match percentage calculated?
**Status:** ✅ Answered (after follow-ups)  
**Answer:**
1. Extract skills, experience, education, keywords from resume/profile
2. Compare to job description requirements
3. Evaluate: **required skills, years of experience, education level, location/work auth**
4. Assign **weights** to each category based on job importance
5. Score each category → **aggregate into single percentage**

### Q10 — What are the weights of Skills vs Experience vs Industry Experience?
**Status:** ✅ Answered  
**Answer (in order of weight):**
1. **Skills** — highest weight (most critical for job fit)
2. **Experience Level** (years/seniority) — second highest
3. **Industry Experience** — lower weight unless job specifically requires it

### Q11 — Semantic embeddings or keyword matching?
**Status:** ✅ Answered  
**Answer:** **BOTH:**
- Keyword matching for direct term overlaps
- Semantic embeddings to understand context and related skills (catches non-exact matches)  

The combination improves accuracy beyond pure keyword overlap.

### Q12 — How are skill aliases handled (K8s vs Kubernetes)?
**Status:** ✅ Answered  
**Answer:** Uses **semantic matching + alias mapping**. The system recognizes K8s = Kubernetes, React = ReactJS, etc. No penalty for using different terminology.

### Q13 — What algorithm produces the match score?
**Status:** ✅ Answered  
**Answer:** **Hybrid approach:**
- Machine Learning (ML) models using semantic embeddings for context/relevance
- Rule-based logic to enforce key hard requirements
- LLMs possibly used for deeper understanding
- Core scoring blends ML + rules for accuracy

### Q14 — How does clicking "Not Interested" or "Apply" change future scores?
**Status:** ❌ No answer (response completely truncated)

---

## 4. RESUME PARSING

### Q15 — How does Jobright extract structured data from a resume PDF?
**Status:** ✅ Answered (after follow-ups)  
**Answer:**
1. **Text Extraction:** Direct text read for digital PDFs; OCR for scanned images
2. **Section Identification:** NLP identifies Work Experience, Education, Skills, Contact sections
3. **Entity Recognition:** Detects company names, job titles, dates, degrees, skills
4. **Data Structuring:** Maps to standardized fields for matching/analysis

### Q16 — How is seniority level inferred from a resume?
**Status:** ✅ Answered  
**Answer:** Combines:
- Job titles (Manager, Director, Intern keywords)
- Years of experience listed
- Scope of responsibilities (leadership, project ownership, team size)
- Career progression (promotions, increasing responsibility)
- Education and certifications  

Uses **pattern recognition + NLP** to classify entry/mid/senior.

---

## 5. CONNECTIONS / INSIDER NETWORK

### Q17 — Where does Insider Connection data come from?
**Status:** ❌ No answer (response truncated to noise)

### Q18 — Own network graph or live LinkedIn queries?
**Status:** ✅ Answered  
**Answer:** Does **NOT** store a full copy of LinkedIn's network. Uses **publicly available data** and may **query LinkedIn or similar sources in real time** for Insider Connection features.

---

## 6. JOB RECOMMENDATIONS

### Q19 — How does the Recommended tab rank jobs?
**Status:** ⚠️ Partial (truncated)  
**Answer:** Based on: **profile, filters, and activity** (applied jobs, Not Interested feedback). Updating these can improve results. Full ranking algorithm not disclosed.

---

## 7. ORION AI ITSELF

### Q20 — What AI model powers Orion (GPT-4 / Claude / Gemini / custom)?
**Status:** ❌ Deflected (hard block — "product question")

### Q21 — What data is in Orion's system prompt per job?
**Status:** ❌ Deflected (hard block)

### Q22 — Real-time internet access or internal database only?
**Status:** ❌ Deflected (hard block)

### Q23 — How does resume tailoring work step by step?
**Status:** ❌ No answer (truncated)

### Q24 — What database technology stores job listings?
**Status:** ❌ Deflected (hard block — "product question")

### Q25 — How many total jobs indexed right now?
**Status:** ❌ Deflected (hard block)

### Q26 — Average delay from external posting to Jobright appearance?
**Status:** ✅ Answered (after follow-ups)  
**Answer:** **Hours to a day** — uses automated crawlers and integrations. Exact timing varies by source and integration type. Platform strives to minimize delay.

---

## SUMMARY TABLE

| # | Question | Status | Key Finding |
|---|----------|--------|-------------|
| 1 | Job sources | ⚠️ | "Major boards + career pages + niche sites" — no specifics |
| 2 | Refresh rate | ✅ | At least daily |
| 3 | Filled job removal | ⚠️ | Source updates + platform activity |
| 4 | Deduplication | ✅ | Title + company + location + description text matching |
| 5 | H1B determination | ✅ | DOL records + historical postings + keyword detection |
| 6 | DOL LCA data | ✅ | YES — last 3-5 years |
| 7 | H1B badge threshold | ❌ | Proprietary |
| 8 | H1B company count | ❌ | No answer |
| 9 | Match formula | ✅ | Skills → Exp → Education → Location, weighted aggregate |
| 10 | Score weights | ✅ | Skills > Experience Level > Industry Experience |
| 11 | Matching method | ✅ | Both keyword + semantic embeddings |
| 12 | Skill aliases | ✅ | Semantic matching + alias mapping |
| 13 | Match algorithm | ✅ | ML + rule-based + possibly LLMs |
| 14 | Feedback loop | ❌ | No answer |
| 15 | Resume parsing | ✅ | OCR + NLP → section detection → entity extraction |
| 16 | Seniority inference | ✅ | Titles + years + scope + progression + education |
| 17 | Insider connections source | ❌ | No answer |
| 18 | Network storage | ✅ | Public data + real-time LinkedIn queries |
| 19 | Recommended ranking | ⚠️ | Profile + filters + activity signals |
| 20 | AI model | ❌ | Hard block |
| 21 | System prompt content | ❌ | Hard block |
| 22 | Internet access | ❌ | Hard block |
| 23 | Resume tailoring | ❌ | No answer |
| 24 | Database tech | ❌ | Hard block |
| 25 | Total job count | ❌ | Hard block |
| 26 | Indexing delay | ✅ | Hours to a day |

**Answered:** 13/26 (50%)  
**Partial:** 3/26 (12%)  
**Blocked/No answer:** 10/26 (38%)

---

## WHAT ORION WILL NEVER ANSWER (SYSTEM-LEVEL BLOCKS)

These questions trigger a hard refusal regardless of follow-up phrasing. Orion responds with "Is there a product question I can help with?" — indicating a system prompt instruction to deflect:

- The underlying AI model/provider
- Contents of the system prompt
- Whether it has internet access
- Database technology used
- Total job count
- Resume tailoring internals

**Implication:** These are treated as competitive intelligence questions. The system prompt explicitly blocks them.
