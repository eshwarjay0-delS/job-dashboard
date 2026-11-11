// One AI Answer press answers the question on screen once, even when a long
// queue of other questions has already been heard. The answer is stored only
// on that question's card. Candidate speech, filler, and a repeated phrase
// do not become the interviewer question.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8");
function slice(start, end) {
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert.ok(a > 0 && b > a, `${start} must exist in app.js`);
  return src.slice(a, b);
}
const code = [
  src.slice(src.indexOf("const Q_CUE ="), src.indexOf(";", src.indexOf("const Q_CUE =")) + 1),
  slice("// ── Question intake", "// ── end question intake ──"),
  slice("function shortFollowUp(", "const armsAuto"),
  slice("function pressQuestion(", "$(\"answerBtn\")"),
  slice("function frameHeardQuestion(", "$(\"screenBtn\")"),
  slice("function hasAnswer(", "\n// Takes an empty page"),
].join("\n");

const SHOWN = "What is a log aggregator or syslog relay and when would you use one?";
const OLD_A = "A log aggregator collects syslog from many hosts and forwards one stream.";

function session(lines, question = SHOWN) {
  const box = { value: "" };
  const asked = [];
  const s = {
    aiBusy: false, aiBusySince: 0, autoTimer: null, transcriptionEpoch: 0, transcriptionFailedEpoch: -1,
    running: false, captures: [], finals: new Set(), flushing: false, heardSeq: lines.length + 1, answeredSeq: 0,
    transcript: lines.map((row, i) => (typeof row === "string" ? { seq: i + 1, who: "Them", text: row } : { seq: i + 1, who: row.who || "Them", text: row.text })),
    cards: [{ question, answer: OLD_A, qid: "q-shown" }], idx: 0,
    $: (id) => (id === "manualInput" ? box : { classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", title: "" }),
    answerAnywayHeld: null,
    pendingHeard() { return s.transcript.filter(t => t.seq > s.answeredSeq); },
    statuses: [],
    updatePending() {}, flushHeard: async () => {}, setChat() {}, status(m, k) { s.statuses.push({ m, k }); },
    logEvent() {}, logDecision() {}, renderCard() {}, toTop() {}, clearTimeout() {}, plainAnswer: (a) => String(a),
    questionSource: () => "Them",
    recentContext: () => "",
    generateAnswer: async (heard, card, opts) => { asked.push({ heard, card, opts, q: card.question }); },
  };
  s.addCard = (q, answer) => { const card = { question: q, answer, qid: "q" + (s.cards.length + 1) }; s.cards.push(card); s.idx = s.cards.length - 1; return card; };
  vm.createContext(s);
  vm.runInContext(code, s);
  return { s, asked };
}

test("one press answers one question when 100 questions are queued", async () => {
  const lines = Array.from({ length: 100 }, (_, i) => `What is item${i}zzzz?`);
  const { s, asked } = session(lines);
  await s.aiAnswer(false);
  assert.equal(asked.length, 1, "one press is one answer request");
  assert.match(asked[0].q, /item99zzzz/);
  assert.doesNotMatch(asked[0].q, /item0zzzz|item1zzzz/);
  assert.equal(s.cards[0].qid, "q-shown");
  assert.equal(s.cards[0].question, SHOWN);
  assert.equal(s.cards[0].answer, OLD_A, "the page already on screen keeps its own answer");
  assert.equal(s.cards.filter(c => /item\d+zzzz/.test(c.question || "")).length, 1);
});

test("with nothing new queued, a manual press shows Listening and a second press answers anyway", async () => {
  const { s, asked } = session([]);
  s.transcript = [{ seq: 1, who: "Them", text: SHOWN }];
  s.answeredSeq = 1;
  s.heardSeq = 1;
  await s.aiAnswer(false);
  assert.equal(asked.length, 0, "silence does not regenerate the last topic");
  assert.match(String((s.statuses || []).map(x => x.m).join(" ")), /Listening, no new question yet/);
  assert.ok(s.answerAnywayHeld && s.answerAnywayHeld.silenceReask);
  await s.aiAnswer(false);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].q, SHOWN);
  assert.equal(asked[0].opts.reask, true);
  assert.equal(s.cards[0].answer, OLD_A);
});

