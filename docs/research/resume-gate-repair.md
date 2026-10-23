# Resume gate repair — enrichment obligations and requirement extraction

Updated: 23 October 2026  
Method: source and artifact analysis

## Owner requirement

Gemini may expand confirmed skills into useful related vocabulary, but those suggestions cannot become new biographical facts. Resume completion must use the original job requirements, the baseline resume and explicit candidate confirmations. Alternative credentials must be evaluated as alternatives only when the JD actually says `OR` or `one of`.

## Observed failure

The pre-repair pipeline allowed optional relational suggestions to enter mandatory completeness checks. It also treated some generic labels as missing requirements and could count an alternative credential list as several independent obligations. That could hold a file for the wrong reasons or pressure a rewrite toward unsupported claims.

## Implemented boundary

Commit `b62487eeceda929ebd64be808177a399104daec5`:

- restricts mandatory experience obligations to the original JD requirement set;
- keeps model-generated relational terms as writing vocabulary rather than proof of experience;
- collapses only explicit `OR`/`one of` credential alternatives;
- preserves independently required credentials;
- excludes generic specialty/attribute headings while retaining named terms such as Canton and SOL;
- retains private failed-run diagnostic mappings and advances the cache generation.

## Evidence

- 89 resume regressions were recorded as passing for enrichment separation, credential alternatives, generic-heading precision, missing-requirement reporting, formatting and Word export.
- Scoped lint passed for the implementation.
- The implementation commit is an ancestor of the current master inspected on 23 October 2026.
- GitHub combined status for the exact commit reports Vercel `success`: <https://vercel.com/qu4ntum-s-projects/job-dashboard/BTyueRenMmCRn732DzNYyd2HA8oi>.

## Boundary and remaining acceptance

This proves the source correction was released. It does not prove a live 98% resume match. The exact 17:28 WhatsApp input, generated DOCX and server trace remain unavailable. A fresh authenticated baseline + JD + explicit-confirmation run, exported-DOCX inspection and real download acceptance remain pending and must be recorded separately.
