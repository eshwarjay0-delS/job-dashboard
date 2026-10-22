# Gmail search highlight performance — 22 October 2026

## Finding

The long/hostile-query regression exceeded its 500 ms budget after the mobile-delivery receipt work, even though that change did not touch search. Isolated reruns reproduced 617 ms. Query parsing and matching are bounded to 500 input characters; the remaining cost was `findIn`, which scanned and regex-matched the same long message separately for every positive highlight term. Nested OR input could create dozens of those passes.

## Repair

`findIn` now normalizes and deduplicates literal term patterns, combines them into one bounded regular expression, and scans the message once. Regex alternatives preserve the original term order for ties while the regex engine still finds the earliest position in the text. Search matching, operators, address handling, snippets and literal handling for C++, C# and .NET are unchanged.

## Boundary

This is a local performance and denial-of-service resistance repair for already-kept mail. It makes no Gmail API call, sends no message, changes no account data and does not establish mobile-delivery acceptance.

## Release evidence

Three isolated timing runs completed in 279–394 ms and the same broader Gmail group that previously failed passed 89/89. TypeScript, scoped lint and the production build passed. Commit `3821e69c8d36e4ba3cf0fa2258457044f15962ba` received Vercel success at https://vercel.com/qu4ntum-s-projects/job-dashboard/9PgtQu1mYeW3MsrhATFgHFoyVstG. Authenticated real-mail responsiveness remains an owner acceptance step.
