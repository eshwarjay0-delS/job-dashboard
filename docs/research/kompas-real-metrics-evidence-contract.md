# Kompas real-metrics evidence boundary - 2 November 2026

## Owner request and scope
The owner requires dossier preparation and natural spoken answers for an Endpoint Analyst interview to use actual, traceable results rather than invented workplace counts or theatrical realism. This is a **generic Kompas policy** across roles and audiences, not a rule that injects endpoint claims into unrelated jobs. Approved in the current conversation on 2 November. This change alters shared prompt constraints and dual-dossier prompts; it does not assert any new candidate metric.

## Existing safeguards and correction
- `kompasAnswerService.ts` already constructs a figure allowlist from `sessionFacts(resumeSrc, docsSrc)`, not from the live interviewer question. This protects many unsupported numeric results.
- `kompasGuards.ts` distinguishes technical constants (ports, event IDs, versions) from outcome figures.
- `kompas-master-bible.ts` stores immutable session Q&A and labels generated prior answers as **not proof of candidate work**.
- `kompasAudience.ts` previously allowed numeric context from the job description in its narrative `REALISM` block. That was too broad: a JD metric target may guide relevance but cannot become an achieved candidate result.
- `kompas-dossier-bots.ts` already had general non-fabrication rules, but no explicit numerator/denominator/period requirements for outcome cards.

## Evidence ledger contract
A metric claim needs a stable claim ID; exact source ID, original text digest and revision; employer/project; candidate ownership; metric name, unit, numerator/denominator where relevant, eligibility/exclusions, measurement period/timezone, baseline and post-period if improvement is claimed; evidence state (verified original artifact, resume-stated but unverified, missing, contradicted, hypothetical) and a source link or redacted artifact reference. No secrets or private employer records should be committed to GitHub.

A resume statement is evidence that the **resume makes a claim**, not independent validation of employer outcomes. A source quote with a number but no definition may be presented as source-stated only; do not misrepresent it as independently measured. A job description, interviewer repetition, prepared answer, prior AI story, notebook teaching transcript, sample query output, interview scenario and general industry benchmark are not personal performance evidence.

## Spoken answer policy
- **Question first.** A definition should not force a scenario or metric.
- **Experience:** describe only candidate-supported work and actual evidence; a first-person metric may appear only when the source attributes the achieved result to that candidate and its measurement is defensible.
- **Scenario:** use prospective verbs ('I would'). Show one competing hypothesis, the discriminating log/policy/packet check, safe resolution and validation. Do not provide made-up incident dates, affected employee counts, performance percentages or approver dialogue.
- **Metric question without proof:** state the qualitative task or control effect, then the metric definition/source required. Say 'I would need the ticket cohort and SLA-clock definitions to quote a reliable percentage' rather than create false precision.
- **Follow-up:** preserve same company, system, problem and factual constraints. Never let the old Q&A mini-dossier bootstrap an unverified answer into fact.
- **Technical identifiers:** Event IDs 4624/4625/4768/4769, HTTP 401/403, CVEs, TCP ports and build versions can be factual constants when relevant and correctly described; they are not achieved results.

## Endpoint Analyst role examples
A CyberArk EPM blocked launch can be diagnosed via effective policy, executable path, publisher/signature, hash and the decision event. A Zscaler/TLS problem can be diagnosed via certificate chain, HAR/network trace, proxy policy and affected client. A Kerberos login problem can be checked against AD/DC, account and SPN state. These are technical rehearsal scenarios unless a named original incident is present. The initial resume supplies general responsibilities at Citi, CVS Health and San Diego, but contains no primary ticket cohorts or verified SLA improvement numbers.

## Verification
The static regression checks assert that shared answer and dossier prompts preserve the provenance rule across different source roles. They do **not** simulate a live provider response, test numeric post-processing end-to-end, authenticate a Windows desktop session, or verify user-specific metrics. Required next acceptance: live side-by-side answers, ledger artifact matching, cross-device behavior and actual question relevance. Claim production only after a Git-connected deployment is verified.
