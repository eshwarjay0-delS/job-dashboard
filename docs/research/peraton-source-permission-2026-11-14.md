# Peraton source-permission review — 14 November 2026

**Decision:** Keep Peraton as a directory/manual-navigation source. Do not register an automated crawler adapter or call its portal/API until the portal's own terms and a sanctioned feed/API or written permission establish commercial-aggregation rights.

## What was verified

- Peraton's official careers site is `https://www.careers.peraton.com/`; its public search/listing path currently resolves to the iCIMS portal at `https://careers-peraton.icims.com/jobs/search`. Publicly viewable listings are not, by themselves, a license to aggregate them.
- Peraton's published corporate Terms of Use describe Peraton site content as proprietary, restrict copying/reproduction/distribution without prior written permission, and prohibit code/devices intended to scrape or collect Site Content or monitor Site use. The same terms state that third-party sites are governed by their own terms; therefore this review does **not** assert that the corporate terms alone settle the iCIMS portal's own terms.
- iCIMS's official Job Portal API documentation says the API is available for vendors and documents `GET /customers/{customerId}/search/portals/{portalIdOrName}` with HTTP Basic authentication. The iCIMS developer community also describes access as granted to customers/partners and requires login. No Peraton tenant credentials, sanctioned anonymous feed, written permission, or commercial-aggregation rights were available in this review.
- The iCIMS portal's own Terms and robots policy were not independently verified. No portal crawl, robots request, API call, authentication attempt, or production query was made.

## Consequence for the crawler

- Keep the official portal URL in the vendor directory so a user can navigate to it manually.
- Keep `peraton` in `PENDING_PORTALS`; exclude it from `ADAPTERS`.
- Do not infer that an iCIMS-hosted portal exposes an unauthenticated public JSON feed. A shared iCIMS adapter is only viable where the specific tenant/API access and the employer's aggregation rights are documented.
- Keep contract crawling manual/on-demand only. This review does not authorize a live crawl or restore a schedule.

## Sources

- Peraton Terms of Use: https://www.peraton.com/terms
- Peraton careers site: https://www.careers.peraton.com/
- Peraton iCIMS public job listings: https://careers-peraton.icims.com/jobs/search
- iCIMS Job Portal API: https://developer-community.icims.com/applications/applicant-tracking/job-portal
- iCIMS Developer Community access information: https://developer-community.icims.com/

## Limits and next step

This is a public-reference review, not legal advice or proof of the iCIMS portal's own terms. Reconsider automation only after Peraton/iCIMS supplies written permission or a sanctioned feed/API contract that explicitly permits this aggregation use. Until then, the manual portal link is the compliant fallback.

No external messages, portal/API requests, credentials, production mutations, or live crawls were used.
