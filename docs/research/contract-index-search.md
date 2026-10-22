# Contract index search alignment

## Request and method

The owner approved an inclusive contract-job search across the MarketFit crawler index. This continuation inspected the current crawler query route and the existing `/api/jobs` query behavior. This is source analysis and implementation, not a live portal crawl or competitor reverse engineering.

## Observed defect

`GET /api/crawl/jobs` wrapped the complete query in one `ilike` pattern and searched only title, location and firm. A query such as `Salesforce CPQ developer` therefore required that exact phrase in one field and could not find CPQ evidence present only in a description. The other job-source route already treats multi-word category searches as match-any-term.

## Implemented boundary

- Split the query into at most eight distinct terms.
- Match any term across title, location, firm or description.
- Preserve meaningful technical punctuation for `C++`, `C#` and `.NET`.
- Remove PostgREST delimiters and wildcard characters before constructing the raw `or` filter.
- Keep contract-only, portal, active-listing and result-limit filters unchanged.

## Verification and limits

The focused regression covers broad multi-word matching, description inclusion, technical punctuation, delimiter removal, deduplication and the term cap. The 32 focused crawler/search checks and 37 checks including Plan & Vision and REA passed; TypeScript, scoped lint and production build passed. Implementation commit `3e2cbd35ed5fed89163c3dc5712d8996e17eb8ee` reported Vercel success.\n\nRead-only production acceptance on 22 October returned contract records last seen at 11:00 UTC that day from eTeam and Kforce. A `q=quantum` query returned an `IT Business Analyst` record because its description contains `Post-Quantum Cryptography`; the title contains no `quantum`. That directly verifies fresh indexed data and description-field retrieval. It does not prove every vendor portal is covered, and the authenticated Apply-page render remains separate.
