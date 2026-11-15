# Peraton source-permission review — 14 November 2026

**Decision:** Keep Peraton as a directory/manual-navigation source. Do not register an automated crawler adapter or call its portal/API until the current portal's terms and a sanctioned feed/API or written permission establish commercial-aggregation rights.

## What was verified

- The current official search page is `https://www.careers.peraton.com/search-jobs`. It publicly renders search categories and featured opportunities. Its footer links to Peraton's Terms and Privacy pages.
- Peraton's published Terms of Use describe Peraton site content as proprietary, restrict copying/reproduction/distribution without prior written permission, and prohibit code/devices intended to scrape or collect Site Content or monitor Site use. The current careers search page links to those Terms in its footer. The Terms also say third-party sites have their own terms; this review does not assume the corporate Terms settle every third-party destination.
- An older `careers-peraton.icims.com` job-search URL remains accessible, but it is not the current official search destination linked from the careers page reviewed here. The iCIMS Job Portal API documentation describes a tenant-authenticated vendor API; it is not evidence that Peraton's current careers site exposes a public iCIMS feed.
- No sanctioned public feed/API, written permission, or commercial-aggregation rights were available in this review. The current careers portal's own robots policy and any separate platform-specific terms were not independently verified.

## Consequence for the crawler

- Keep the current official portal URL in the vendor directory for manual navigation: `https://www.careers.peraton.com/search-jobs`.
- Keep `peraton` in `PENDING_PORTALS`; exclude it from `ADAPTERS`.
- Do not infer automated access rights from public visibility, the presence of job cards, or an older iCIMS URL.
- Keep contract crawling manual/on-demand only. This review does not authorize a live crawl or restore a schedule.

## Sources

- Peraton current careers search: https://www.careers.peraton.com/search-jobs
- Peraton careers home: https://www.careers.peraton.com/
- Peraton Terms of Use: https://www.peraton.com/terms
- Legacy iCIMS listing (not treated as current official search): https://careers-peraton.icims.com/jobs/search
- iCIMS Job Portal API (legacy reference only): https://developer-community.icims.com/applications/applicant-tracking/job-portal

## Limits and next step

This is a public-reference review, not legal advice or proof of the current careers portal's platform-specific terms. The careers page links to Peraton's Terms, but the exact applicability of those terms to every subdomain or third-party component was not independently adjudicated. Reconsider automation only after Peraton supplies written permission or a sanctioned feed/API contract that explicitly permits this aggregation use, and the current portal's robots/terms are reviewed. Until then, the manual portal link is the safe fallback.

No portal crawl, robots request, API request, authentication attempt, production mutation, or scheduled run was made.
