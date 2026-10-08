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
