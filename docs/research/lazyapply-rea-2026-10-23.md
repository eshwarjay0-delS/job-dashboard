# LazyApply: live REA, 23 October 2026 (public pages)

Method: **REA tool attempt + public reference review.** The home page and its 21 first-party scripts were saved and
mapped with the endpoint extractor. The visible text of eleven public lazyapply.com pages was saved (home, /faq, /help,
/download-extension, /job-application-automation, /indeed-auto-apply-bot, /pricing, /refundpolicy, /resume-tracker,
/jobs, /terms). Nothing was run, nothing is copied into MFit. Everything below was observed on their pages on 23 Oct
unless marked *inferred*.

**Blocked or missing in this part:**
- Nothing was refused by the network.
- **Source maps:** none published.
- **Extension id:** the install page links to the Chrome Web Store only from a script chunk that did not come back
  (the chunk URL answered with a redirect stub). The Web Store id was not found, so it is not recorded here.
- **`/pricing`** returns the home page. Prices are in the home page's pricing section.

## How it is built (observed)

- Next.js (pages router, `__NEXT_DATA__`, build id present) with MUI components.
- Signed-in app at `app.lazyapply.com/dashboard`. API host `backend.lazyapply.com`. Static content on
  `content.lazyapply.com`.
- API paths seen in public scripts: `/lazyapplyV2/plan-details/`, `/lazyapplyV2/create-payment-link`,
  `/lazyapplyV2/plans-enterprise-waitlist`, `/upgradeplanpaddle`. *Inferred:* an enterprise plan is on a waitlist.
- Outside services: Paddle checkout, Google Ads tag, tawk.to live chat, Typekit and Google Fonts, Trustpilot images.
- Blog at `/job-application-automation` runs on Superblog. The resume tracker gives each user a `*.rsme.io` link.
- Source maps: no.
- Company: their refund policy names Peve Visions Private Limited, India, trading as LazyApply.

## What the user sees (observed)

- **Promise:** a Chrome extension that applies to jobs on Greenhouse, Dice, Indeed and ZipRecruiter "in a single
  click", driven by what they call "Job GPT".
- **Onboarding:** install the extension, which opens a dashboard; log in; build a profile; pick filters; press
  start.
- **Indeed bot filters:** total jobs per run, remote only, salary range, date posted, title and location.
- **Other features:** referral emails sent to employees at the target company; one analytics dashboard for
  applications and referral emails; a resume view tracker; a free job board; many small AI writing tools
  (LinkedIn headline, cover letter, resignation letter, resume score).
- **Job board:** "Found 172,133 jobs" on the day. Filters include a **Visa Sponsorship** filter with "H1B Sponsors"
  and "UK Visa Sponsors", and job cards carry an "H1B Visa Sponsor" badge. The page does not say where the sponsor
  data comes from.
- **Volume and trust claims:** 4.9 rating, "50000+ users", "Save 100's of hours". They also claim their scripts mean
  "your profiles will never get blocked by platforms". These are their claims.
- **Testimonials** are styled as Google, Trustpilot, X, WhatsApp and LinkedIn posts, mostly without links.
- **No free trial.** A live demo is offered by email.

## Pricing (their page, 23 Oct)

Billed annually. Struck-through prices are shown next to each plan.
- **Basic Plan:** $99 per year (was $119). 15 applications a day, 1 resume profile, basic analytics, email support.
- **Premium Plan** ("Most Popular"): $149 per year (was $179). 150 applications a day, 5 resume profiles.
- **Ultimate Plan** ("10X Value"): $999 per year (was $1099). 1500 applications a day, 20 resume profiles, advanced
  analytics, priority support.
- The plan must be attached to a Gmail address.
- **30-day refund**, but only on the first subscription, only if fewer than 100 jobs were applied to, and only if
  the product fails to work as advertised.

Note: AIApply's comparison page lists LazyApply Premium at $199. LazyApply's own page shows $149 on 23 Oct.

## Ideas worth taking for MFit Apply

1. **A visa sponsorship filter and badge on every job** (observed). For MFit this should cover H1B sponsor history,
   C2C allowed, and "USC/GC only" exclusions, with the data source shown on the badge (*inferred*).
2. **Resume profiles as a plan unit** (observed: 1, 5 and 20 profiles). *Inferred:* in MFit a profile maps to a
   candidate plus a resume variant (for example GC C2C DevOps), which suits a bench-sales desk.
3. **Per-run limits the user sets** (observed: total jobs per run, date posted, salary, remote). MFit can add a
   per-candidate daily cap so one candidate is not flooded into the same client (*inferred*).
4. **A daily cap tied to the plan** (observed). *Inferred:* for staffing, a cap per client or per vendor matters more
   than a cap per day.
5. **One dashboard for applications and outreach emails** (observed). MFit already tracks applications; adding
   recruiter and vendor emails to the same view fits C2C work (*inferred*).
6. **Resume view tracking with a unique link** (observed). *Inferred:* useful for staffing, so the desk sees whether
   a client opened a candidate's resume. Needs consent and a clear notice.
7. **Do not copy:** the "never get blocked" promise, unlinked styled testimonials, and a refund that lapses after 100
   applications (observed). MFit should state limits honestly instead (*inferred*).
8. **Do not copy:** referral emails sent to employees automatically (observed). For MFit, any outreach on a
   candidate's behalf should need the candidate's approval per message (*inferred*).

## Not done

- No account, so no dashboard, extension or signed-in pages.
- Extension package and its Web Store id were not fetched.
- The H1B sponsor badge source and accuracy were not checked.
- Their usage numbers and ratings are their own claims, not checked.
