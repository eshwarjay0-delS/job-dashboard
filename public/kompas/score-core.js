/* Kompas score core: one answer, judged rule by rule against how people speak in the interview videos the owner chose.
   The endpoint /api/score imports this file; the Practice dialog loads the same file as a script (KompasScore).
   Pure code: no DOM, no network, no model. It needs pace-core.js loaded first (KompasPace).

   The owner, 12 Oct 2026: "So what are the metrics what did you have suggested for improvements? add connecting words or
   what??" and then "Create an API out of that and use that API. Question it and see the responses. And so update the
   architecture. With more rules. and confirm the responses back to me with what you think is perfect."

   THE MISTAKES THIS FILE PREVENTS
   1. A rule nobody passes. I first gave the owner five checks and said no answer passed all five. Run on the 391 answers
      cut from his videos, 1.5% of THOSE ended on a result in the words I was counting, and 13% announced an example. A
      check the speakers themselves fail measures nothing. So every rule here is run on those 391 answers, the share
      that pass is kept beside it (VIDEOS.pass), and a rule that fewer than half of them pass is a "mark": it is shown,
      and it never counts against an answer. "Lands on a result" is gone altogether.
   2. Two word lists. The videos and the answers were counted with lists that differed by a word or two. Here the words
      that count as a reason, a turn, an order word or an example are the ones in pace-core.js, for both.
   3. Counting the cure as the disease. A "because" is counted as the sign that a reason was given, and the fix a rule
      names is the reason, the turn, the plain word. Three fixes do name words ("First", "But", "which means"): there the
      word is the thing, because it is how a listener hears that a step or a new part has begun.
   4. A changed rule with old numbers. VIDEOS.calibratedOn is a fingerprint of this file and pace-core.js. Change either
      and the test fails until kompas-answer-tests/calibrate.cjs has been run again and its line pasted below.

   5. Trusting the videos over the people who interviewed him. On 12 Oct 2026 the owner sent the written feedback from a
      real interview. It praised his technical depth and asked for more structure, more concrete examples and more
      concise terms. Two of my rules disagreed with it: "Gives an example" did not count (few video answers announce
      one) and "Not crowded with names" did (the videos are less technical than his interviews). His interviewers are
      the better evidence about his interviews. So a rule also counts when they asked for it (`asked`), the count of
      names is a mark with a `doubt`, and the fixes come in the order they asked: steps, parts, an example.

   WHAT THE VIDEOS CANNOT SAY. The 391 answers come from 30 of the 36 videos (the cut found no question and answer in the
   other six). There is no speaker separation, so an "answer" may hold the interviewer's or a coach's voice as well: the
   measure that suffers most is "you" (speaking to the listener), which is kept as a mark, not a rule. A recogniser
   under-punctuates speech, so the videos look worse than they are on sentence length; the limits are easy on an answer.

   WHAT THE CODE CANNOT SEE. A name is found by its capital letter, its digits or its being an acronym. The first word of
   a sentence has a capital whatever it is, so a tool named there is read as a name only when it is plainly one ("EKS",
   "GitHub"); "Snowflake was our warehouse" is missed, in the count of names and in the check against the resume.

   It judges. It never writes, moves or removes a word of the answer it is given. */
