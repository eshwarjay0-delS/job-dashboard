# Kompas Parakeet S5 — 20 November 2026

Source: the Parakeet S5 live notes for this task. This is a product comparison, not a copy of Parakeet.

## What S5 showed

- Screen analyze (Ctrl+Shift+Enter) produced first text in 2.3–2.6s and a full answer in 5–8s. On a job description the card showed about a 15-word heading and hid the body. A Terraform Gateway Load Balancer snippet was solved: `network` should be `gateway`, and `HTTP` should be `GENEVE`.
- Ctrl+Enter replied "No new question detected" twice.
- The answer invented a cutover that went wrong, and it answered "Yes, I personally led" to "You led that migration yourself, right?"

## What this change does

- Screen analyze is a button and Ctrl+Shift+Enter. It grabs one frame from the tab share already held. It does not call `getDisplayMedia` again and it does not open the tab preview. The frame goes to the existing answer API as one stream. The card keeps the full screen body. A GWLB bug gets a short corrected HCL block. If the model or the frame is missing, the card shows one sentence.
- A manual AI Answer press, including Ctrl+Enter, does not say "no new question". If the latest interviewer question was already answered, it is asked again from another angle. Speech within about two seconds of that question stays with it.
- After generation, a server check rewrites an incident, employer, tool, or personal number that is not in the Houston `eshwarjay05` resume. A Saint Louis or `jayeshwar44` resume is not the source. A leading "right?" question gets scope ("I led X; the rest was the team"). A "went wrong" question uses the McKesson incident-tracking work or says the outage is not on the resume.

## What was not verified

No live model call, no shared-tab click-through, and no measurement of first-token time on a real vision response. The 2.0s budget is the gate on the scheduler (`screenFirstWordOk`), not a stopwatch on OpenRouter. Long rewritten answers are 120–180 words in the offline fixtures.
