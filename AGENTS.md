<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Plan & Vision is the continuous handoff record

For every MFit task, update `src/lib/plan-vision-journal.ts` and the relevant product plan/docs in the same change as the implementation. Record new ideas, exact prompt/policy decisions, wishes, approval or rejection, active work, blockers, pending work, commits, deployment evidence and verification limits. Read these records before continuing a product task.

Keep approval, delivery and verification separate. A wish is not automatically approved; an approved request is not implemented; a commit is not a successful deployment; deployment is not end-to-end verification. Record explicit user approval with its source. Do not invent approvals, dates, percentages or completion. Preserve superseded decisions with the replacement reference instead of silently deleting history. Never include secrets or private user documents in the journal.

Update the record when work starts, direction changes, tests finish, a commit ships, or a blocker is found. Include evidence and the next unresolved step. Publish status updates alongside code where practical. These instructions govern active development; this repository does not automatically ingest every external conversation or watch idle developers. Do not claim an always-running observer exists without implementing and verifying it.

## Completion Watch: required active-work loop

Read `docs/completion-watch.md` at the start of continuation work. Before ending a turn, reconcile the journal against what actually shipped, identify the next approved unblocked slice, and continue it within available execution capacity. If stopping at a wall, report the exact missing prerequisite and the action needed to unblock it. Do not restart from scratch, lose an approved request, or call a mocked test a successful live flow. The hourly scheduled task supplements this active-work loop; it does not grant new permissions, revive rejected work, bypass review gates or guarantee perpetual execution. Coordinate with existing developers and the separate Kompas voice task.
