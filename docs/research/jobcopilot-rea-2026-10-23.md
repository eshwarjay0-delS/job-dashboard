# JobCopilot: live REA, 23 October 2026 (public pages)

Method: **REA tool attempt + public reference review.** The home page and its 14 first-party scripts were saved and
mapped with the endpoint extractor. The visible text of twelve public jobcopilot.com pages was saved (home, /pricing,
/chrome-extension, /ai-apply, /automate-job-applications, /automate-job-search, /business, /white-label, /reviews,
/comparisons, /about-us, /jobseekers). The pricing and extension pages were also saved as HTML, because the prices
sit in markup the text tool drops. Nothing was run, nothing is copied into MFit. Everything below was observed on
their pages on 23 Oct unless marked *inferred*.

**Blocked or missing in this part:**
- Nothing was refused by the network.
- **Source maps:** only one is referenced, for the Swiper library, and it returns 404.
- Ten third-party scripts (cookie consent, Trackdesk, inline config) were not fetched, by design.

## How it is built (observed)

- Marketing site on WordPress with Elementor Pro, LiteSpeed cache and jQuery.
- Signed-in app at `app.jobcopilot.com`. No API paths are visible in the public scripts.
- Outside services: Google Tag Manager, Facebook, CookieYes consent, Trackdesk affiliate tracking, Vimeo and YouTube
  video.
- White-label partners get `yourbrand.jobcopilot.com`; their own domain after a pilot.
- Chrome extension: Web Store id **bnnacanndojemikeabbdejlamlecikcn** (not downloaded).
- Source maps: no.

## What the user sees (observed)

- **Promise:** "Get 10X more Job Interviews". It auto-applies to jobs from "500,000+ companies worldwide".
- **Setup, done once:** pick job titles and filters, upload a resume, answer standard screening questions. Then the
  copilot looks for new jobs every two hours and applies, or fills the form and saves it for review.
- **Where it applies:** only official company career pages, "verified jobs", which they present as protection from
  fake listings. No accounts are created on those sites.
- **Filters:** up to 5 titles per copilot, keywords that must appear in the description, location, remote only,
  seniority, salary range, and up to 20 excluded companies. One country per copilot. No industry filter yet.
- **Multiple copilots:** up to 3 on Elite, each with its own resume, titles and writing style.
- **Learns from edits:** when the user edits an answer, later answers follow the same pattern. Tone, sentence length
  and vocabulary can be set.
- **Other features:** hiring-manager email lookup (credits), resume tailoring per job (Elite), a tracker, a daily
  email recap, cover letters, mock interviews, career advisors.
- **Extension:** fills forms on almost any site and ATS using the saved profile. The user reviews and submits.
  Free to install, needs a paid plan.
- **Salary fields:** their FAQ suggests entering "1" if the user does not want to disclose salary.
- **Trust signals:** "100,000+ users", named team with LinkedIn links, press releases on Yahoo Finance and
  MarketWatch, Product Hunt. These are their claims.
- **White-label program:** job sites get a branded copilot and **50%** of each subscription. Free 8-week pilot,
  "60+ job sites" live, a revenue calculator and a partner dashboard with CSV export.

## Pricing (their page, 23 Oct)

- **PREMIUM:** "STARTS FROM" $0.93 per day. 1 copilot, up to 20 job matches a day, auto-apply, save for review,
  train the copilot, tracker, resume and cover letter builders, mock interviews, career tools.
- **ELITE:** "STARTS FROM" $1.05 per day. 3 copilots, up to 50 job matches a day, resume tailored per application,
  credits to contact hiring managers, plus everything in Premium.
- "Weekly, Monthly and Quarterly plans available". The reviews page says plans "start at $8.90". Full plan prices
  are not shown before sign-up.
- Refunds at their discretion, mainly for technical problems.

## Ideas worth taking for MFit Apply

1. **One copilot per resume variant** (observed). This maps directly onto MFit's candidate plus variant pairs, for
   example "Eshwar, OT Security, GC C2C" (*inferred*).
2. **Answer screening questions once, reuse everywhere** (observed). For visa candidates the work-authorization and
   sponsorship answers must be exact and fixed per candidate, never guessed by AI (*inferred*).
3. **Review mode before auto mode, and learn from edits** (observed). A staffing desk should start in review mode
   per candidate (*inferred*).
4. **Excluded companies per search** (observed, up to 20). *Inferred:* MFit should exclude clients where the
   candidate was already submitted through another vendor.
5. **Apply only to verified employer career pages** (observed). *Inferred:* C2C roles mostly come through vendors and
   job boards such as Dice, so MFit needs a vendor-verification step instead of a career-page-only rule.
6. **Scan every two hours plus a daily recap email** (observed).
7. **Keywords that must appear in the description** (observed). *Inferred:* use it for "C2C", "H1B transfer" or
   "no sponsorship" filters until MFit has structured visa tags.
8. **White-label with a revenue share and partner dashboard** (observed). *Inferred:* a model for offering MFit Apply
   to other staffing firms.
9. **Do not copy:** entering "1" in salary fields (observed). C2C candidates quote an hourly rate; MFit should keep
   a rate field per candidate and leave a field empty or flag it for review rather than send a false value
   (*inferred*).

## Not done

- No account, so no full prices, no dashboard and no signed-in pages.
- The extension package was not downloaded.
- The list of 500,000 companies and how jobs are checked as "verified" were not studied.
- Their usage numbers are their own claims, not checked.
