# REA: Jobscan — Resume Tailor Market Leader

**Date:** 2026-10-18
**Method:** Public reference review (pricing pages, reviews, methodology docs)
**Request:** Owner: REA other resume tailor tools to achieve our 95-100% vision correctly.

## Match Rate Formula (their actual procedure)
Priority order, highest weight first:
1. **Hard skills** — tools, platforms, certifications, technical terms
2. **Education level** — only when JD requires advanced degree
3. **Job title** — match to the role title
4. **Soft skills** — communication, leadership, etc.
5. **Other keywords** — buzzwords, generic terms

NOT factored: resume word count, JD word count, measurable results.

## Their Benchmark (critical context)
- **75%** is Jobscan's recommended target
- **65%** minimum worth applying with
- 75% produces most consistent callback improvement

Our 95-100% target is FAR more aggressive than the industry leader's recommendation.

## The Uncomfortable Truth (from their own docs)
"When you submit your resume to a job, the ATS doesn't score your resume.
The match rate in our scanner is a visualization tool." — Jobscan

A recruiter never sees the percentage. What actually happens: the recruiter
types words from the job advert into a search box. The system ranks by keyword match.

**What matters:** "Use the words of the advert where they are true of you.
Ignore the percentage."

## ATS-Specific Intelligence
Jobscan detects the ATS behind each posting (iCIMS, Lever, Greenhouse, Taleo)
and weights advice to that parser's rules. Not one generic check.

## What We Borrowed
1. **Weighted coverage** (SHIPPED): hard skills 3x, job titles 2x, soft skills 1x,
   buzzwords 0.5x. Implemented in `weightedCoverage()` (src/lib/keywords.ts),
   wired into tailor quality scoring (src/lib/tailor.ts).
2. **Missing-terms prioritization**: gaps sorted by weight descending — fix hard
   skills first, not buzzwords.

## What We Did NOT Borrow
- Their 75% target: owner set 95-100%, we honor his bar.
- Their "visualization tool" framing: we present coverage honestly as keyword
  alignment, not a hiring prediction.

## Implication for Our Vision
The 95% target is achievable on weighted coverage because low-weight buzzwords
no longer block delivery. A resume missing 5% of generic filler but hitting all
hard skills scores 95%+ weighted — and that's what actually passes recruiter searches.
