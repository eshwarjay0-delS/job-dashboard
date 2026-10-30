// Offline stress harness for the desktop intake (29 Oct 2026). No network, no model.
//   node --experimental-strip-types scripts/kompas-intake-stress.mjs 50
//   node --experimental-strip-types scripts/kompas-intake-stress.mjs 200
// Each sequence is an interviewer question heard on computer audio, sometimes misheard, sometimes leaking back through
// the microphone (speaker bleed), followed by your own spoken answer on the mic and sometimes a typed follow-up.
// Counts (lower is better, except kept):
//   bleedLeaked   a mic line that only repeats the call audio got through as if you asked it
//   ownDropped    your own answer on the mic was thrown away
//   typedOrphan   a typed "And why?" became a card with no subject
//   typedMerged   a typed question did not get its own card
//   misheard      a known garble was left in the question
// The intake code is sliced from public/kompas/app.js, so this measures what ships.
import { loadIntake } from "./kompas-intake-slice.mjs";
const { repairDictation } = await import("../src/lib/kompasDictation.ts");

export function runStress(n, seed = 29) {
  const { api } = loadIntake();
  let x = seed >>> 0;
  const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const QUESTIONS = [
    ["What is Kubernetes and when would you use it?", "Kubernetes", "What is cooper netties and when would you use it?"],
    ["How do you keep Terraform state safe?", "Terraform", "How do you keep terra form state safe?"],
    ["Walk me through how you rolled out SailPoint.", "SailPoint", "Walk me through how you rolled out sail point."],
    ["How did you onboard accounts into CyberArk?", "CyberArk", "How did you onboard accounts into cyber arch?"],
    ["How would you map detections to MITRE ATT&CK?", "MITRE ATT&CK", "How would you map detections to my tree attack?"],
    ["How do you decide when residual risk is acceptable?", "residual risk", "How do you decide when resid jewel risk is acceptable?"],
    ["What changed when you moved to DevSecOps?", "DevSecOps", "What changed when you moved to dev sec ops?"],
    ["Have you prepared a company for a SOC 2 audit?", "SOC 2", "Have you prepared a company for a sock two audit?"],
    ["How do you use NIST 800-53 controls day to day?", "NIST 800-53", "How do you use nist eight hundred fifty three controls day to day?"],
    ["How did you set up conditional access in Entra ID?", "Entra ID", "How did you set up conditional access in intra id?"],
    ["What is PKI and why does a bank run its own?", "PKI", "What is pee kay eye and why does a bank run its own?"],
    ["How do you secure a GitHub Actions workflow?", "GitHub Actions", "How do you secure a get hub actions workflow?"],
    ["How would you lock down an S3 bucket?", "S3 bucket", "How would you lock down an s three bucket?"],
    ["What did you automate with Ansible?", "Ansible", "What did you automate with ans ible?"],
    ["How did BeyondTrust compare with CyberArk?", "BeyondTrust", "How did beyond trust compare with CyberArk?"],
  ];
  const ANSWERS = [
    "I rotated the vault credentials every ninety days at Cigna.",
    "At my last job I cut the onboarding time from two weeks to three days.",
    "I owned the rollout for four business units and kept it on schedule.",
    "I started with the riskiest accounts first, then the service accounts.",
    "I'd look at the logs first, then talk to the app owner.",
  ];
  const FOLLOW = ["And why?", "Why?", "How come?", "Go deeper", "and how", "Explain that"];
  // Short lines made only of common words: the 30 s echo rule has nothing to compare, so only the 1.5 s bleed rule sees them.
  const BLEED_SHORT = ["Can you do that?", "Did you do it?", "Is that so?", "Do you have one?"];
  const OWN_TYPED = ["What is least privilege?", "Kerberos", "How does SAML federation work?"];
  const m = { sequences: n, bleedLines: 0, bleedLeaked: 0, ownLines: 0, ownDropped: 0, typedFollow: 0, typedOrphan: 0, typedOwn: 0, typedMerged: 0, garbled: 0, misheard: 0 };
  for (let i = 0; i < n; i++) {
    const [clean, term, garble] = pick(QUESTIONS);
    const heardQ = rnd() < 0.5 ? garble : clean;
    if (heardQ === garble) m.garbled++;
    const t0 = 10_000 + i * 60_000;
    const them = [{ text: heardQ, at: t0 }];
    const fixed = repairDictation(api.fixPhrases(heardQ));
    if (heardQ === garble && !fixed.toLowerCase().includes(term.toLowerCase())) m.misheard++;
    const kept = (text, at) => {
      if (api.micBleed && api.micBleed(text, at, them)) return false;
      const recent = them.filter((l) => at - l.at < 30_000).map((l) => l.text).join(" ");
      return !(recent && api.echoShare(text, recent) >= 0.5);
    };
    // Bleed: the call audio comes back through the mic 200 to 1400 ms later, whole, clipped, or a short follow-up.
    if (rnd() < 0.7) {
      const kind = rnd();
      let text = heardQ;
      if (kind < 0.35) { const f = rnd() < 0.5 ? pick(FOLLOW) : pick(BLEED_SHORT); them.push({ text: f, at: t0 + 5000 }); text = f; }
      else if (kind < 0.6) text = heardQ.split(" ").slice(0, 4).join(" ");
      const at = (kind < 0.35 ? t0 + 5000 : t0) + 200 + Math.floor(rnd() * 1200);
      {
        m.bleedLines++;
        if (kept(text.toLowerCase().replace(/[?.!]/g, ""), at)) m.bleedLeaked++;
      }
    }
    // Your own answer on the mic, 3 to 9 seconds after the question.
    const own = pick(ANSWERS);
    m.ownLines++;
    if (!kept(own, t0 + 3000 + Math.floor(rnd() * 6000))) m.ownDropped++;
    // Typed after the answer is on screen.
    if (rnd() < 0.5) {
      const f = pick(FOLLOW);
      m.typedFollow++;
      const q = api.typedFollowUpQuestion ? api.typedFollowUpQuestion(f, clean) : "";
      const card = q || f;
      if (!card.includes(term) && !card.toLowerCase().includes(term.toLowerCase())) m.typedOrphan++;
    } else {
      m.typedOwn++;
      const t = pick(OWN_TYPED);
      if (!api.typedStandsAlone(t)) m.typedMerged++;
    }
  }
  return m;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1]?.endsWith("kompas-intake-stress.mjs")) {
  for (const n of process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [50, 200]) {
    console.log(JSON.stringify(runStress(n)));
  }
}
