# AIApply: live REA, 23 October 2026 (public pages)

Method: **REA tool attempt + public reference review.** The home page and its five first-party scripts were saved and
mapped with the endpoint extractor. The visible text of public aiapply.co pages was saved (home, /auto-apply,
/product, /pricing, /compare/aiapply-vs-lazyapply, /llms.txt, /students, /tools, /ai-job-interview). Nothing was
run, nothing is copied into MFit. Everything below was observed on their pages on 23 Oct unless marked *inferred*.

**Blocked or missing in this part:**
- **`hire.aiapply.co`** (their hiring product): refused by this environment ("Tunnel connection failed: 403").
- **`/pricing`** returns the home page, which has no price table. **`/faq`** is 404. **`/product`** is almost empty.
- **Source maps:** none published.
- **Extension:** no Chrome extension is linked from the pages read.
- Three third-party scripts (Rewardful, Google tag, Cookiebot) were not fetched, by design.

## How it is built (observed)

- Server-rendered pages with Vite assets under `/build/assets/` and a `/resources/js/` path. *Inferred:* Laravel with
  Vite.
- Behind Cloudflare (its email-protection script is on the page). Images on Google Cloud Storage
  (`assets-aiapply` bucket). Company logos from logo.dev.
- Analytics: PostHog (EU) routed through their own subdomain `coconut.aiapply.co` (*inferred:* a first-party proxy),
  Google Analytics 4, Cookiebot consent.
- Affiliates through Rewardful. Trustpilot review images.
- Signed-in job board at `/app/jobs`. No API paths are visible in the public scripts.
- 14 locales. They publish `/llms.txt` for AI assistants and an "Open Knowledge Format" bundle.
- Structured data on the home page: a free offer (price 0 USD), rating 4.8 from 850 ratings.
- Company: AIApply Ltd, UK.
- Source maps: no.

## What the user sees (observed)

- **Promise:** find high-match roles, tailor the resume and cover letter, auto-apply, and coach live in interviews.
  Headline: "76% of users get an interview in first 10 days".
- **Auto Apply onboarding:** a short quiz, upload a resume or LinkedIn profile, set roles, locations and companies to
  target or avoid, then it applies daily in the background.
- **Auto Apply details from its FAQ:** a match score per job; include and exclude lists for companies; reposted jobs
  are recognised so the same role is not applied to twice; the dashboard shows **which resume version was sent to
  each job**; drafts can be reviewed before sending; applications are "sent through trusted domains".
- **Home page demo data** shows job cards with a score, a reason, a list of matching points and a list of gaps.
  *Inferred:* the real product shows matches and gaps per job.
- **Other products:** resume builder (with LinkedIn import), cover letters, ATS resume scanner, resume translator,
  mock interviews, and "Interview Buddy", which gives live answers during Zoom, Meet or Teams calls. About 30 free
  tools, including a contractor rate calculator.
- **Job sites:** "20M+ Jobs" from "thousands of sources". No named job boards or ATS on the pages read.
- **Volume and trust claims:** "Loved by 2,064,348 users", "372,241+ roles applied to", "80% more likely" to get a job
  faster, "4.8 out of 5 stars from over 500,000 reviews" (comparison page). The structured data says 850 ratings.
  These numbers do not agree with each other and were not checked.
- **Comparison pages** against seven rivals. The LazyApply one lists LazyApply Premium at $199; LazyApply's own page
  shows $149. It also says LazyApply has no AI document tools, while LazyApply links to several.

## Pricing (their pages, 23 Oct)

No public price table. What their pages do say:
- **Free tier:** cover letters, resume scanner and job board.
- **Pro / Premium:** "~$12/mo" on yearly billing (comparison page). Monthly and annual billing exist.
- **Auto Apply credits:** sold separately in packs ("e.g., 100 or 250"). One credit is one application. Credits never
  expire. Pack prices are not shown. The comparison page says "up to 500" tailored applications a month.
- **Students:** "40% off" on the comparison page, "half the price" on the students page.
- **Refunds:** case by case. Subscriptions renew until cancelled.

## Ideas worth taking for MFit Apply

1. **Record which resume variant went to which job** (observed). For a staffing desk this is essential: the desk
   must know which candidate variant (for example GC C2C Python) reached which client and through which vendor
   (*inferred*).
2. **Show matches and gaps next to the score** (observed in demo data). For visa candidates, a gap line such as
   "role says no sponsorship" or "W2 only" would stop a wasted submission (*inferred*).
3. **Detect reposted jobs** so a candidate is not submitted twice (observed). *Inferred:* in staffing a duplicate
   submission to the same client can lose the candidate, so MFit should check across vendors too.
4. **Pay per application with credits that never expire** (observed). *Inferred:* fits a desk that works in bursts.
5. **Include and exclude lists for companies** (observed). MFit can add an exclude list per candidate for clients
   already submitted elsewhere (*inferred*).
6. **A contractor rate calculator** (observed as a free tool). *Inferred:* useful for C2C candidates, who quote an
   hourly rate, not a salary.
7. **Publish an `llms.txt`** describing MFit Apply honestly (observed on their site).
8. **Do not copy:** claims that employers cannot tell AI was used, live answers during interviews, and user counts
   that do not agree with each other (observed). These carry trust and ethics risk (*inferred*).

## Not done

- No account, so no credit prices, no dashboard and no signed-in pages.
- `hire.aiapply.co` was refused by the network.
- Which job boards or ATS Auto Apply submits to was not visible.
- Their usage numbers and ratings are their own claims, not checked.
