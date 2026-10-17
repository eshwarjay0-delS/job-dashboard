# REA register

Owner instruction: 17 October 2026. Every research and reverse-engineering effort must have a visible, step-by-step record on the MFit admin page.

Open Admin → REA Research, or Plan & Vision → REA. The route is `/dashboard/admin/vision/rea` and inherits the existing admin authorization layout.

`src/lib/rea-register.ts` is the structured session register. Retain one session per reference or investigation. Record the owner request, product, method, sources, observed behavior, deductions, changes, tests, commits, deployment evidence, unknowns and next action. The page filters by product, method and text, and expands each session into its evidence trail. Update the relevant source document and Plan & Vision journal in the same change.

Methods must be explicit:

- Public reference review: observed vendor documentation or publicly available product behavior.
- Source and artifact analysis: inspected code, generated documents or reproducible tests available to this project.
- REA tool attempt: an actual REA tool execution, including failed or partial runs.

A marketing assertion is not a verified measurement. Similar UI behavior does not prove the same architecture. Tests with mocked providers do not establish production delivery. A commit is not a successful deployment. Never publish credentials, private inbox contents or raw personal documents in this register.

Initial backfill includes Poke, ParakeetAI, the resume role parser, browser reply recovery, the blocked REA inventory attempt and an explicitly pending Apply-reference backfill. Historical chat/research coverage is incomplete; add recovered studies with evidence rather than claiming an exhaustive archive. The register updates when code is published; it is not an automatic collector of every developer's private conversation.
