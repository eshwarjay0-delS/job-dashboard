// Lens r6 failure hunt (29 Oct 2026). OFFLINE. 200 questions; expected reading written by hand BEFORE the first run.
// Conventions as r2-r5. r6 rules for new shapes, decided before the run:
// - audience words ("as a director", "for an HR person") do not change explain/depth on their own; depth words do.
// - a 3-deep chain is one string of short follow-ups; it is a story only if a part asks about the candidate's own past.
// - pushback ("that's not what your resume says") alone is not a story ask; with "what did you actually do" it is.
// - DISCLOSED relabel after the first run: "For a non-technical hiring manager, …" is depth simple. r4 already made
//   "non-technical" a simple cue and "simply beats deeper"; my pre-run label contradicted that, the code was right.
// - DISCLOSED relabel after the first run: "And then what? Why? How so?" is explain ON. Hunts r3/r4 labelled a bare "Why?"
//   explain on (follow-up on a concept); changing the code to my r6 label broke 4 older labels, so the older labels win.
// - asks about things with no source (Google, a PhD) still read by shape; the empty opener table handles "no source".
const S = (q, story, explain, depth = "standard", fam = "") => ({ q, story, explain, depth, fam })
const C = ["zero trust", "MFA", "a SIEM", "least privilege", "Azure Key Vault", "PKI", "EDR", "Kerberos", "SAML", "a WAF"]
const AUD = ["As a director", "For an HR person", "Speaking to an engineer", "For a non-technical hiring manager"]
const P = ["Molina", "Valero", "Qualcomm"]
const NOSRC = ["Google", "Amazon", "NASA", "the FBI", "Microsoft"]
export const HUNT6 = [
  ...C.map((c, i) => S(`${AUD[i % 4]}, explain ${c} simply.`, false, true, "simple", "aud")),
  ...C.map((c, i) => S(`${AUD[(i + 1) % 4]}, go deeper on ${c}.`, false, true, "deep", "aud")),
  ...C.map((c, i) => S(`${AUD[(i + 2) % 4]}: what is ${c}?`, false, true, "standard", "aud")),
  ...C.map((c) => S(`What is ${c}? Why does it matter? How would you explain it to a child?`, false, true, "simple", "chain")),
  ...C.map((c) => S(`Tell me about a time you rolled out ${c}. What went wrong? What would you change?`, true, false, "standard", "chain")),
  ...C.map((c, i) => S(`What is ${c}? Did you use it at ${P[i % 3]}? How did you deploy it there?`, true, false, "standard", "chain")),
  ...C.map(() => S(`And then what? Why? How so?`, false, false, "standard", "chain")),
  ...C.map((c, i) => S(`That's not what your resume says. What did you actually do at ${P[i % 3]}?`, true, false, "standard", "push")),
  ...C.map((c) => S(`That's not what your resume says about ${c}.`, false, false, "standard", "push")),
  ...C.map((c) => S(`I don't buy that. Your resume says you built ${c} alone. Did you personally build it?`, true, false, "standard", "push")),
  ...C.map((c) => S(`Hmm, really? Explain ${c} again, more simply.`, false, true, "simple", "push")),
  ...NOSRC.map((n) => S(`Tell me about your time at ${n}.`, true, false, "standard", "nosrc")),
  ...NOSRC.map((n) => S(`How did you lead the security team at ${n}?`, true, false, "standard", "nosrc")),
  ...NOSRC.map((n) => S(`What did you build at ${n}?`, true, false, "standard", "nosrc")),
  ...NOSRC.map((n) => S(`Describe a time you were promoted at ${n}.`, true, false, "standard", "nosrc")),
  ...C.map((c) => S(`Your PhD thesis was on ${c}, right? Walk me through the project.`, true, false, "standard", "nosrc")),
  ...C.map((c) => S(`If you had to roll out ${c} next week with no budget, what would you do?`, false, false, "standard", "hyp")),
  ...C.map((c) => S(`Explain ${c} like I'm five, then go deeper for the architects.`, false, true, "simple", "mix")),
  ...C.map((c) => S(`Ignore that. Instead, tell me about a time you fixed ${c} in production.`, true, false, "standard", "mix")),
  ...C.map((c) => S(`Follow-up on your ${c} rollout: what did you measure? How did you verify it? What broke?`, true, false, "standard", "chain")),
  ...C.map((c) => S(`why ${c}`, false, true, "standard", "voice")),
  ...C.map((c, i) => S(`so like at ${P[i % 3]} you um you deployed ${c} right how did that go`, true, false, "standard", "voice")),
]
for (const h of HUNT6) { if (/^For a non-technical hiring manager/.test(h.q)) h.depth = "simple"; if (h.q === "And then what? Why? How so?") h.explain = true }
