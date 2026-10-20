# Resume — Master Vision

*Draft captured 2026-10-17 from the owner's existing product. Owner to review and correct — this is the starting point, not the final word.*

## The one-liner

Your resume, fitted to every job and filed in one place — built once, tailored forever.

## What Resume is

The resume workshop inside MarketFit: build it, format it, fit it to each job description, and keep every version filed. The resume is never a static document here — it's a living profile that reshapes itself per application.

## Pillars

### 1. Build

- **Make Resume**: build a resume one part at a time — guided, section by section, no blank-page fear.
- **Resume Formatting**: take an existing resume and turn it into the approved professional format. Structure and polish, not rewriting history.

### 2. Fit (tailoring)

- Every resume can be **fitted to a job description**: keywords, skills, and experience re-weighted to what the JD asks for — without inventing anything the user hasn't done.
- **WhatsApp flow**: send a job post + your resume, get back a resume fitted to that job. The fastest tailoring loop in the product.
- The quality baseline is documented (`docs/resume-quality-baseline.md`) — tailoring must never drop below it.

### 3. File

- **Files**: every resume version kept in one place, labeled by job/role/date. When a recruiter asks "send your latest," the answer is one tap.
- Versions are never lost: each tailoring creates a new filed version, never overwrites the baseline.

## How it connects

- **Apply tab**: at apply time, the user picks a filed resume or generates a JD-tailored one on the spot (Apply vision, pillar 3).
- **Kompas**: the dossier feeds on filed resumes — real project history grounds interview answers.
- **Gmail**: the agent attaches the right resume version to submissions and drafts.

## Standing rules (never break)

- **95–100% JD match, undoubtedly.** Every tailored resume reports its measured JD keyword coverage — WhatsApp caption, web result headline — and repair passes climb toward the 98% target. Below 95%, the result says so plainly.
- **Tailoring re-presents; it never fabricates.** No invented metrics, platforms, certifications, or backdated experience. Honest gaps are listed (tap-to-add), never faked.
- There is no single resume — there's the right resume per job.

## Credential-target regression — 20 October 2026

The 19 October instruction to ignore certifications as tailoring targets is retained. The classifier now recognizes terminal-plus credential names and Salesforce Platform Developer I/II and CPQ Specialist without a Certified prefix. Unsupported credentials are removed from rewritten skills; original credentials remain. Evidence: `docs/research/credential-target-boundaries.md`. Live generation acceptance remains pending.

## Rewrite completeness — 20 October 2026

High keyword overlap does not make unfinished role rewrites complete. Partial outputs can retain the existing 95% delivery-floor behavior, but never receive completed status or enter the completed-result cache. Cache generation 15 invalidates older completion classifications without deleting resumes. Evidence: `docs/research/resume-completeness-cache.md`.

## Actual counts and weighting — 20 October 2026

Matched-term counts must come from the exported document, not a weighted percentage converted into an integer. Weighted coverage remains separate; both measures must meet the existing acceptance thresholds. Cache generation 16 supersedes generation 15 while retaining its incomplete-rewrite safeguard. Evidence: `docs/research/resume-score-counts.md`.
