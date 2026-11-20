# Adversarial clarifier run

Code under test: PR #467 head `f5df791c`. The clarifier was not edited.

Command: `REPO` pointed at that head, then `node --no-warnings --experimental-strip-types scripts/run-clarifier-adversarial.mjs`.

Existing suite on that head: **47/47**. New file: **13/20**. Per-case lines are in `ops/brain/clarifier-adversarial-results.json`.

Fails:

1. “Sorry, scratch the email. How large was the CMDB?” → “The CI classes, or the record count?”
2. “How do you open a change, how do you approve it, and how do you close it?” → no clarifier.
3. “What about discovery, and access, and incidents?” → no clarifier.
4. “How did you set up the CMDB, how did you keep it accurate, and who used it?” → no clarifier.
5. “Hold on. How do you triage alerts, how do you escalate them, and who do you tell?” → “triage, then escalation” (drops “tell”; “escalation” is not the live word).
6. “How does that work, how long did it take, and who signed off?” → no clarifier.
7. “Did you design it alone, right?” → “overall SD-WAN design, or a specific piece like failover.”
