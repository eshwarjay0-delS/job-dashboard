# Decisions

Append-only. Do not edit or delete past rows. If a decision changes, add a new row.

| Date | Decision | Rejected alternatives | Why |
| --- | --- | --- | --- |
| 2026-11-13 | Skip-login stays default-on. Never merge branch `fix/google-only-login-production-auth-20261113`. | Turning skip-login off; merging that Google-only production auth branch | Owner requires skip-login. Only the value `off-confirmed-by-eshwar` turns it off. That branch is not in force. |
| 2026-11-12 | Stay on Vercel Hobby. Batch production deploys; only `[ship]` commits build. About 3 `[ship]` deploys a day. | A paid Vercel plan; unbatched master deploys; using repo `ignoreCommand` to filter branches | Hobby caps. `git.deploymentEnabled` already blocks non-master deploys. The `[ship]` Ignored Build Step keeps docs and chore commits on master from building. |
| 2026-11-19 | Test with saved local video replay, not live YouTube. | Live YouTube as the default test path | Live runs were unreliable and burned sessions. The same local video, resume, job description, and 10 questions let builds compare fairly. |
| 2026-11-19 | Shared hub lives in this `ops/` folder on GitHub. | Notion, or another new shared workspace | Both accounts already reach this repo. No new connector or cost. |
| 2026-11-19 | Do not use cheating-daddy source code. | Vendoring or copying that codebase | GPL. Ideas only. |
| 2026-11-19 | Do not use the LiveKit turn-detector. | Wiring Kompas to LiveKit Agents just to get turn detection | The detector is tied to LiveKit Agents. Use a smaller, independent end-of-question check instead. |
