# Resume Formatting template decisions

Date: 2026-10-08
Product: MarketFit Resume Dashboard
Decision status: Owner reviewed

| Reference | Decision |
| --- | --- |
| Jake's Resume (Overleaf LaTeX) | APPROVED |
| FlowCV Templates | REJECTED |
| Modern Deedy | REJECTED |
| Classic Professional | REJECTED |

## Approved design reference

Jake's Resume: https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs

Use Jake's Resume as the initial visual and typographic reference. Do not present the three rejected references as approved defaults. Build an original implementation rather than copying third party template assets without license review.

## Product placement and behavior

Add a Resume Formatting page immediately after Resume Tailoring in the MarketFit Resume Dashboard. Users can upload an existing DOCX or PDF or select an existing resume; the app extracts structured information and automatically populates the chosen format without manual reentry. Show a live preview and provide PDF and DOCX downloads. Existing Resume Tailoring download flows should also offer resume template selection before export.

Preserve factual resume data and let users correct extraction errors. Changing a template changes layout, not work history. Support legible page breaks, ATS text extraction, balanced spacing and clear section hierarchy.

This records design decisions, not a claim that implementation or deployment is complete.

## Additional owner reviews — 2026-10-08

| Reference | Decision |
| --- | --- |
| Harvard College Resume | APPROVED |
| Yale Technical Resume | APPROVED |
| MIT Career Resume | APPROVED |
| CareerOneStop Professional | APPROVED |
| Overleaf AltaCV | REJECTED |
| Overleaf Simple Hipster | REJECTED |
| Harvard Paragraph Resume | APPROVED |
| Yale General Resume | APPROVED |

Jake's Resume remains APPROVED. The earlier rejected FlowCV Templates, Modern Deedy and Classic Professional remain REJECTED.

Approved references are design candidates and source inspirations, not proof of formal employer or HR endorsement. Avoid claiming that all hiring managers or ATS systems have approved these templates. Test resulting MarketFit implementations for reading order, parsability, page breaks, typographic consistency and recruiter usability before displaying verified badges.

## Additional owner decisions (2026-10-08)

| Reference | Decision | Reference source |
| --- | --- | --- |
| Harvard College Resume | APPROVED | https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/ |
| Yale Technical Resume | APPROVED | https://ocs.yale.edu/channels/resumes/ |
| MIT Career Resume | APPROVED | https://capd.mit.edu/resources/resumes/ |
| CareerOneStop Professional | APPROVED | https://www.careeronestop.org/JobSearch/Resumes/resumes.aspx |
| Overleaf AltaCV | REJECTED | https://www.overleaf.com/latex/templates/altacv-template/trgqjpwnmtgv |
| Overleaf Simple Hipster | REJECTED | https://www.overleaf.com/gallery/tagged/cv |
| Harvard Paragraph Resume | APPROVED | https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/ |
| Yale General Resume | APPROVED | https://ocs.yale.edu/channels/resumes/ |

Jake's Resume remains APPROVED. Totals: seven approved references, five rejected references. These are owner design selections, not claims of university, employer, or HR endorsement of MarketFit. Confirm the exact sample for broad reference families (e.g. Harvard Paragraph, Yale Technical) before reproducing a layout. Review licensing and validate ATS readability before publication.
