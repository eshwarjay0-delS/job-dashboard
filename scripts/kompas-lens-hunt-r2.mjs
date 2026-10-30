// Lens r2 failure hunt (29 Oct 2026): 200+ varied questions with the expected reading written by hand. OFFLINE.
// story = should get the experience-story category (personal past work); explain = explain modes on; depth = simple|standard|deep
const S = (q, story, explain, depth = "standard") => ({ q, story, explain, depth })
const subjects = ["security", "cloud work", "detection engineering", "this field", "incident response", "audit work"]
const concepts = ["zero trust", "MFA", "a SIEM", "least privilege", "Kerberos", "key rotation"]
export const HUNT = [
  // led / built / drove / challenge / biggest / failure / conflict, not personal stories
  ...subjects.map((s) => S(`What led you to ${s}?`, false, false)),
  ...subjects.map((s) => S(`What drove you to ${s}?`, false, false)),
  ...concepts.map((c) => S(`How is ${c} built?`, false, false)),
  ...concepts.map((c) => S(`What drove the shift to ${c}?`, false, false)),
  ...concepts.map((c) => S(`What is the biggest risk with ${c}?`, false, true)),
  ...concepts.map((c) => S(`What is the main challenge with ${c}?`, false, true)),
  ...concepts.map((c) => S(`Why does ${c} lead to failures in practice?`, false, true)),
  S("What is a merge conflict?", false, true), S("What causes a Kerberos failure?", false, false), S("Who led the zero trust movement?", false, false),
  S("What led to the Log4j crisis?", false, false), S("Which team built the first SIEM?", false, false), S("What drove cloud adoption in banks?", false, false),
  S("Is MFA built into Okta?", false, false), S("What's the biggest myth about encryption?", false, true), S("Conflict of interest in audits, what is it?", false, true) /* r3 relabel: a what-is ask after a comma is a concept ask */,
  S("Why did the attack succeed in the SolarWinds case?", false, true),
  // personal stories that must stay stories
  ...["led incident response", "built detections", "drove a migration", "handled a conflict", "owned a failure", "fixed a broken rule"].flatMap((x) => [
    S(`Tell me about a time you ${x}.`, true, false), S(`Describe a situation where you ${x}.`, true, false),
    S(`Have you ever ${x}?`, true, false), S(`Walk me through a project where you ${x}.`, true, false)]),
  S("What was the biggest challenge you faced at Northwind?", true, false), S("What's your biggest failure?", true, false),
  S("Tell me about your hardest conflict with a teammate.", true, false), S("Which project you led are you proudest of?", true, false),
  S("What did you build at Contoso?", true, false), S("Give me an example of a team you led.", true, false),
  S("What was the toughest mistake you've made?", true, false), S("You led incident response at Northwind, what happened?", true, false),
  // vague
  ...["Security?", "Cloud.", "Thoughts?", "And?", "Splunk.", "Terraform?", "Audit?", "Risk."].map((q) => S(q, false, false)),
  // follow-ups
  ...["Why?", "How so?", "Go deeper.", "Go deeper on that.", "Can you go deeper?", "What happened next?", "And then?", "Why that order?"].map((q) => S(q, false, /^(Why|Go|Can you go)/.test(q), /deeper/.test(q) ? "deep" : "standard")),
  // explain simply / go deeper on personal questions
  ...["what you did at Northwind", "your role at Contoso", "how you ran access reviews", "the leaked key incident you led", "your detection work"].flatMap((x) => {
    const story = /incident you led|how you ran/.test(x)
    return [S(`Explain simply ${x}.`, story, false, "simple"), S(`Explain in plain English ${x}.`, story, false, "simple"),
      S(`Go deeper on ${x}.`, story, false, "deep"), S(`Can you go deeper into ${x}?`, story, false, "deep")] }),
  // explain simply / deeper on concepts
  ...concepts.flatMap((c) => [S(`Explain ${c} simply.`, false, true, "simple"), S(`Explain ${c} like I'm five.`, false, true, "simple"),
    S(`What is ${c}, in plain words?`, false, true, "simple"), S(`Go deeper on ${c}.`, false, true, "deep"), S(`Why does ${c} matter?`, false, true),
    S(`What's the difference between ${c} and a firewall?`, false, true), S(`Could you explain how ${c} works?`, false, true)]),
  // personal non-story
  ...["What is your biggest weakness?", "Why should we hire you?", "What are your salary expectations?", "Why do you want this role?",
    "What are you most proud of?", "Where do you see yourself in five years?", "Why are you leaving your job?", "Tell me about yourself."].map((q) => S(q, false, false)),
  // round 2b: fresh edge cases, labelled before running
  S("So, what drove that decision?", false, false), S("What drove your decision to leave Contoso?", false, false),
  S("How did you build the Terraform guardrails?", true, false), S("What did you do at Northwind?", true, false),
  S("Tell me about the time you rotated the leaked key.", true, false), S("Talk me through a failure you owned.", true, false),
  S("Have you led a team before?", true, false), S("Did you build those Splunk detections yourself?", true, false),
  S("What was hard about the access reviews you ran?", true, false), S("Walk me through the migration you drove.", true, false),
  S("What is the biggest lesson from the Capital One breach?", false, true), S("What challenges does zero trust face?", false, false),
  S("Why is key rotation hard?", false, true), S("Why do SIEM projects fail?", false, true), S("What's a conflict-free replicated data type?", false, true),
  S("What are the biggest challenges in cloud security today?", false, true), S("Led by example, what does that mean to you?", false, false),
  S("How do you handle conflict?", false, false), S("How would you build a detection for a leaked key?", false, false),
  S("What would you do if a guardrail failed?", false, false), S("Imagine you led a SOC, what would you change first?", false, false),
  S("Explain it simply.", false, true, "simple"), S("Simply put, what is least privilege?", false, true),
  S("Could you go deeper on why that matters?", false, true, "deep"), S("Can you explain that in plain words?", false, true, "simple"),
  S("What is your experience with Terraform?", false, false), S("What is the difference between what you did at Northwind and at Contoso?", false, false),
  S("Why did you choose Splunk over QRadar?", false, false), S("Explain the incident you handled at Northwind simply.", true, false, "simple"),
  S("Go deeper.", false, true, "deep"), S("Deeper on the CloudTrail part, please.", false, true, "deep"),
  S("What built your interest in audit?", false, false), S("Who drove the cloud migration at your bank?", false, false),
  S("What's your proudest project?", true, false), S("Which failure taught you the most?", false, false),
]
