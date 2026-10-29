<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Finish means committed, deployed, and live

Owner, 29 Oct 2026: *"Commit, deployed and live?"* then *"Always do that remember. don't make me repeat."*

When a product change is finished, commit it, push it to master, and confirm the production deploy before saying it is done. Do not wait to be asked. A commit is not live until the deploy status is success and `https://job-dashboard-fawn.vercel.app` shows that build. If the deploy is rate limited, say so and retry. Do not call the work live before that check.

## Plan & Vision is the continuous handoff record

For every MFit task, update `src/lib/plan-vision-journal.ts` and the relevant product plan/docs in the same change as the implementation. Record new ideas, exact prompt/policy decisions, wishes, approval or rejection, active work, blockers, pending work, commits, deployment evidence and verification limits. Read these records before continuing a product task.

Keep approval, delivery and verification separate. A wish is not automatically approved; an approved request is not implemented; a commit is not a successful deployment; deployment is not end-to-end verification. Record explicit user approval with its source. Do not invent approvals, dates, percentages or completion. Preserve superseded decisions with the replacement reference instead of silently deleting history. Never include secrets or private user documents in the journal.

Update the record when work starts, direction changes, tests finish, a commit ships, or a blocker is found. Include evidence and the next unresolved step. Publish status updates alongside code where practical. These instructions govern active development; this repository does not automatically ingest every external conversation or watch idle developers. Do not claim an always-running observer exists without implementing and verifying it.

## Completion Watch: required active-work loop

Read `docs/completion-watch.md` at the start of continuation work. Before ending a turn, reconcile the journal against what actually shipped, identify the next approved unblocked slice, and continue it within available execution capacity. If stopping at a wall, report the exact missing prerequisite and the action needed to unblock it. Do not restart from scratch, lose an approved request, or call a mocked test a successful live flow. The hourly scheduled task supplements this active-work loop; it does not grant new permissions, revive rejected work, bypass review gates or guarantee perpetual execution. Coordinate with existing developers and the separate Kompas voice task.


## REA register is required for research work

Owner instruction, 17 October 2026: record every REA bit by bit in the admin REA section, not only in chat. Update `src/lib/rea-register.ts`, the relevant `docs/research/` evidence file and Plan & Vision together. Each session must identify the original request, product, research method, exact sources, observed findings, implemented changes, test evidence, commits, deployment status, limitations and next action. Public reference review, source/artifact analysis and actual REA tool execution are distinct methods. Mark failed/partial tool runs as blocked; never relabel marketing claims or a documentation review as recovered proprietary internals. Backfill accessible historical studies without inventing missing evidence. Do not put credentials, private email content or personal documents in the register. The UI is versioned; it does not automatically ingest external conversations.

## Cloud Agent

MarketFit is the Next.js app in this repository. `npm ci` installs it and is safe to run again. `npm run dev` serves it on port 3000.

Open the app at `http://localhost:3000`. Next.js 16 blocks dev assets when the host is `127.0.0.1`, so the page renders but buttons do not run. `GET /api/health` works on either host and returns `{ ok: true, app: "MarketFit" }`.

Supabase, Gmail, WhatsApp, R2, and model keys are not required to boot. Without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, nobody can sign in. `/dashboard` calls `/api/onboarding/status`, gets 401, and sends the browser to `/login`. The public action that works with no secrets is the landing-page waitlist (Resume Pack, Job Hunt, or Interview Pro). It appends a row to `data/waitlist.jsonl`, which git ignores. `POST /api/tailor` still needs a signed-in user and a model key.

`npm run check` runs typecheck, lint, autofill, and application merge. `npm run build` is the production build. `npm run test:hardening` is the broader suite. One case in `scripts/tests/mail-overview.test.mjs` fails on current master: it expects `<StandingSection account={filter} />` before the text `Filter inbox` in `src/app/dashboard/overview/page.tsx`, and the page no longer matches that source. The other 978 tests pass.
