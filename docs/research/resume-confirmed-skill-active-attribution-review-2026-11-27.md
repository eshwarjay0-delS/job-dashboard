# Active non-candidate actor attribution gap — 27 November 2026

## Scope
Source review of approved confirmed-skill resume alignment PR [#598](https://github.com/eshwarjay0-delS/job-dashboard/pull/598), exact head `bfc35f6a637c101c0c19a3537ddaba57fe8d9745`. This is a review finding, not a code change or reproduced resume incident.

## Reproduction
The current splitter recognizes several named team/organization subjects, `we/they`, and passive attribution. It does not split these active subjects:
- `I used AWS and someone used GCP`
- `I used AWS and contractors deployed GCP`
- `I used AWS and a consultant configured GCP`

The resulting sentence still starts with a candidate-confirmation pattern, so the parser can retain the whole sentence and extract GCP as candidate-confirmed. An isolated simulation of the copied current regex confirms no split; no canonical checkout or local test runner was available.

## Review and validation
- Review COMMENT **6084473225** posted to #598 at exact head `bfc35f6a...`; it is not approval.
- Exact-head remote checks: full CI, focused confirmed-skill regression, WhatsApp recovery, Kompas baseline and Plan/REA schema all SUCCESS. Focused suite reported 56/56.
- #598 remains DRAFT; no merge, protected preview, authorized real resume/JD/confirmation, model call or exported-DOCX acceptance.
- Production alias `job-dashboard-fawn.vercel.app` is independently READY on runtime SHA `a17b3267e271c77cd8887312445271b7fa172bd0`. Current master `1eb604b33cfe58f3c0f6ad611d346d5921e184ff` is seven documentation commits ahead only; comparison showed docs files and no runtime code. No deployment is warranted for this checkpoint.

## Next
Add negative attribution cases for active subjects such as someone/anyone, contractors, consultants and similar non-candidate actors, retaining a positive control for an ordinary candidate list. Run the repository tests in a compliant checkout, rerun all exact-head CI, review the correction, and preserve protected preview and real DOCX acceptance gates. Never use the JD itself as candidate evidence.
