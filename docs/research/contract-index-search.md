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

The focused regression covers broad multi-word matching, description inclusion, technical punctuation, delimiter removal, deduplication and the term cap. TypeScript, lint and production build must also pass before release. These checks do not prove that the database currently contains fresh jobs or that every vendor portal is covered. Live authenticated Apply acceptance remains separate.
