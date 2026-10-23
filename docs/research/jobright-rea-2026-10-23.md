# Jobright: live REA, 23 October 2026 (part 1: public pages)

Method: **REA tool attempt + public reference review.** The visible text of eight public jobright.ai pages was saved
(home, /ai-agent, /orion-copilot, /job-autofill, /h1b-jobs, /employers/pricing, /tools, /job-referral). Nothing was
run, nothing is copied into MFit. Everything below was observed on their pages on 23 Oct unless marked *inferred*.

**Blocked in this part:**
- **Code files:** they are served from `static.jobright.ai`, which this environment refuses.
- **Extension package:** the Chrome Web Store hands out downloads from `clients2.googleusercontent.com`, also refused.
- **Job-seeker prices:** `/pricing` returns 404, so they are probably shown only after sign-up (*inferred*).

The earlier `jobright-api-recon` entry (17 Oct) covers their job-search API as an Apply source; it is not repeated
here.

## How it is built (observed)

- Next.js; static files on `static.jobright.ai`.
- Public pages: AI Agent (auto-apply), Orion (career copilot chat), Job Autofill (extension), H1B Jobs, Job Referral
  ("insider connections"), TNT Network, Interview Questions, Tools (job tracker, cover letter, resume helper),
  Employers (AI recruiter, fake-candidate detection).
- A separate "Jobright Fraud Detection" extension exists in the Chrome Web Store (id fjaopijojdpdoaihmaoipfccncclmiak).

## What the user sees (observed)

- **Promise:** matched jobs, autofill, a tailored resume and insider connections "in less than 1 min". Agent page:
  "90% Job Search Automation"; one click sends a tailored resume, fills the form and tracks the submission.
- **Proof points they show:** 3,000,000 users; 8,000,000+ jobs, 400,000+ new today; "80% time saved"; "4X" interview
  chance with referrals; autofill "10x faster", "5 hrs saved per user every week", "10 million applications
  autofilled". These are their claims.
- **Match score before autofill:** fit shown per job "based on your skills, not just the title".
- **Autofill onboarding in four steps:** install the extension, set up a profile, open an application and press
  Autofill, then submit.
- **Orion:** 24/7 career chat with company-specific interview insights; free to start.
- **H1B Jobs:** H1B-filtered listings by title, location, work model and experience, with company sponsorship
  history. Carries an honest caveat: "a research starting point, not a sponsorship guarantee".
- **Trust:** a public "Is Jobright Legit?" page; many named testimonials; "no fake listings" claim.

## Employer pricing (their page, 23 Oct)

- **$499 per recruiter per month**, one dedicated AI recruiter per active role, free trial (one role), no card,
  cancel anytime. It promises the first 10 matches in 24 hours, then 10–20 interview-ready candidates a week, verified
  identity and history, and outreach sent as Jobright.
- An annual "talk to us" plan for many roles.
- A **cost-to-fill calculator** next to the price: an agency at 20% of first-year salary ($36,000 on $180,000), job
  boards (~$1,500–$4,000), sourcing tools (~$2,500–$5,500), against $499. Their slogan is "not per seat, not per
  candidate, not a cut of the salary".

## Ideas worth taking for MFit

1. **A match score on every job before applying**, based on skills, not titles (observed). MFit's Apply already has
   one; show it at the moment of applying.
2. **Four-step autofill onboarding**, as plain as theirs (observed).
3. **H1B filter with sponsorship history and an honest caveat** (observed). It fits MFit's GC, H1B and C2C candidates
   directly. *Inferred:* MFit can go further with C2C and GC filters, which Jobright does not show.
4. **A cost-to-fill calculator for staffing clients** (observed on their employer page). *Inferred:* for MFit's
   staffing side, compare a bench-sales desk's cost per placement.
5. **Price by role, not seat** for the employer side (observed).
6. **Free trial with no card**, one role (observed).
7. **A public "Is it legit?" page and an honest caveat line on any claim that could mislead** (observed).
8. **Fake-candidate detection** as an employer feature (observed as a product; how it works was not studied).

## Not done

- Code files, source maps and the extension package (both hosts refused).
- No account, so no job-seeker pricing and no signed-in pages.
- Their usage numbers are their own claims, not checked.
