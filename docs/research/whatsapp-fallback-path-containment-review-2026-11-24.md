# WhatsApp explicit-selection fallback containment review — 24 November 2026

## Scope
Review the owner-approved explicit same-account Files/Library fallback on PR #572 at head `c571fa74c81980f69c650b68fae1d5e6307dc0f8`. This review did not alter runtime code, authorization policy, resume selection, or delivery behavior.

## Observed boundary
The fallback helper `explicitLibraryFallbackPathMatches` validates the account root, selected path, relative segments, email folder, durable recovery record, and exact selected/input bytes. The containment checks use `path.resolve` and `path.relative`, which are lexical.

The local filesystem adapter's `FsStorage.get` uses `readFile`, which follows symlinks. A symlink inside an account resume folder could therefore point outside that folder while lexical containment still passes. Production R2 object-key storage does not have symlink semantics; this is a local-filesystem hardening observation, not a confirmed production R2 escape.

## Review comment
A non-blocking hardening note was posted to PR #572 at review ID `6037323332`: if local/dev fallback is supported, add mode-aware realpath containment or reject symlinks and a symlink-escape regression. The review comment is not an approval.

## Exact-head remote evidence
- PR #572 remains DRAFT and unmerged.
- WhatsApp resume recovery: run `45351411271`, SUCCESS.
- Kompas baseline: run `45351411126`, SUCCESS.
- Plan/REA schema: run `45351411099`, SUCCESS.
- Full CI: run `45351410987`, FAILURE at the shared Kompas VM/Listening-hold dependency; no local test execution occurred in this environment.

## Production and acceptance boundary
Master `794e8cfdbd3103409552857806bab89851d5bfcb` is READY at deployment `dpl_2tyBPso5SnCgHCPFCqXewExCJEYp`, and `job-dashboard-fawn.vercel.app` points to that deployment. PR #572 is not live. The 17 Oct 2026 17:28 Chicago WhatsApp resume incident remains unverified: no historical DOCX, per-run R2 version, webhook correlation, Meta outbound ID, or signed delivered/read receipt was available. No send, replay, R2 write, or private-document processing occurred.

## Next
Keep #572 unmerged. Obtain independent authorized review for shared PR #554, then restack #572 on the reviewed master and rerun exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA. Protected preview, production READY/alias and owner-consented real delivery acceptance remain separate gates.