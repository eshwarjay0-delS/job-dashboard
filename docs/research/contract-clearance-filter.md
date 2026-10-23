# Contract search: clearance boundary

Date: 2026-10-23

## Owner requirement

MarketFit is a US contract-job product for an ordinary job seeker. The recorded search preference is to exclude roles that require a government security clearance. That rule applies to both result lanes used by Apply: the aggregated `/api/jobs` sources and the stored crawler index at `/api/crawl/jobs`.

## Audit finding

Both routes enforced contract evidence, but neither enforced the clearance preference. A cleared W2 contract could therefore pass the contract filter and appear in the combined Apply list. Adding another government-prime portal would have increased this problem because those sources contain many clearance-bound roles.

## Implemented boundary

- One shared classifier recognizes explicit requirements such as active/current clearance, TS/SCI, Secret/Top Secret, Public Trust, SC/DV-cleared, or the ability to obtain or maintain clearance.
- Unconditional phrases such as `no security clearance required` remain eligible.
- Deferred requirements such as `not required initially; must obtain after hire` remain excluded.
- Ordinary security language such as secure APIs, secrets management, and cybersecurity does not imply a clearance.
- Both Apply result lanes use the same helper. The crawler oversamples before filtering so the preference does not unnecessarily leave a short page.
- The crawler response reports only the number actually removed by the clearance rule. Extra oversampled eligible rows are not misreported as exclusions.
- `clearance=include` is an explicit API override for diagnostic or future opt-in use. The current Apply UI does not request it, so the user path excludes clearance roles by default.

## Evidence and limits

The focused classifier and route-contract tests exercise positive, negative, mixed, deferred, and false-positive cases. The focused and neighboring search/board set passes 17/17. TypeScript and scoped lint pass. The 157-route production build passes with nine pre-existing filesystem-tracing warnings. Full hardening reaches 807/810; its only failures are the same three previously recorded Kompas answer-format assertions, outside this Apply slice.

No portal was opened, no account was authenticated, and no application was submitted. Source tests prove the filtering contract, not the freshness or completeness of the live crawler index. Authenticated Apply acceptance with stored jobs remains separate.