test("after many questions are received the click handler is still one function", () => {
  assert.equal(src.split('$("answerBtn").onclick = () => aiAnswer(false);').length - 1, 1);
  const on = src.slice(src.indexOf("function onTranscript("), src.indexOf("function slimPrep("));
  assert.doesNotMatch(on, /answerBtn/);
  assert.doesNotMatch(on, /addEventListener\(\s*["']click["']/);
});

test("auto still answers once, and only the question that just finished", async () => {
  const lines = ["What is alphaqqqq?", "What is bravoqqqq?", "What is charlieqqqq?"];
  const { s, asked } = session(lines, "Ready");
  await s.aiAnswer(true);
  assert.equal(asked.length, 1);
  assert.match(String(asked[0].q), /charlieqqqq/);
  assert.doesNotMatch(String(asked[0].q), /alphaqqqq|bravoqqqq/);
});

test("chunks of one question stay one request, and the next question stays apart", async () => {
  const one = session([
    "What is a log aggregator",
    "or syslog relay and when would you use one?",
  ], "Ready");
  await one.s.aiAnswer(false);
  assert.equal(one.asked.length, 1);
  assert.match(String(one.asked[0].q), /log aggregator/i);
  assert.match(String(one.asked[0].q), /syslog/i);

  const two = session(["What is Kerberos?", "What is Terraform?"], "Ready");
  await two.s.aiAnswer(false);
  assert.equal(two.asked.length, 1, "a backlog is not answered question by question on one press");
  assert.match(String(two.asked[0].q), /Terraform/);
  assert.doesNotMatch(String(two.asked[0].heard || ""), /Kerberos/);
});


test("a mid-candidate Them turn answers the outstanding interviewer ask, not the candidate topic", async () => {
  const ask = "Put yourself in the shoes of a user who has been rate limited without malicious intent. What strategies would you use to circumvent that?";
  const { s, asked } = session([
    { who: "Them", text: ask },
    { who: "Them", text: "When integrating with payment API clients like Stripe I would cache requests and batch them." },
  ], "Ready");
  await s.aiAnswer(false);
  assert.equal(asked.length, 1);
  assert.match(String(asked[0].q), /strategies would you use to circumvent|rate limited without malicious intent/i);
  assert.doesNotMatch(String(asked[0].q), /Stripe/i);
});

test("back-to-back interviewer asks merge into one composite question on a press", async () => {
  const { s, asked } = session([
    "Will API rate limiter implementations read from the same cache?",
    "Is there a situation to have different rate limiters for different geographies?",
  ], "Ready");
  await s.aiAnswer(false);
  assert.equal(asked.length, 1);
  assert.match(String(asked[0].q), /same cache/i);
  assert.match(String(asked[0].q), /geograph/i);
});

test("mic You speech is not treated as the interviewer ask", async () => {
  const ask = "What strategies would you use to circumvent that?";
  const { s, asked } = session([
    { who: "Them", text: ask },
    { who: "You", text: "I would cache requests and batch them when talking to Stripe." },
  ], "Ready");
  await s.aiAnswer(false);
  assert.equal(asked.length, 1);
  assert.match(String(asked[0].q), /strategies would you use to circumvent/i);
  assert.doesNotMatch(String(asked[0].q), /Stripe/i);
  assert.doesNotMatch(String(asked[0].heard || ""), /^You:/m);
});

function load(start, end, name) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(slice(start, end) + `\nthis.${name} = ${name};`, ctx);
  return ctx[name];
}

test("candidate speech, filler, and a repeat are not the interviewer question", () => {
  const clean = load("function cleanShownQuestion(", "function showPressed(", "cleanShownQuestion");
  assert.equal(
    clean("What is a log aggregator or syslog relay and when would you use one? Hello, I'm a newbie, and I'm going to show you how to make a new version of the"),
    "What is a log aggregator or syslog relay and when would you use one?"
  );
  assert.equal(clean("log aggregator I'm going to start with the first one."), "log aggregator");
  assert.doesNotMatch(clean("tell me about SAST and DAST practices? YOU I, S."), /YOU|I, S/i);
  const heard = load("function heardDraft(", "\n// Caption capture", "heardDraft");
  const out = heard([
    { who: "Them", text: "What is a log aggregator or syslog relay?" },
    { who: "You", text: "and I'm going to take that one." },
    { who: "You", text: "I'm going to take that one." },
    { who: "You", text: "I I, S." },
  ], "", "");
  assert.equal(out, "What is a log aggregator or syslog relay?");
  assert.equal(heard([
    { who: "Them", text: "and I'm going to take that one." },
    { who: "Them", text: "I'm going to take that one." },
  ], "", ""), "");
});

test("an answer renders only under the question id it was requested for", () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(slice("function answerForCard(", "function renderCard(") + "\nthis.answerForCard = answerForCard; this.writeAnswer = writeAnswer;", ctx);
  const card = { qid: "q-syslog", question: SHOWN, answer: "" };
  const other = { qid: "q-otp", question: "What is a one-time password?", answer: "otp" };
  assert.equal(ctx.writeAnswer(card, "q-otp", "I'd use a secure remote-access solution."), false);
  assert.equal(card.answer, "");
  assert.equal(ctx.writeAnswer(card, "q-syslog", "A syslog relay forwards log lines to one aggregator."), true);
  assert.equal(card.answerFor, "q-syslog");
  assert.match(ctx.answerForCard(card), /syslog relay/);
  card.answerFor = "q-otp";
  assert.equal(ctx.answerForCard(card), "");
  assert.equal(other.answer, "otp");
});

test("a syslog question does not keep a remote-access or one-time-password answer", () => {
  const fits = load("function answerFitsQuestion(", "function stripUnaskedLogistics(", "answerFitsQuestion");
  const remote = "I'd use a secure remote-access solution when a team needs to extend a trusted internal network across an untrusted link. The solution creates an encrypted tunnel.";
  const otp = "I'd use a one-time password when I need to prove that the authenticating party possesses a secret that cannot be replayed.";
  const syslog = "A log aggregator or syslog relay collects logs from many hosts and forwards them to one place.";
  assert.equal(fits(SHOWN, remote), false);
  assert.equal(fits("log aggregator I'm going to start with the first one.", otp), false);
  assert.equal(fits(SHOWN, syslog), true);
  assert.equal(fits("What is Kerberos?", "Kerberos uses tickets."), true);
});

test("an answer does not add visa, address, or relocation the question did not ask", () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(
    slice("const PERSONAL_LOGISTICS =", "function withoutLogistics(") + "\n" +
    slice("function stripUnaskedLogistics(", "function renderCard(") +
    "\nthis.stripUnaskedLogistics = stripUnaskedLogistics; this.personalLogistics = personalLogistics;",
    ctx
  );
  assert.equal(ctx.personalLogistics("What is your address?"), true);
  assert.equal(ctx.personalLogistics("What is a log aggregator or syslog relay?"), false);
  const mixed = "A syslog relay forwards logs to one collector. I live in Austin. My visa is H-1B.";
  const kept = ctx.stripUnaskedLogistics(SHOWN, mixed);
  assert.match(kept, /syslog relay/);
  assert.doesNotMatch(kept, /Austin|H-1B|visa/i);
});

