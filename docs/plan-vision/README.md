# MFit Plan and Vision

Admin workspace: `/dashboard/admin/vision`.

The existing product hub is retained; `/dashboard/admin/plan-vision` redirects to it. Full source vision documents remain available inside each product plan.

Each of Gmail, Job Applications, Resume and Kompas has developer notes, a precise SVG overview, an expandable mind map, build phases, acceptance checks and source references. The same `src/lib/plan-vision.ts` model feeds every view and both downloads. Product and presentation are encoded in the URL so developers can share a specific view with another authorized admin.

## Updating the shared brain

Journal-only edits are production code: run `node --test scripts/tests/plan-journal-schema.test.mjs` as well as typecheck/build. Keep all evidence in the supported `evidence` field; extra keys such as `evidence2` both fail TypeScript and disappear from the existing Markdown export. Regression and release evidence: `docs/research/journal-schema-build-repair.md`.

1. Read the relevant existing source document and current implementation.
2. Edit the product entry in `src/lib/plan-vision.ts`; update `PLAN_REVISION` when the plan changes. Keep the referenced source documents aligned.
3. Distinguish intent, repository implementation and live verification. Do not convert a roadmap phase into a completion claim without evidence.
4. Run `node --test scripts/tests/plan-vision.test.mjs`, typecheck and the production build. Inspect every SVG after changing diagram text.
5. Include behavior changed, acceptance results, remaining gaps and release commit in the developer handoff. Assign owners and deadlines explicitly rather than inventing them.

This is durable, repository-versioned developer documentation. It does not silently create a task tracker, write to Gmail, enable auto-sending, or implement every downstream roadmap item. Users keep their normal product experience; developer notes are restricted to existing admin identities. Developer access requires the existing admin authorization mechanism, not a new public role or shared password.

## Sources and precedence

Gmail and Apply follow `docs/gmail.md` and `docs/apply.md`. Resume incorporates the owner's latest 98% target, identity separation, substantive role writing and single-delivery requirements; the older 95% wording is historical. Kompas combines its shared-release and voice reliability contracts with the owner's combined-source, dual-depth and reusable-knowledge requirements. Unknown verification status remains unknown.

## Authorization and exports

The page checks verified admin email or a valid signed admin session before serializing plans. `/api/admin/plan-vision` independently checks `adminOf` for every image and Markdown request. Responses are private and uncached. SVG text is escaped; exports contain no external resources or executable content. Normal users do not gain access by knowing the URL.