(() => {
  const P = globalThis.KompasPace, M = P.MEASURED;

  /* What a reader sees and a listener does not: pause cues, headings, bold, bullets. Taken out before words are counted.
     A bullet or a heading is its own sentence, so it gets a full stop when it has none. Read line by line: a pattern that
     looks across lines took seconds on a page of empty lines. */
  const CUE = /\((?:pause|breathe|slow|steady|firm|warm|own|stop|look|smile|land|beat|breath)\)|\[(?:beat|breath|pause)\]/gi;
  const ITEM = /^[ \t]*(?:[-•*]|\d+[.)]|#{1,4})[ \t]+/, ENDS = /[.!?:;,]["')\]]*$/;
  function spoken(t) {
    const lines = String(t == null ? "" : t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/‑/g, "-").replace(CUE, " ").split(/\r?\n/);
    const out = [];
    lines.forEach((raw, i) => {
      const item = ITEM.test(raw);
      let line = raw.replace(ITEM, "").replace(/\*\*|\*|__|`/g, "").replace(/[ \t]+/g, " ").trim();
      if (!line) return;
      const paragraphEnds = i + 1 < lines.length && !lines[i + 1].trim();
      if ((item || paragraphEnds) && !ENDS.test(line)) line += ".";
      out.push(line);
    });
    return out.join(" ");
  }

  // The moves of pace-core.js, and two more that matter when the listener is not a specialist.
  const MOVES = {
    why: P.MOVES.why, turn: P.MOVES.turn, order: P.MOVES.order, example: P.MOVES.example,
    restate: /\b(?:which means|what that means|that means|in other words|put simply|in plain terms|basically|essentially|think of it|the point is|to put it)\b/i,
    listener: /\b(?:you|your|you're|you'd|you'll)\b/i,
  };
  const times = (rx, text) => (text.match(new RegExp(rx.source, "gi")) || []).length;

  const bare = (w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  // A number as it is said or written: 40, 3.5, 10:30, 1,200, 10-15%, 20mins, v2.
  const NUMBER = /^v?\d[\d,.:]*(?:[-–]\d[\d,.:]*)?(?:%|[a-z]{1,5})?$/i;
  const isNumber = (w) => NUMBER.test(bare(w));

  /* A name a listener has to know to follow: a product, a tool, an acronym, an identifier.
     - A capital in the middle of a sentence makes a name, unless it is a month, a day or a people ("January", "English").
     - A word that only opens something (the sentence, a quote, what follows a colon) has its capital for that reason, so it
       is a name only when it is plainly one: an acronym, a capital inside the word, a digit in it.
     - Up to three in a row are one name ("Argo CD", "AWS Secrets Manager"). Four or more in a row is a list said without
       its commas, which is how a recogniser writes one: each is its own name.
     - A job title is what the person is, not a thing to know ("Senior DevOps Engineer", "Product Manager"). */
  const NOT_NAMES = new Set("January February March April May June July August September October November December Monday Tuesday Wednesday Thursday Friday Saturday Sunday English American British Indian European Asian African Canadian Australian Spanish French German Chinese Japanese AM PM OK".split(" "));
  const plainlyName = (b) => /[a-z][A-Z]/.test(b) || /^[A-Z]{2,}/.test(b) || /[A-Za-z]\d|\d[A-Za-z]/.test(b);
  const isName = (w, opens) => { const b = bare(w); return !!b && !/^I(?:$|')/.test(b) && !isNumber(w) && !NOT_NAMES.has(b) && (plainlyName(b) || (!opens && /^[A-Z][a-z]{2,}/.test(b))); };
  const ROLE = /(?:^| )(?:Engineer|Developer|Analyst|Administrator|Architect|Scientist|Designer|Technician|Intern|Officer|Specialist|Consultant)s?$|(?:^| )(?:Product|Project|Program|Engineering|Account|General|Hiring|Delivery|Operations|Sales|Marketing|Team|Technical|Tech|Executive|Senior|Junior|IT|Security|Data|Software|DevOps) (?:Manager|Director|Lead)s?$/;
  function namesIn(sentence) {
    const words = sentence.split(/\s+/), found = [];
    let run = [], begun = false;
    const close = () => { if (!run.length) return; const name = run.join(" "); if (!ROLE.test(name)) { if (run.length >= 4) found.push(...run); else found.push(name); } run = []; };
    words.forEach((w, i) => {
      const b = bare(w), before = words[i - 1] || "";
      const opens = !begun || /:$/.test(before) || /^["'(\[]/.test(w) || /[.!?]["')\]]*$/.test(before);
      if (b) begun = true;
      if (b && isName(w, opens)) run.push(b); else close();
      if (run.length && /[,;:.!?]["')\]]*$/.test(w)) close();
    });
    close();
    return found;
  }
  const numbersIn = (sentence) => sentence.split(/\s+/).filter(isNumber).map(bare);
  // A long word: ten letters or more, counted between hyphens ("third-party" is two short words). The written register is
  // full of them; speech is not. A name is not a long word: nobody can say "Kubernetes" shorter.
  const longWordsIn = (text, names) => text.split(/[^A-Za-z]+/).filter((w) => w.length >= 10 && !names.has(w.toLowerCase()));

  /* Specifics in the answer that are in neither the resume nor the question: a number, a name. It is a rough net and it
     says so: a word the resume implies without spelling is caught too. The person reads the list and decides. */
  const GENERIC = new Set("API APIS CPU RAM HTTP HTTPS URL SQL CI CD SLA SLO KPI ID UI UX OK IT QA PR TLS DNS IP VM OS".split(" "));
  const digitsOf = (t) => (String(t).match(/\d[\d,.]*/g) || []).map((d) => d.replace(/,/g, "").replace(/\.+$/, ""));   // "1,200" and "1200" are one number
  function notInResume(text, resume, question) {
    const known = (String(resume || "") + " " + String(question || "")).toLowerCase(), knownNumbers = new Set(digitsOf(known));
    const numbers = [], names = [];
    for (const s of P.sentences(text)) {
      for (const n of numbersIn(s)) {
        // A bare single digit is a step number, not a claim. A range is two numbers: either may be new.
        if (digitsOf(n).some((d) => d.length >= 2 && !knownNumbers.has(d))) numbers.push(n.replace(/[,.]+$/, ""));
      }
      for (const name of namesIn(s)) {
        // "Prometheus-Grafana" is two names the resume has, joined: a name is new only if a part of it is.
        const parts = name.split(/[^A-Za-z0-9]+/).filter((x) => x.length >= 3 && (/^[A-Z]|\d/.test(x)));
        if (!parts.length || GENERIC.has(name.toUpperCase())) continue;
        if (parts.some((x) => !known.includes(x.toLowerCase()))) names.push(name);
      }
    }
    return { numbers: [...new Set(numbers)], names: [...new Set(names)] };
  }
  // A question about the person's own work, as against "explain how it works". Only the first kind is held to the resume.
  const OWN = /\b(?:tell me about (?:yourself|a time|your)|about yourself|why do you want|why should we|your (?:greatest |biggest |main )?(?:weakness|strength)|your proudest|proud of|describe a (?:time|situation)|a time (?:when )?you|give me an example of|walk me through your|have you (?:ever|worked|used|led|built)|what did you|how did you|what was your|at your (?:last|previous|current)|in your (?:last|previous|current) (?:role|job|position)|your experience)\b/i;
  const aboutOf = (question) => (OWN.test(String(question || "")) ? "own" : "how");

  /* Every number the rules read, in one place. */
  function measure(answer, options) {
    const o = options || {};
    const text = spoken(answer), rep = P.report(text), all = P.sentences(text);
    const lengths = all.map(P.count), per100 = (n) => Math.round(1000 * n / Math.max(1, rep.words)) / 10;
    const names = all.map(namesIn), numbers = all.map(numbersIn), said = names.flat();
    const long = longWordsIn(text, new Set(said.flatMap((n) => n.toLowerCase().split(/[^a-z]+/))));
    const starts = all.map((s) => bare(s.split(/\s+/).find((w) => bare(w)) || ""));
    let sameStart = all.length ? 1 : 0, run = 1, sameStartWord = "";
    for (let i = 1; i < starts.length; i++) { run = starts[i] && starts[i].toLowerCase() === starts[i - 1].toLowerCase() ? run + 1 : 1; if (run > sameStart) { sameStart = run; sameStartWord = starts[i]; } }
    const counts = Object.fromEntries(Object.entries(MOVES).map(([k, rx]) => [k, times(rx, text)]));
    const per1000 = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, Math.round(10000 * n / Math.max(1, rep.words)) / 10]));
    const extra = o.resume ? notInResume(text, o.resume, o.question) : null;
    return {
      words: rep.words, realWords: text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length, seconds: rep.seconds, time: rep.time, sentences: all.length,
      newParts: all.slice(1).filter((s) => P.NEW_PART.test(s)).length,
      sentenceWords: rep.medianSentenceWords, longestSentence: lengths.length ? Math.max(...lengths) : 0, runOns: rep.veryLongSentences,
      longestRun: rep.longestRun, firstSentenceWords: lengths[0] || 0, lastSentenceWords: lengths[lengths.length - 1] || 0,
      counts, per1000,
      names: said.length, namesPer100: per100(said.length), mostNamesInSentence: names.length ? Math.max(...names.map((x) => x.length)) : 0, namesSaid: [...new Set(said)].slice(0, 12),
      numbers: numbers.flat().length, mostNumbersInSentence: numbers.length ? Math.max(...numbers.map((x) => x.length)) : 0,
      longWordsPer100: per100(long.length), longWords: [...new Set(long.map((w) => w.toLowerCase()))].sort((a, b) => b.length - a.length).slice(0, 6),
      sameStart, sameStartWord, starter: (text.match(P.STARTER) || [""])[0],
      notInResume: extra ? { ...extra, count: extra.numbers.length + extra.names.length } : null,
    };
  }

  // The limits. Each is set from the videos (the comment says where), and each is checked against them in VIDEOS.pass.
  const LIMIT = {
    minWords: 60, seconds: 120,              // an answer in the videos: 177 words and 70 seconds at the median, 124 seconds at the 75th in 100
    sentenceWords: 18,                       // the videos: 15 at the median, 21 at the 75th
    run: 35,                                 // the videos pause every 15 words; a stretch past 35 with no pause point is named
    firstSentence: 24, lastSentence: 24,     // the videos: 13 at the median for both, 25 and 24 at the 75th
    namesInSentence: 3, namesPer100: 4,      // the videos: 3 names in the fullest sentence and under 4 per 100 words at the 90th
    longWordsPer100: 7,                      // the videos: about 3 at the median, about 7 at the 90th
    numbersInSentence: 2,                    // the videos: 2 at the 90th
    sameStart: 2,                            // the videos: 2 at the 75th, 3 at the 90th
    runOnWords: M.sentenceWords.far, notInResume: 2,
  };

  /* The rules, the most important first: the order is the order the fixes are given in. `test` says whether an answer
     passes; `yours` and `target` are what is shown; `fix` is what to do, in plain words. A rule with `when` applies only
     when that is true. A rule with `doubt` is a mark whatever the videos say, and `doubt` is the reason. */
  const s = (n, one, many) => n + " " + (n === 1 ? one : many);
  const RULES = [
    { id: "resume", group: "truth", rule: "Says nothing the resume does not hold", when: (m, o) => !!m.notInResume && o.about === "own",
      test: (m) => m.notInResume.count <= LIMIT.notInResume, yours: (m) => m.notInResume.count + " not in the resume", target: () => LIMIT.notInResume + " at most",
      fix: (m) => `It states things your resume does not: ${[...m.notInResume.numbers, ...m.notInResume.names].slice(0, 6).join(", ")}. Keep only what is true of your own work, and say it the way it happened.` },
    { id: "sentences", group: "shape", rule: "One thing in each sentence", test: (m) => m.sentenceWords <= LIMIT.sentenceWords, yours: (m) => m.sentenceWords + " words a sentence", target: () => `${LIMIT.sentenceWords} at most`,
      fix: (m) => `A sentence here carries ${m.sentenceWords} words, so it carries two or three things. Give each thing its own sentence.` },
    { id: "crowd", group: "audience", rule: "Not crowded with names", doubt: "the owner's own interviewers praised his technical depth and asked for more specific references, not fewer (feedback of 12 Oct 2026); the videos are mostly not as technical as his interviews",
      test: (m) => m.namesPer100 <= LIMIT.namesPer100, yours: (m) => m.namesPer100 + " names in every 100 words", target: () => `${LIMIT.namesPer100} at most`,
      fix: (m) => `It says a name ${s(m.names, "time", "times")} in ${m.words} words: tools, products, places, acronyms (${m.namesSaid.slice(0, 5).join(", ")}${m.namesSaid.length > 5 ? ", and more" : ""}). Keep the two or three the question is about, and say what each one did.` },
    { id: "names", group: "audience", rule: "No sentence stacked with names", test: (m) => m.mostNamesInSentence <= LIMIT.namesInSentence, yours: (m) => m.mostNamesInSentence + " names in one sentence", target: () => `${LIMIT.namesInSentence} at most`,
      fix: (m) => `One sentence carries ${m.mostNamesInSentence} names. A listener keeps two or three. Name the one that matters and say what it does.` },
    { id: "plainWords", group: "audience", rule: "Plain words", test: (m) => m.longWordsPer100 <= LIMIT.longWordsPer100, yours: (m) => m.longWordsPer100 + " long words in every 100", target: () => `${LIMIT.longWordsPer100} at most`,
      fix: (m) => `It reads like writing: ${m.longWords.slice(0, 4).join(", ")}. Where there is a short word for it, say the short word.` },
    { id: "turn", group: "narration", rule: "Has a turn", test: (m) => m.counts.turn >= 1, yours: (m) => s(m.counts.turn, "turn", "turns"), target: () => "1 or more",
      fix: () => `Nothing in it goes other than planned. Say the one thing that did not work, or that surprised you, and what you did then.` },
    { id: "why", group: "narration", rule: "Says why", test: (m) => m.counts.why >= 1, yours: (m) => s(m.counts.why, "reason", "reasons"), target: () => "1 or more",
      fix: () => `It lists what was done and never why. At one step, say the reason: "I checked the host first, because the playbook did not match."` },
    { id: "length", group: "shape", rule: "About a minute", test: (m) => m.words >= LIMIT.minWords && m.seconds <= LIMIT.seconds, yours: (m) => `${m.words} words, ${m.seconds} seconds`, target: () => `${LIMIT.minWords} words or more, ${LIMIT.seconds} seconds at most`,
      fix: (m) => m.words < LIMIT.minWords ? `It is over in ${m.seconds} seconds. Add the one example that shows it.` : `It takes ${m.time.toLowerCase()} to say. Keep the part that answers the question and one example.` },
    { id: "opening", group: "shape", rule: "Opens with a short sentence", test: (m) => m.firstSentenceWords <= LIMIT.firstSentence, yours: (m) => m.firstSentenceWords + " words in the first sentence", target: () => `${LIMIT.firstSentence} at most`,
      fix: (m) => `The first sentence is ${m.firstSentenceWords} words. Open with the answer in one short sentence, then explain.` },
    { id: "closing", group: "shape", rule: "Ends on a short sentence", test: (m) => m.lastSentenceWords <= LIMIT.lastSentence, yours: (m) => m.lastSentenceWords + " words in the last sentence", target: () => `${LIMIT.lastSentence} at most`,
      fix: (m) => `The last sentence is ${m.lastSentenceWords} words, so the ending is lost. Say the last thing in one short sentence.` },
    { id: "pausePoints", group: "shape", rule: "Somewhere to pause", test: (m) => m.longestRun <= LIMIT.run, yours: (m) => m.longestRun + " words with no pause point", target: () => `${LIMIT.run} at most`,
      fix: (m) => `There is a stretch of ${m.longestRun} words with nowhere to pause. Add a full stop, or a comma where the sense breaks.` },
    { id: "numbers", group: "audience", rule: "No sentence stacked with numbers", test: (m) => m.mostNumbersInSentence <= LIMIT.numbersInSentence, yours: (m) => m.mostNumbersInSentence + " numbers in one sentence", target: () => `${LIMIT.numbersInSentence} at most`,
      fix: (m) => `One sentence carries ${m.mostNumbersInSentence} numbers. By ear only one or two stay. Keep the number that shows the result.` },
    { id: "variety", group: "audience", rule: "Sentences do not all start the same", test: (m) => m.sameStart <= LIMIT.sameStart, yours: (m) => m.sameStart + " in a row start the same", target: () => `${LIMIT.sameStart} at most`,
      fix: (m) => `${m.sameStart} sentences in a row start with "${m.sameStartWord}", so they sound like a list. Start one with what happened, or with "But" or "So".` },
    { id: "order", group: "narration", rule: "Steps are in order", test: (m) => m.counts.order >= 1, yours: (m) => s(m.counts.order, "order word", "order words"), target: () => "1 or more",
      fix: () => `The steps are not placed. "First", "then" and "after that" let the listener keep count.` },
    { id: "parts", group: "shape", rule: "A new part is opened so it can be heard", test: (m) => m.newParts >= 1, yours: (m) => s(m.newParts, "new part opened", "new parts opened"), target: () => "1 or more",
      fix: () => `Every sentence carries straight on from the last, so it is heard as one block. Open the next part with "But", "So", "Then" or "For example".` },
    { id: "listener", group: "audience", rule: "Speaks to the listener", doubt: "the videos also hold interviewers and coaches speaking, who say \"you\" far more than a person answering does",
      test: (m) => m.counts.listener >= 1, yours: (m) => s(m.counts.listener, "time", "times"), target: () => "1 or more",
      fix: () => `It never turns to the person listening. Once, say what it means for them: "so you would see it as..."` },
    { id: "runOn", group: "shape", rule: "No run-on sentence", test: (m) => m.runOns === 0, yours: (m) => m.longestSentence + " words in the longest", target: () => `${LIMIT.runOnWords} at most`,
      fix: (m) => `One sentence runs ${m.longestSentence} words. Cut it in two at "and", "which" or "because".` },
    { id: "restate", group: "audience", rule: "Says the hard part again in plain words", test: (m) => m.counts.restate >= 1, yours: (m) => s(m.counts.restate, "time", "times"), target: () => "1 or more",
      fix: () => `A listener outside your field gets no second way in. After the hardest term, add "which means..." and say it plainly.` },
    { id: "example", group: "narration", rule: "Gives an example", asked: "the owner's own interviewers asked for it: \"illustrating context with more concrete examples\" (feedback of 12 Oct 2026)",
      test: (m) => m.counts.example >= 1, yours: (m) => s(m.counts.example, "example", "examples"), target: () => "1 or more",
      fix: () => `There is no example. Give one real case in a sentence or two: "For example, last year..."` },
    { id: "starter", group: "narration", rule: "Starts the way people start", test: (m) => !!m.starter, yours: (m) => m.starter ? `opens with "${m.starter}"` : "goes straight in", target: () => "every other answer",
      fix: () => `It goes straight in, which is fine. About one answer in three in the interviews you gave me opens with "So," or "Well,". Try it on every other answer, not on every one.` },
  ];

  /* How the 391 answers cut from the videos do on each rule, scored by this same file: kompas-answer-tests/calibrate.cjs
     prints this line. `pass` is the share that pass. A rule under RULE_SHARE is a mark. `calibratedOn` is the fingerprint
     of this file and pace-core.js when it was run. */
  const RULE_SHARE = 0.5, MIN_WORDS = 40;
  const VIDEOS = {"answers":392,"videos":30,"pass":{"sentences":0.653,"order":0.533,"parts":0.783,"example":0.133,"turn":0.622,"why":0.556,"names":0.916,"plainWords":0.913,"length":0.638,"opening":0.74,"closing":0.763,"pausePoints":0.554,"numbers":0.936,"variety":0.885,"crowd":0.911,"listener":0.911,"runOn":0.457,"restate":0.227,"starter":0.352},"passedMedian":10,"passedOf":14,"passedLow":9,"passedAll":0,"per1000":{"why":5,"turn":5.6,"order":6,"example":0.9,"restate":1.7,"listener":36.8},"namesPer100":0.6,"longWordsPer100":3.4,"words":177,"seconds":70,"sentenceWords":15,"calibratedOn":"0bede088ab507481"};   // CALIBRATION

  /* A rule counts when at least half of the video answers pass it, or when the owner's own interviewers asked for it
     (`asked`). It never counts when there is a `doubt` about what the videos can say on it. */
  const counts = (r) => !r.doubt && (!!r.asked || VIDEOS.pass[r.id] === undefined || VIDEOS.pass[r.id] >= RULE_SHARE);

  /* The order the fixes are given in, and so the three a person sees first in Practice. On 12 Oct 2026 the owner sent the
     written feedback from a real interview. It praised the technical depth and asked for three things: explanations
     with more structure and step-by-step logic, more concrete examples, and more concise terms. So after truth and
     sentence length come the steps, the parts and the example; the rules about names come later, and the count of
     names is no longer held against an answer at all. */
  const ORDER = ["resume", "sentences", "order", "parts", "example", "turn", "why", "names", "plainWords", "length", "opening", "closing", "pausePoints", "numbers", "variety", "crowd", "listener", "runOn", "restate", "starter"];
  RULES.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  function score(answer, options) {
    const given = options || {};
    const question = String(given.question || ""), resume = String(given.resume || "");
    const o = { question, resume, about: given.about === "own" || given.about === "how" ? given.about : aboutOf(question) };
    const m = measure(answer, o);
    // The rules were measured on answers of 40 words or more. Below that there is nothing to hold an answer to.
    if (m.realWords < MIN_WORDS) return { enough: false, say: `There is not enough here to judge. The rules were measured on answers of ${MIN_WORDS} words or more.`, passed: 0, of: 0, rules: [], marks: [], fixes: [], compare: [], measured: m, about: o.about };
    const judged = RULES.filter((r) => !r.when || r.when(m, o)).map((r) => {
      const passed = !!r.test(m), share = VIDEOS.pass[r.id];
      return { counts: counts(r), row: { id: r.id, group: r.group, rule: r.rule, passed, yours: r.yours(m), target: r.target(m), videos: share === undefined ? null : Math.round(share * 100),
        ...(r.doubt ? { doubt: r.doubt } : {}), ...(r.asked ? { asked: r.asked } : {}), ...(passed ? {} : { fix: r.fix(m) }) } };
    });
    const rules = judged.filter((j) => j.counts).map((j) => j.row), marks = judged.filter((j) => !j.counts).map((j) => j.row);
    const passed = rules.filter((r) => r.passed).length;
    const say = passed === rules.length ? `It passes all ${rules.length} rules.`
      : `It passes ${passed} of ${rules.length} rules.` + (VIDEOS.passedOf ? ` An answer in the interviews you gave me passes ${VIDEOS.passedMedian} of ${VIDEOS.passedOf}.` + (rules.length > VIDEOS.passedOf ? " The rule about the resume cannot be run on a video." : "") : "");
    const compare = [
      { what: "Words in the answer", yours: m.words, videos: VIDEOS.words }, { what: "Seconds to say it", yours: m.seconds, videos: VIDEOS.seconds },
      { what: "Words in a sentence", yours: m.sentenceWords, videos: VIDEOS.sentenceWords }, { what: "Names in every 100 words", yours: m.namesPer100, videos: VIDEOS.namesPer100 },
      { what: "Long words in every 100", yours: m.longWordsPer100, videos: VIDEOS.longWordsPer100 },
      ...[["turn", "Turns"], ["why", "Reasons"], ["order", "Order words"], ["example", "Examples"], ["restate", "Plain restating"]].map(([k, what]) => ({ what: what + " in every 1,000 words", yours: m.per1000[k], videos: VIDEOS.per1000[k] })),
    ];
    return { enough: true, say, passed, of: rules.length, videosPass: { median: VIDEOS.passedMedian, of: VIDEOS.passedOf }, about: o.about,
      rules, marks, fixes: rules.filter((r) => !r.passed).map((r) => r.fix).slice(0, 5), compare, measured: m };
  }

  /* The rule book as data: what GET /api/score answers with, and what the plan is written from. */
  const book = () => RULES.map((r) => ({ id: r.id, group: r.group, rule: r.rule, target: r.target(), counts: counts(r),
    videos: VIDEOS.pass[r.id] === undefined ? null : Math.round(VIDEOS.pass[r.id] * 100), ...(r.when ? { when: "a resume is sent and the question is about the person's own work; it cannot be run on a video" } : {}), ...(r.doubt ? { doubt: r.doubt } : {}), ...(r.asked ? { asked: r.asked } : {}) }));

  globalThis.KompasScore = { RULES, ORDER, LIMIT, VIDEOS, RULE_SHARE, MIN_WORDS, MOVES, counts, spoken, measure, score, aboutOf, book };
})();