test("common mic misspellings become SAST, DAST, syslog, SIEM, and IAM", () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src.slice(src.indexOf("const PHRASE_FIXES"), src.indexOf("function fixTerms")) + "\nthis.fixPhrases = fixPhrases;", ctx);
  assert.match(ctx.fixPhrases("tell me about sast and dast practices"), /SAST/);
  assert.match(ctx.fixPhrases("tell me about sast and dast practices"), /DAST/);
  assert.equal(ctx.fixPhrases("a sis log relay"), "a syslog relay");
  assert.equal(ctx.fixPhrases("the sys log relay"), "the syslog relay");
  assert.match(ctx.fixPhrases("we use see em for alerts"), /SIEM/);
  assert.match(ctx.fixPhrases("the i a m roles you own"), /IAM roles/);
  assert.equal(ctx.fixPhrases("I am a senior engineer"), "I am a senior engineer");
});

test("intro becomes a question, and two different asks are not one", () => {
  const { s } = session([]);
  assert.equal(s.intakeQuestions(["intro"])[0], "Tell me about yourself.");
  const split = s.intakeQuestions(["What is a log aggregator or syslog relay?", "What is Terraform?"]);
  assert.equal(split.length, 2);
  assert.match(split[0], /log aggregator/i);
  assert.match(split[1], /Terraform/);
  const whole = s.intakeQuestions(["What is a log aggregator", "or syslog relay and when would you use one?"]);
  assert.equal(whole.length, 1);
  assert.match(whole[0], /syslog/i);
});

test("a narrow window wraps the toolbar and the question is not clipped to three lines", () => {
  const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width:900px\)/);
  assert.match(css, /flex-wrap:wrap !important/);
  assert.match(css, /max-height:min\(16em, 42vh\) !important/);
  assert.match(css, /min-height:42vh !important/);
  assert.match(html, /id="textMinus"/);
  assert.match(html, /id="textPlus"/);
  assert.match(html, /id="copyBtn"/);
  assert.match(src, /\$\("textMinus"\)/);
  assert.match(src, /\$\("copyBtn"\)\.onclick/);
});
