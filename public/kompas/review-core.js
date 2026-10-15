/* Kompas review core — the logic of What went wrong and of Question Bank practice, in one place.
   The page loads this file as a script (window.KompasReviewCore); the endpoints /api/review and /api/practice import the same file.
   Pure code: no DOM, no network, no model. A change here changes the page and the API together. */
(() => {
  const FILLERS = ["um+", "uh+", "erm*", "ah+", "you know", "i mean", "basically", "so yeah", "and stuff", "or whatever", "okay so", "like i said"];
  const HEDGES = ["i think", "i guess", "i feel like", "maybe", "probably", "kind of", "sort of", "a little bit", "pretty much", "more or less", "i'm not sure", "hopefully", "i would say"];
  const MARK = new RegExp("\\b(" + FILLERS.join("|") + ")\\b|\\b(" + HEDGES.join("|") + ")\\b", "gi");
  // "Yeah, sure. I have eleven years…" answers the question; "Yeah, so, like, uh…" does not. Acknowledgements are skipped,
  // then the opening is weak if filler comes next, or if it was nothing but acknowledgements ("Yeah, yeah, yeah.").
  const ACK = /^(?:yeah|yes|yep|sure|okay|ok|right|alright|well|definitely|absolutely|exactly|correct)\b[,.!\s]*/i;
  function weakOpening(text) {
    let t = String(text).trim(), n = 0;
    while (n < 4 && ACK.test(t)) { t = t.replace(ACK, ""); n++; }
    return n >= 3 || /^(?:so|um+|uh+|erm*|i mean|like|basically|you know)\b/i.test(t);
  }
  // an ending told straight: what it led to, good or bad
  const RESULT = /\b(result|outcome|so that|so it would|so we|which meant|ended up|led to|meant that|because of that|as a result|as a consequence|in the end|since then|after that|afterwards|reduced|increased|saved|improved|cut|fixed|resolved|recovered|restored|prevent(?:ed|s)?|worked|did not work|didn't work|failed|lost|cost (?:us|me)|took (?:us|me)|impact|consequence|we got|we were able|were back|back (?:up|online)|no longer|would not happen|now we|now the|within (?:minutes|hours|days)|agreed|approved|adopted|accepted|signed off|went live|finished|completed|delivered|passed|learned|learnt)\b/i;
  // words that pad a sentence without adding to it; the speaker's own subject words are never in this list
  const PADDING = new Set("really actually literally obviously honestly definitely totally simply things stuff something whatever pretty somehow anyway anyways essentially generally typically".split(" "));
  const STOPW = new Set("about above after again their there these those which while where would could should because before being between during through other under until very have this that with from they them were what when your yours into than then some such only also just more most been does doing each over same".split(" "));
  const words = (t) => (String(t).trim().match(/\S+/g) || []);
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
  // How fast and in how long a sentence people speak, measured on the owner's 36 interview videos (345,471 words with a time
  // on every word; pace-core.js has the rest). These replaced three guesses: 150 words a minute, "a sentence over 25 words is
  // a run-on" (one sentence in four is longer than 24 in ordinary speech, so that rule found a fault in a quarter of
  // everything anyone said), and "one to two minutes is 150 to 250 words" (at the measured pace it is 170 to 340).
  const WPM = 168, RUN_ON = 45, SLOW = 130, FAST = 185;
  const secsText = (w) => { const s = Math.round(w / WPM * 60); return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`; };

  /* ------------------------------ parse ------------------------------ */
  const LINE = /^\s*(?:[\[(]?\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?[\])]?\s*[-–]?\s*)?([A-Za-z][A-Za-z0-9 .'()_-]{0,28}?)\s*:\s+(\S.*)$/;
  function parse(text) {
    const turns = []; let labelled = 0;
    for (const raw of String(text).split(/\r?\n/)) {
      const lineText = raw.trim(); if (!lineText) { if (turns.length) turns[turns.length - 1].gap = true; continue; }
      const m = lineText.match(LINE), who = m && words(m[1]).length <= 4 ? m[1].trim() : "";
      if (who) { labelled++; const last = turns[turns.length - 1]; if (last && last.who === who && !last.gap) last.text += " " + m[2]; else turns.push({ who, text: m[2] }); }
      else if (turns.length && !turns[turns.length - 1].gap) turns[turns.length - 1].text += " " + lineText;
      else turns.push({ who: turns.length && labelled ? turns[turns.length - 1].who : "", text: lineText });
    }
    const speakers = [...new Set(turns.map(t => t.who).filter(Boolean))];
    return { turns, speakers, labelled: labelled > 0 };
  }
  const SMALL_TALK = /\b(how are you|how're you|how is it going|how's it going|how was your|can you hear|hear me|see me|see my screen|am i audible|good (morning|afternoon|evening)|thanks for joining|thank you for joining|nice to meet|are you (there|ready)|shall we (start|begin)|one (second|moment|minute)|give me a (second|moment|minute)|no worries|sounds good)\b/i;
  const OTHER_SIDE = /^(interviewer|interviewers|recruiter|panel|host)\b/i;           // labels that are never the person asking for feedback
  function guessMe(p) {
    const you = p.speakers.find(s => /^(you|me|i|candidate|myself)\b/i.test(s)); if (you) return you;
    if (p.speakers.length && p.speakers.every(s => OTHER_SIDE.test(s))) return "";    // only the other side was captured: none of them is you
    const count = new Map(); p.turns.forEach(t => count.set(t.who, (count.get(t.who) || 0) + words(t.text).length));
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }

  /* ------------------------------ measure ------------------------------ */
  // A piece of one or two words that is not a speaking habit ("Yeah." "So." "Thank you.") is what a recording leaves when it loses the speaker: "The." "Of." "Troll."
  const HABIT = new Set("yeah yes yep ya no nope sure okay ok right alright well so uh uhh um umm and but like oh hi hello hey thanks thank you sorry definitely absolutely exactly correct great good awesome perfect nice cool actually also then first firstly secondly basically true fine please bye welcome hmm of course got it i see that's for not really gotcha".split(" "));
  const flatten = (t) => String(t).replace(/(\d)\.(\d)/g, "$1$2").replace(/\b(?:[A-Za-z]\.){2,}/g, x => x.replace(/\./g, ""));   // "R.S.V.P." and "5.5" are one word, not four sentences
  function noise(text) {
    const pieces = (flatten(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(x => words(x.toLowerCase().replace(/[^a-z0-9' ]/g, " "))).filter(x => x.length);
    const real = pieces.filter(x => !x.every(wd => HABIT.has(wd)));                 // habit pieces count neither for nor against: "Yeah. So." around a real answer is how people talk
    const tiny = real.filter(x => x.length <= 2).length + (String(text).match(/\bla la\b/gi) || []).length;   // "La la la" is what a recogniser writes over music or silence
    return { pieces: real.length, said: real.reduce((n, x) => n + x.length, 0), tiny, share: tiny / Math.max(1, real.length) };
  }
  function measure(text) {
    const sentences = (flatten(text).match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || []).map(s => s.trim()).filter(Boolean), heard = noise(text);
    const w = words(text).length, long = sentences.filter(s => words(s).length > RUN_ON);
    const fillers = [], hedges = []; let m; MARK.lastIndex = 0;
    while ((m = MARK.exec(text))) (m[1] ? fillers : hedges).push(m[0].toLowerCase());
    const freq = new Map(); for (const x of text.toLowerCase().match(/[a-z']{5,}/g) || []) if (!STOPW.has(x)) freq.set(x, (freq.get(x) || 0) + 1);
    const rep = [...freq.entries()].filter(([word]) => PADDING.has(word)).sort((a, b) => b[1] - a[1])[0];
    const full = sentences.filter(x => words(x).length >= 3), asked = full.filter(x => /\?["')\]]*$/.test(x) && !TAG.test(x)).length;   // real questions inside the turn
    const likes = (text.match(/\blike\b/gi) || []).length - (text.match(/\b(would|feel|look|looks|looked|sound|sounds|seem|seems|just|things|something|someone|people|more|much) like\b/gi) || []).length;
    return { src: String(text), words: w, sentences: sentences.length || 1, long, longest: long.reduce((a, s) => Math.max(a, words(s).length), 0), fillers, hedges,
      weakOpen: weakOpening(text), opener: words(text).slice(0, 4).join(" "),
      announced: /\b(situation|task|action|result)s?\s*[:–—-]/i.test(text),          // "Situation: … Result: …" said aloud
      specific: /\d/.test(text) || /[a-z,] [A-Z][a-z]*[A-Z0-9]|[a-z,] [A-Z]{2,}/.test(text), result: RESULT.test(text),
      we: (text.match(/\bwe\b/gi) || []).length, i: (text.match(/\bI\b/g) || []).length,
      repeated: rep && rep[1] >= 3 && rep[1] / Math.max(1, w) > 0.015 ? rep : null,
      likes: likes >= 4 && likes / Math.max(1, w) > 0.03 ? likes : 0,
      pieces: heard.pieces, said: heard.said, noise: heard.tiny, noiseShare: heard.share,
      questions: asked, questionShare: asked / Math.max(1, full.length) };                 // "like" as padding: measured at 3.8 per 100 words
  }
  const ranked = (list) => { const c = new Map(); list.forEach(x => c.set(x, (c.get(x) || 0) + 1)); return [...c.entries()].sort((a, b) => b[1] - a[1]); };
  const top = (list, n = 2) => ranked(list).slice(0, n).map(([k, v]) => `"${k}"` + (v > 1 ? ` ×${v}` : "")).join(", ");
  // An explanation of how something works has no result to give; a question about what you did does.
  const ASKS_WHAT_YOU_DID = /\b(tell me about|describe|walk me through|a time|an example|a project|how did you|what did you|have you|did you|your experience|you handled|you led|you worked)\b/i;
  /* ------------------------------ critique ------------------------------ */
  // The rule of this critic: no blame without proof and a fix, no praise without evidence. Each finding quotes the speaker's own words
  // and says exactly what to do. Findings are ranked by what they cost the listener; the report shows the four that cost most.
  const WEIGHT = { labels: 5, opening: 4, result: 4, stack: 4, heading: 4, fillers: 3, long: 3, trail: 3, length: 3, we: 3, lived: 3, vague: 2, hedges: 2, restarts: 2, like: 2, padding: 1 };
  const TITLE = { labels: "Announcing the parts", opening: "Opening on a filler", result: "No ending", stack: "A stack of I lines", heading: "A side heading", fillers: "Filler words", long: "Run-on sentences",
    trail: "Trailing off", length: "Too long", we: "\"We\" instead of \"I\"", lived: "A story without lived detail", vague: "Vague amounts", hedges: "Hedging", restarts: "False starts", like: "\"Like\" as padding", padding: "Padding words" };
  const FIX = { labels: "Tell it as one story, with no labels.", opening: "Take one silent second, then start on the first real word.",
    result: "End on what the work led to, good or bad, then stop.", stack: "Say it as one person. Join the lines that are one action, and start each later line with so, and, like, then, or but.", heading: "Drop the heading and say the point.", fillers: "Pause where the filler would go. Silence sounds like thinking.", long: "Put a full stop where you would say \"so\" or \"and\".",
    trail: "Land the last line and stop. No \"so yeah\".", length: "Keep the decision and the result; cut the rest.", we: "Say what you did yourself.", lived: "Add who was there, how long it took, and what changed after.",
    vague: "Name the number or the thing, if you know it.", hedges: "State it as a fact you own.", restarts: "Finish the thought in your head, then say it.", like: "Drop \"like\" wherever it is not a comparison.", padding: "Drop the word." };
  const sentencesOf = (t) => (flatten(t).match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || []).map(x => x.trim()).filter(Boolean);
  const quote = (t, n = 8) => { const w = words(t); return w.slice(0, n).join(" ").replace(/[,;:.]+$/, "") + (w.length > n ? "…" : ""); };
  const tail = (t, n = 7) => { const w = words(t); return (w.length > n ? "…" : "") + w.slice(-n).join(" "); };
  const capital = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
  // the first real words of an answer: what is left when the lead-in is taken off
  const LEAD_IN = /^(?:yeah|yes|yep|ya|sure|okay|ok|right|alright|well|so|um+|uh+|erm*|ah+|like|basically|actually|you know|i mean|i must say|i would say|definitely|absolutely|exactly|correct)\b[\s,.!]*/i;
  function firstReal(text) { let t = String(text).trim(); for (let n = 0; n < 10 && LEAD_IN.test(t); n++) t = t.replace(LEAD_IN, ""); return t; }
  // "No ending" is owed only by an answer about work that was done; "lived detail" only by a story. An introduction, a visa question or a list of tools owes neither.
  const WORK_ASK = /\b(a time|an example|a project|a situation|an instance|a challenge|challenges? (?:that )?you|how did you|what did you do|what was the (?:outcome|result)|walk me through (?:how you|what you|a |the |your (?:approach|process|project))|describe (?:a |how you|the (?:project|time|situation))|tell me about (?:a |the (?:project|time|last)|how you|when you)|you (?:handled|led|built|ran|designed|implemented|migrated|resolved|fixed|approached|dealt with))\b/i;
  const STORY_ASK = /\b(a time|an example|a situation|an instance|a case|a challenge|challenges? (?:that )?you|a conflict|a mistake|a failure|disagree\w*|push(?:ed)? back|difficult|when you had to|have you ever|can you remember)\b/i;
  const cutShort = (text) => !/[.!?]["')\]]*\s*$/.test(String(text).trim());               // the recording stopped mid-sentence: the ending is not the speaker's fault
  // where a run-on sentence can stop: the words just before the first "and", "so" or "because" after a full thought
  function cutPoint(sentence) {
    const w = words(sentence);
    for (let i = 8; i < Math.min(w.length - 4, 28); i++) if (/^(and|so|but|because|which|then|while|where|also)$/i.test(w[i].replace(/[^a-z]/gi, ""))) return w.slice(Math.max(0, i - 4), i).join(" ").replace(/[,;:]+$/, "");
    return "";
  }
  const TRAIL = /(?:[,.\s]+(?:so|and|but))?(?:[,.\s]+(?:yeah|uh+|um+|you know|like that|and all|or something|and stuff|that's it|thats it|so))+[.!\s]*$/i;
  const VAGUE = /\b(a lot of|lots of|a bunch of|a couple of|various|several|multiple|many|some kind of|and so on|et cetera|etc|things like that|stuff like that|and everything)\b/gi;
  const NUMBER_SAID = /\d|\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|percent|half|twice)\b/i;
  // what makes a story believed (the owner's five): who was there, how many or how long, what it cost, what you kept doing, what is different now
  const LIVED = {
    "who was there and what they said": /\b(?:manager|director|lead|supervisor|architect|engineer|analyst|auditor|customer|client|vendor|owner|owners|team|colleague|developer|admin|he|she|they) (?:said|told|asked|wanted|came|called|raised|pushed|agreed|refused|needed)\b|\b(?:told|asked|convinced|showed|walked|explained to) (?:me|him|her|them|the|my)\b/i,
    "how many or how long": NUMBER_SAID,
    "what it cost": /\b(took|cost|late|weekend|night|overtime|delay|delayed|deadline|pressure|outage|downtime|lost|risk|escalat\w+|blocked)\b/i,
    "what you kept doing": /\b(again|kept|still|went back|came back|second time|followed up|follow-up|pushed back|tried|retried|until)\b/i,
    "what is different now": /\b(now|since then|today|from then|these days|ever since|became|standard|no longer)\b/i,
  };
  function findingsFor(m, wantsResult = false, question = "") {
    const text = m.src || "", f = [], add = (id, say) => f.push({ id, weight: WEIGHT[id], title: TITLE[id], text: say });
    const clean = sayClean(text), said = clean ? clean.text : text, cut = cutShort(text);    // quotes that say where to begin, stop or end come from the words without the noise
    if (m.announced) add("labels", "Drop the labels (\"Situation:\", \"Result:\"). Tell it as one story: the moment, what fell to you, what you did, how it ended.");
    if (/^\s*#{1,6}\s+\S/m.test(text)) add("heading", "A side heading is not speech. Drop it and say the point.");
    const stackUnits = text.split(/\n+/).map(l => l.replace(/^(?:[-•*]|\d+[.)])\s+/, "").trim()).filter(Boolean);
    const stackEyes = stackUnits.filter(s => /^I\s+/i.test(s));
    if (stackUnits.length >= 4 && stackEyes.length >= 3 && stackUnits.every(s => s.split(/\s+/).length <= 22) && stackEyes.slice(1).some(s => !/^(?:so|and|like|then|but)\b/i.test(s))) {
      add("stack", "This is a robotic stack of \"I\" lines with no connector. Join the lines that are one action, and start each later line with so, and, like, then, or but.");
    }
    if (m.weakOpen) add("opening", `Start with the answer. You opened with "${m.opener}…".` + (clean && clean.words >= 6 ? ` Begin at "${quote(said)}".` : ""));
    if (wantsResult && !m.result && m.words >= 60 && !cut) add("result", `It ends without a result. Close with what it led to: the impact, what stayed stuck, the consequences. Your last words were "${tail(said.replace(/[.!?]+$/, ""), 6)}".`);
    if (m.fillers.length >= 3 || m.fillers.length / m.words > 0.02) { const rate = m.fillers.length / m.words * 100; add("fillers", `Cut the fillers (${top(m.fillers)}). Pause instead.` + (rate >= 5 && m.words >= 30 ? ` That is ${Math.round(rate)} in every 100 words.` : "")); }
    if (m.long.length) {
      const worst = m.long.slice().sort((a, b) => words(b).length - words(a).length)[0], tidy = sayClean(worst), stop = cutPoint(tidy ? tidy.text : worst);
      add("long", `Split the long sentence${m.long.length > 1 ? "s" : ""}: one ran ${m.longest} words. Stop at the first full thought.` + (stop ? ` Put a full stop after "…${stop}".` : ""));
    }
    const trail = m.words >= 25 && !cut && !f.some(x => x.id === "result") ? (text.match(TRAIL) || [""])[0].replace(/^[,.\s]+|[.!\s]+$/g, "") : "";
    if (trail) { const kept = sentencesOf(said).filter(x => words(x).length >= 4).pop(); add("trail", `It trails off on "${trail}".` + (kept ? ` End on "${tail(kept.replace(/[.!?]+$/, ""), 7)}" and stop.` : " Land your last real sentence and stop.")); }
    if (m.words > 260) add("length", `This ran about ${secsText(m.words)} aloud. Keep the decision and the result; cut the rest.`);
    if (m.we >= 4 && m.we > m.i * 2) add("we", `You said "we" ${m.we} times and "I" ${m.i}. Say what you did yourself.`);
    if (STORY_ASK.test(question) && m.words >= 80 && !cut) { const missing = Object.keys(LIVED).filter(k => !LIVED[k].test(text)); if (missing.length >= 4) add("lived", `A story is believed for its lived detail, and this one has ${5 - missing.length} of five. Add ${missing.slice(0, 2).join(", and ")}.`); }
    if (m.words >= 60 && !NUMBER_SAID.test(text)) { const v = [...new Set((text.match(VAGUE) || []).map(x => x.toLowerCase()))]; if (v.length >= 2) add("vague", `"${v[0]}" and "${v[1]}" are not numbers. If you know the count, say it. Never make one up.`); }
    if (m.hedges.length >= 2 || (m.hedges.length && m.words < 40)) add("hedges", `Say it plainly. "${ranked(m.hedges)[0][0]}" makes a fact sound like a guess.`);
    const again = (text.match(/\b([A-Za-z']{1,12})[,.]?\s+\1\b/gi) || []).filter(x => { const w = x.toLowerCase().match(/[a-z']+/)[0]; return !HABIT.has(w) && w !== "la"; });   // "uh, uh" and "sure, sure" are fillers, counted elsewhere
    if (again.length >= 3 && again.length / m.words > 0.015) add("restarts", `You restarted ${again.length} times ("${again[0].toLowerCase()}"). Finish the thought in your head, then say it.`);
    if (m.likes) add("like", `You said "like" ${m.likes} times. Drop it wherever it is not a comparison.`);
    if (m.repeated) add("padding", `"${m.repeated[0]}" appears ${m.repeated[1]} times and adds nothing. Drop it.`);
    return f.map((x, n) => ({ ...x, n })).sort((a, b) => b.weight - a.weight || a.n - b.n).map(({ n, ...x }) => x);
  }
  // the four findings that cost most, as sentences; praise only when it is earned: a real answer, cleanly heard, with no filler or hedge in it and not mostly "Yes. Yes. Exactly."
  function tipsFrom(findings, m) {
    const earned = m.words >= 30 && !m.noise && !m.fillers.length && !m.hedges.length && m.said / m.words >= 0.85;
    return findings.length ? findings.slice(0, 4).map(x => x.text) : earned ? ["Clear and direct. Keep this one."] : [];
  }
  const tipsFor = (m, wantsResult = false, question = "") => tipsFrom(findingsFor(m, wantsResult, question), m);
  const scoreOf = (findings) => Math.max(10, clamp(100 - findings.reduce((n, x) => n + x.weight * 5, 0)));          // 10 is the floor: a number that says "start here", never "nothing here"

  // The speaker's own answer with the noise taken out: fillers, padded "like", restarts, stubs and the trailing "so yeah".
  // It only removes. Nothing is added or reworded, so it cannot say anything the speaker did not.
  const STUB = new Set([...HABIT, "the", "a", "an", "to", "of", "in", "we", "i", "it", "is", "my", "for", "that", "this", "with", "on", "at", "as", "was", "are", "be", "or"]);
  const LIKE_AFTER = "(?:so|and|but|or|of|for|with|on|in|at|the|a|an|my|our|your|their|this|that|these|those|which|by|to|from|as|has|have|had|includes|including|using|because|when|whenever|where|what|how|any|some|very|not|also|then)";
  function sayClean(text) {
    const src = String(text).replace(/\s+/g, " ").trim(); if (!src) return null;
    const fill = "(?:" + FILLERS.join("|") + ")", removed = {};
    let t = src;
    const step = (kind, f) => { const n = words(t).length; t = f(t); const d = n - words(t).length; if (d > 0) removed[kind] = (removed[kind] || 0) + d; };   // each improvement is counted, so it can be listed
    if (weakOpening(t)) step("opening", x => capital(firstReal(x)));
    t = t.replace(/(\d)\.(\d)/g, "$1§$2").replace(/\b(?:[A-Za-z]\.){2,}/g, x => x.replace(/\./g, "§"));          // decimals and "R.S.V.P." are not sentence ends
    step("fillers", x => x.replace(new RegExp("(^|[.!?]\\s+)" + fill + "\\b[,.!]*(?:\\s+|$)", "gi"), "$1")             // a filler that opens a sentence
      .replace(new RegExp("[,;]?\\s+" + fill + "\\b[,;]?(?=[\\s.!?]|$)", "gi"), ""));                                  // a filler inside one
    step("like", x => x.replace(/,\s*like,\s*/gi, " ").replace(/(^|[.!?]\s+)like,?\s+/gi, "$1").replace(/\s+like,\s+/gi, " ")   // "like" as padding: between commas, opening a sentence,
      .replace(new RegExp("\\b(" + LIKE_AFTER + "),?\\s+like\\b(?!\\s+to\\b)", "gi"), "$1")                                //   after a small word ("to like understand", "which has like scheduled")
      .replace(/\b(is|are|was|were|am|be|been)\s+like\b(?!\s+(?:a|an|the|to)\b)/gi, "$1"));                              //   and after "is" unless a comparison follows ("is like a jump server" stays)
    step("restarts", x => { for (let n = 0; n < 2; n++) x = x.replace(/\b([A-Za-z']{1,14}(?:\s+[A-Za-z']{1,14})?)[,.]?\s+\1\b/gi, "$1"); return x; });   // "the, the" and "I really I really"
    step("trailing", x => x.replace(/[,\s]+(?:(?:and|so|but)[,\s]+)?yeah\s*([.!?])/gi, "$1"));                           // "…in the field and, yeah."
    step("stubs", x => (x.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || []).map(y => y.trim()).filter((y, n) => {
      const w = words(y.toLowerCase().replace(/[^a-z0-9'§ ]/g, " ")); if (!w.length) return false;
      if (w.length <= 2 && w.every(k => STUB.has(k))) return n === 0 && w.length === 1 && /^(yes|no|yeah|yep|nope)$/.test(w[0]);   // "So." "The." "Yeah." are stubs; an opening "Yes." is an answer
      return true;
    }).join(" "));
    step("trailing", x => x.replace(/[,\s]+(?:and|so|but|or|like|because)\s*([.!?])/gi, "$1"));                          // a sentence left hanging on "and."
    t = t.replace(/\s+([,.;!?])/g, "$1").replace(/,\s*,/g, ",").replace(/([.!?])\s*,/g, "$1").replace(/,\s*([.!?])/g, "$1").replace(/\.{2,}/g, ".").replace(/\s{2,}/g, " ").trim();
    t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_m, x, y) => x + y.toUpperCase()).replace(/§/g, ".");
    if (t && !/[.!?]$/.test(t)) t += cutShort(src) ? "…" : ".";                                                       // an answer the recording cut is shown as cut
    const before = words(src).length, after = words(t).length, cut = before - after;
    return after >= 5 ? { text: t, words: after, cut, seconds: Math.round(cut / WPM * 60), removed } : null;
  }
  // what the noise-free version took out, as a list a person can read
  const REMOVED = { opening: "the lead-in", fillers: "fillers", like: "padded \"like\"", restarts: "repeated words", stubs: "broken-off pieces", trailing: "the trailing end" };
  const removedList = (c) => Object.keys(REMOVED).filter(k => c.removed[k]).map(k => `${REMOVED[k]} (${c.removed[k]} word${c.removed[k] > 1 ? "s" : ""})`);

  // Your own question to the other side ("What does success look like in this role?") is not an answer to review. "…, you know?" is not a question.
  const TAG = /\b(you know|okay|ok|yeah|make sense)\?\s*$/i;
  function asksBack(text, w) {
    const parts = (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(x => x.trim()).filter(x => words(x).length >= 3);
    const asked = parts.filter(x => /\?$/.test(x) && !TAG.test(x)).length;
    if (!asked) return false;
    return (w < 40 && /\?\s*$/.test(text.trim()) && !TAG.test(text.trim())) || asked / parts.length >= 0.5;
  }
  const CLOSING = /\b(thanks for (?:the|your) time|thank you for (?:the|your) time|thank you so much|nice (?:meeting|talking|speaking)|pleasure (?:meeting|talking|speaking)|great (?:meeting|talking|speaking)|have a (?:great|good|nice|wonderful)|talk to you (?:later|soon)|bye)\b/gi;
  const goodbye = (text, w) => { const n = (text.match(CLOSING) || []).length; return (w < 40 && n >= 1) || (w < 60 && n >= 2); };   // a longer turn needs two such phrases: an introduction can hold one
  function analyse(p, me) {
    let all = [];
    if (p.labelled && p.speakers.some(s => s !== me)) {
      if (!me) return null;                                                         // your own voice is not in this transcript
      p.turns.forEach((t, n) => {
        if (t.who !== me) return;
        const prev = p.turns[n - 1], said = prev && prev.who !== me ? prev.text : "";  // the turn right before; an older question is not this answer's question
        const q = words(said).length >= 4 ? said : "";                              // "Yeah." or "In terms?" is an interjection, not what was asked
        // an answer is a real turn (12+ words outside "Yeah. Sure. Okay."), or a short reply to something that was actually asked; "yeah, I can hear you" is neither
        // a short reply is an answer only to a real question: not to a sound check, a greeting or "how are you"
        const w = words(t.text).length, heard = noise(t.text);
        if (heard.said < 12 && !(w >= 5 && heard.said >= 3 && /\?\s*$/.test(q) && words(q).length >= 8 && !SMALL_TALK.test(q))) return;
        if (w < 80 && asksBack(t.text, w)) return;                                   // "Should I turn on the video?" is your question, not your answer
        if (goodbye(t.text, w) && !ASKS_WHAT_YOU_DID.test(q)) return;                // "Thank you so much, it was nice meeting you" is a goodbye
        if (w < 12 && heard.tiny) return;                                            // "Uh, never. This. This was" is a reply the recording broke
        if (w < 25 && SMALL_TALK.test(q) && !/\b(tell me|describe|walk me|experience|project|why|what did|how did|have you)\b/i.test(q)) return;
        all.push({ question: q.length > 320 ? "…" + q.slice(-320) : q, text: t.text });
      });
    } else all = p.turns.filter(t => words(t.text).length >= 12).map(t => ({ question: "", text: t.text }));
    all.forEach(a => {
      a.m = measure(a.text);
      a.wantsResult = WORK_ASK.test(a.question || "");
      // broken fragments ("The. 12 to 2. Madera.") are a recording that did not catch the speaker, not a way of speaking
      // real speech averages 7+ words a sentence: under 4 is a recording in pieces, and so is one where a third of the pieces are stray words
      a.garbled = (a.m.pieces >= 4 && a.m.said / a.m.pieces < 4) || (a.m.noise >= 3 && a.m.noiseShare >= 0.3 && a.m.words / a.m.noise <= 15);
      // several questions inside one turn means the recording put both sides in one voice (or it is you interviewing them): a back-and-forth, not an answer
      a.mixed = !a.garbled && a.m.words >= 80 && ((a.m.questions >= 3 && a.m.questionShare >= 0.2) || (a.m.words > 500 && a.m.questions >= 2));
      const judged = !a.garbled && !a.mixed;
      a.findings = judged ? findingsFor(a.m, a.wantsResult, a.question) : [];
      a.tips = a.garbled ? ["This part looks mis-heard by the recording (it is broken into fragments), so it is not judged."]
        : a.mixed ? ["This part is a back-and-forth with questions inside it, not one answer, so it is not judged."] : tipsFrom(a.findings, a.m);
      a.score = judged && a.m.words >= 15 ? scoreOf(a.findings) : null;
      a.clean = judged ? sayClean(a.text) : null;
    });
    if (!all.length) return null;
    let no = 0; all.forEach(a => { a.no = stateOf(a) === "listed" ? ++no : 0; });       // the number the report shows: "Answer 3"
    const answers = all.filter(a => !a.garbled && !a.mixed), heard = all.reduce((s, a) => s + a.m.words, 0), frag = all.reduce((s, a) => s + a.m.pieces, 0), said = all.reduce((s, a) => s + a.m.said, 0);
    // A session is set aside only when little of it is usable. A partly mis-heard one keeps its clear answers and skips the rest.
    const clear = answers.reduce((n, a) => n + a.m.words, 0);
    const poor = !answers.length || (frag >= 6 && said / frag < 4.5 && (answers.length < 2 || clear / Math.max(1, heard) < 0.4));
    const lostTo = (k) => all.filter(a => a[k]).reduce((n, a) => n + a.m.words, 0);
    if (poor) return { poor: true, bothSides: lostTo("mixed") > lostTo("garbled"), answers: all, N: all.length, W: heard, avgSentence: said / Math.max(1, frag) };
    const N = answers.length;
    const sum = (f) => answers.reduce((s, a) => s + f(a.m), 0);
    const W = sum(m => m.words), S = sum(m => m.sentences), L = sum(m => m.long.length), F = sum(m => m.fillers.length), H = sum(m => m.hedges.length);
    const share = (f) => answers.filter(a => f(a.m)).length / N, per100 = (x) => x / Math.max(1, W) * 100;
    // your share of the talking counts everything you said, not only the answers judged; with both sides in one block it cannot be known
    const mine = p.turns.reduce((s, t) => s + (t.who === me ? words(t.text).length : 0), 0), spokenByAll = p.turns.reduce((s, t) => s + words(t.text).length, 0);
    // the session's habits, ranked by how many answers they hit and what each costs; then the answer to copy and the answer to redo
    const tally = new Map(); answers.forEach(a => a.findings.forEach(x => tally.set(x.id, (tally.get(x.id) || 0) + 1)));
    const priorities = [...tally.entries()].filter(([, n]) => n >= (N >= 4 ? 2 : 1)).map(([id, n]) => ({ id, title: TITLE[id], count: n, of: N, fix: FIX[id], weight: WEIGHT[id] }))
      .sort((x, y) => y.count * y.weight - x.count * x.weight).slice(0, 3);
    // every improvement, listed: habit by habit, and under each habit every place it happened, in the speaker's own words
    const improvements = [...tally.keys()].map(id => ({ id, title: TITLE[id], fix: FIX[id], weight: WEIGHT[id],
      where: answers.filter(a => a.findings.some(x => x.id === id)).map(a => ({ answer: a.no, text: a.findings.find(x => x.id === id).text })) }))
      .map(g => ({ ...g, count: g.where.length })).sort((x, y) => y.count * y.weight - x.count * x.weight);
    const rated = answers.filter(a => a.score != null && a.m.words >= 30).sort((x, y) => y.score - x.score || y.m.words - x.m.words);
    const best = rated.length >= 3 ? rated[0] : null, worst = best && rated[rated.length - 1].score < best.score ? rated[rated.length - 1] : null;
    const why = (a) => [!a.m.weakOpen && "opens on the answer", a.m.fillers.length / a.m.words < 0.02 && "almost no filler", NUMBER_SAID.test(a.text) && "names a number", a.m.result && "says what it led to", !a.m.long.length && "short sentences"].filter(Boolean).slice(0, 3);
    const tidy = answers.filter(a => a.clean && a.clean.cut >= 3), saved = tidy.reduce((n, a) => n + a.clean.cut, 0);
    return { answers: all, N, W, F, H, L, priorities, improvements, noise: { words: saved, seconds: Math.round(saved / WPM * 60), share: Math.round(saved / Math.max(1, W) * 100) },
      strongest: best ? { at: all.indexOf(best), answer: best.no, score: best.score, why: why(best) } : null,
      weakest: worst ? { at: all.indexOf(worst), answer: worst.no, score: worst.score, why: worst.findings.slice(0, 2).map(x => x.title.toLowerCase()) } : null,
      longestAnswer: Math.max(...answers.map(a => a.m.words)),
      talkShare: p.labelled && p.speakers.length > 1 && !all.some(a => a.mixed) ? Math.round(mine / Math.max(1, spokenByAll) * 100) : null,
      fillers: answers.flatMap(a => a.m.fillers), hedges: answers.flatMap(a => a.m.hedges),
      weakOpens: answers.filter(a => a.m.weakOpen).length, noResult: answers.filter(a => a.wantsResult && !a.m.result && a.m.words >= 60).length,
      scores: {
        Clarity: clamp(100 - (L / Math.max(1, S) * 100) * 0.9 - Math.max(0, W / Math.max(1, S) - 18) * 2.5),
        Conciseness: clamp(100 - Math.min(75, per100(F) * 5) - Math.min(50, Math.max(0, W / N - 220) / 5)),   // 2 fillers per 100 words = 90, 8 = 60, 15 and over = 25
        Confidence: clamp(100 - per100(H) * 10 - per100(F) * 3 - share(m => m.weakOpen) * 25),
        Structure: clamp(share(m => !m.weakOpen) * 45 + share(m => m.specific) * 25
          + (answers.filter(a => !a.wantsResult || a.m.result || a.m.words < 60).length / N) * 30),
      } };
  }

  /* ------------------------------ uploads and session exports ------------------------------ */
  const MAX_CHARS = 300000;                                                         // a three-hour session fits; measuring is code, so size costs nothing
  const MD_LINE = /^\*\*([^*·]{1,40}?)\s*·\s*([^*]{0,14}?):\*\*\s*(.*)$/;
  const clockMinutes = (t) => { const m = /(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(t || ""); if (!m) return null; let h = Number(m[1]) % 12; if (/pm/i.test(m[3] || "")) h += 12; return h * 60 + Number(m[2]); };
  // A raw session export (.json): { sessions: [{ listing, transcription: [{ content, type, speaker, createdAt }] }] }.
  // Only the transcription list is read: "microphone" lines are yours, everything else is the other side.
  function splitExportJson(raw) {
    let d; try { d = JSON.parse(raw); } catch { return null; }
    const list = Array.isArray(d) ? d : d && Array.isArray(d.sessions) ? d.sessions : null; if (!list) return null;
    const out = [];
    for (const item of list) {
      const rows = (item && Array.isArray(item.transcription) ? item.transcription : []).filter(x => x && String(x.content || "").trim())
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      if (!rows.length) continue;
      const lines = []; let lastWho = "", lastAt = 0;
      for (const x of rows) {
        const who = x.type === "microphone" ? "You" : "Interviewer " + (Number.isFinite(Number(x.speaker)) && x.speaker !== null && x.speaker !== "" ? Number(x.speaker) + 1 : 1);
        const at = Date.parse(x.createdAt) / 60000;
        if (who === lastWho && Number.isFinite(at) && lastAt && at - lastAt >= 2) lines.push("");       // the same rule as the Markdown export: a new answer
        lines.push(`${who}: ${String(x.content).replace(/\s+/g, " ").trim()}`); lastWho = who; lastAt = Number.isFinite(at) ? at : lastAt;
      }
      const L = item.listing || item.session || {}, when = L.createdAt ? new Date(L.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";
      out.push({ title: [L.title, L.shortDescription, when].filter(Boolean).join(" — ") || "Session", text: lines.join("\n") });
    }
    return out;
  }
  function splitSessions(raw) {
    if (/^\s*[\[{]/.test(String(raw).slice(0, 40))) { const fromJson = splitExportJson(raw); if (fromJson) return fromJson; }
    const t = String(raw).replace(/\r/g, "");
    if (!/^\*\*[^*·]{1,40}·[^*]{0,14}:\*\*/m.test(t))                                // no spoken lines: an export that captured nothing, or another format
      return /^##\s+Transcript\s*$/m.test(t) || /_No transcript\._/.test(t) ? [] : null;
    // each line carries its time: the same speaker again two or more minutes later is a new answer (the question between was not captured)
    const spoken = (block) => {
      const out = []; let lastWho = "", lastAt = null;
      for (const l of block.split("\n")) {
        const m = l.trim().match(MD_LINE); if (!m || !m[3].trim()) continue;        // a speaker line with no words is not speech
        const who = m[1].trim(), at = clockMinutes(m[2]);
        if (who === lastWho && at != null && lastAt != null && (at - lastAt >= 2 || at < lastAt)) out.push("");
        out.push(`${who}: ${m[3]}`); lastWho = who; lastAt = at;
      }
      return out.join("\n");
    };
    const one = t.match(/^##\s+Transcript\s*$/m);
    if (one) {                                                                       // a single session file: the transcript section only
      const rest = t.slice(one.index + one[0].length), end = rest.search(/^##\s+\S/m);
      const title = (t.match(/^#\s+(.+)$/m) || [, "Session"])[1].trim();
      return [{ title, text: spoken(end >= 0 ? rest.slice(0, end) : rest) }].filter(s => s.text);
    }
    const out = [], parts = t.split(/^##\s+/m);                                      // many sessions in one file
    for (const part of parts.slice(1)) {
      const nl = part.indexOf("\n"), text = spoken(part.slice(nl + 1));
      if (text) out.push({ title: part.slice(0, nl).replace(/^\d+\.\s*/, "").trim(), text });
    }
    return out.length ? out : [{ title: "Transcript", text: spoken(t) }].filter(s => s.text);
  }
  function normalizeUpload(raw, name) {
    let t = String(raw).replace(/\r/g, "");
    if (/\.(vtt|srt)$/i.test(name) || /^WEBVTT/.test(t) || /\d\d:\d\d:\d\d[.,]\d{3}\s*-->/.test(t)) {           // captions: drop cue numbers and timings, keep the speaker
      const out = [];
      for (const l of t.split("\n")) {
        const s = l.trim();
        if (!s || /^WEBVTT/.test(s) || /-->/.test(s) || /^\d+$/.test(s) || /^(NOTE|STYLE|REGION)\b/.test(s)) continue;
        out.push(s.replace(/<v\s+([^>]+)>/gi, "$1: ").replace(/<[^>]+>/g, "").trim());
      }
      t = out.join("\n");
    }
    // "Name   0:03" on one line and the words on the next (Teams and Otter documents) → "Name: words"
    const out = []; let who = "";
    for (const l of t.split("\n")) {
      const s = l.trim(), m = s.match(/^([A-Za-z][A-Za-z0-9 .'_-]{1,38}?)\s+(?:\d{1,2}:)?\d{1,2}:\d{2}$/);
      if (m) { who = m[1].trim(); continue; }
      out.push(who && s && !LINE.test(s) ? `${who}: ${s}` : l);
    }
    return out.join("\n").trim().slice(0, MAX_CHARS);
  }

  /* ------------------------------ practice (Question Bank) ------------------------------ */
  // One typed or spoken practice answer, judged with the same measurements as a transcript.
  // spokenSecs > 0 means the answer was said aloud and timed, so pace is measured, not estimated
  function practice(text, category, spokenSecs = 0, question = "") {
    const t = text.trim(), words = t ? t.split(/\s+/).length : 0, sec = spokenSecs || Math.round(words / WPM * 60);
    const time = `${sec >= 60 ? Math.floor(sec / 60) + " min " : ""}${sec % 60} s`;
    const tips = [];
    if (!words) return { stats: ["Nothing yet"], tips: ["Press Answer aloud and say it, or type the answer or its key points."] };
    const wpm = spokenSecs ? Math.round(words / spokenSecs * 60) : 0;
    const stats = spokenSecs ? [`${words} words in ${time}`, `${wpm} words a minute`] : [`${words} words`, `about ${time} aloud`];
    const m = measure(t), fillers = m.fillers.length; if (fillers) stats.push(`${fillers} filler${fillers > 1 ? "s" : ""}`);
    if (spokenSecs) tips.push(wpm < SLOW ? "Slow. People in the interviews you gave me speak at 150 to 175 words a minute." : wpm > FAST ? "Fast. People in the interviews you gave me speak at 150 to 175 words a minute. Stop at the full stops." : "Good speaking pace.");
    if (m.hedges.length >= 2) tips.push(`You hedged ${m.hedges.length} times ("${m.hedges[0]}"). Say it plainly.`);
    // never announce the parts of a story; tell it
    if (m.announced) tips.push("Drop the labels (\"Situation:\", \"Result:\"). Tell it as one story: the moment, what fell to you, what you did, how it ended.");
    if (words < 60) tips.push("Add detail: an answer in the interviews you gave me runs about a minute, around 170 words.");
    else if (words > 330) tips.push("Trim it: this runs past two minutes aloud.");
    else tips.push("Good length for a spoken answer.");
    // the story check is for questions that ask for an event, not for an introduction or a "why this role"
    if (category === "Behavioral" || /\b(a time|describe a|an example|a mistake|an incident|a project where)\b/i.test(question)) {
      const has = {
        Situation: /\b(when|while|at the time|we were|in the middle of|during|last (?:year|month|week|spring|summer|winter)|one (?:day|night|morning)|imagine|situation|context|we had|there was)\b/i,
        Action: /\bI (?:[a-z]+ed|started|began|built|led|wrote|ran|took|told|found|set|made|did|went|got|rebuilt|shut)\b/i,
        Result: RESULT };
      const missing = Object.keys(has).filter(k => !has[k].test(t));
      const say = { Situation: "the moment it happened", Action: "what you did yourself", Result: "how it ended" };
      tips.push(missing.length ? `For a story, also say ${missing.map(k => say[k]).join(", ")}.` : "Good: the moment, what you did and how it ended are all there.");
    }
    // only a filler opening is certainly wrong: "Yeah, I led that" answers the question, "Yeah, so, like, uh" does not
    if (m.weakOpen) tips.push("Drop the opening filler. Start on the first real word.");
    if (m.long.length) tips.push(`Split the long sentence${m.long.length > 1 ? "s" : ""}: one ran ${m.longest} words. Stop at the first full thought.`);
    if (fillers > 2) tips.push("Cut the filler words; pause instead.");
    if (m.likes) tips.push(`You said "like" ${m.likes} times. Drop it wherever it is not a comparison.`);
    // a number counts whether typed as a digit or spoken as a word ("eleven years")
    if (!(/\d/.test(t) || NUMBER_WORD.test(t))) tips.push("If you have a true number for this, say it: a count, a time, a size.");
    const shown = tips.slice(0, 4);                                                 // a few things to fix, not a list to read
    if (spokenSecs) shown.push("Speech recognition drops most \"um\" and \"uh\", so listen for those yourself.");
    return { stats, tips: shown };
  }
  const NUMBER_WORD = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|percent|half|double|twice)\b/i;

  /* ------------------------------ review (the whole feature, as data) ------------------------------ */
  // Where an answer ends up in the report: listed with its tips, or named in the one "not listed" line.
  const stateOf = (a) => a.garbled ? "mis-heard" : a.mixed ? "both-sides" : (!a.tips.length && a.m.words < 30) ? "quiet" : "listed";
  // A transcript in (pasted text, an upload, or a session export with many sessions), reports out: what the page shows, as plain data.
  // opts: { me, name (file name, for caption files), detail: "full" | "summary" (no answer texts), limit }
  function review(raw, opts = {}) {
    const text = String(raw || ""), split = splitSessions(text);
    const list = split === null ? [{ title: opts.title || "Transcript", text: normalizeUpload(text, opts.name || "") }] : split;
    return list.slice(0, Math.max(1, Math.min(400, opts.limit || 400))).map(s => reviewOne(s.title, String(s.text).slice(0, MAX_CHARS), opts));
  }
  function reviewOne(title, text, opts) {
    const p = parse(text), guess = guessMe(p), need = p.labelled && (p.speakers.length > 1 || !guess);
    const me = opts.me && p.speakers.includes(opts.me) ? opts.me : need ? guess : (p.speakers[0] || "");
    const base = { title, speakers: p.speakers, me };
    const r = words(text).length < 12 ? null : analyse(p, me);
    if (!r) return { ...base, outcome: !text.trim() ? "no transcript" : p.labelled && !me ? "not captured" : "no answers" };
    const full = opts.detail !== "summary";
    const answers = r.answers.map(a => ({ state: stateOf(a), no: a.no, words: a.m.words, fillers: a.m.fillers.length, score: a.score, tips: a.tips, findings: a.findings,
      clean: a.clean && a.clean.cut >= 3 ? { words: a.clean.words, cut: a.clean.cut, seconds: a.clean.seconds, removed: a.clean.removed, removedList: removedList(a.clean), ...(full ? { text: a.clean.text } : {}) } : null,
      ...(full ? { question: a.question, text: a.text } : {}) }));
    const count = (k) => answers.filter(a => a.state === k).length;
    const notListed = { quiet: count("quiet"), misHeard: count("mis-heard"), bothSides: count("both-sides") };
    if (r.poor) return { ...base, outcome: r.bothSides ? "both sides in one voice" : "mis-heard", words: r.W, notListed, answers };
    return { ...base, outcome: "reviewed", answersJudged: r.N, words: r.W, scores: r.scores,
      facts: { fillersPer100: Number((r.F / Math.max(1, r.W) * 100).toFixed(1)), fillers: r.F, hedges: r.H, longSentences: r.L, weakOpenings: r.weakOpens, noResult: r.noResult,
        longestAnswer: r.longestAnswer, talkShare: r.talkShare, topFillers: top(r.fillers, 3), topHedges: top(r.hedges, 3) },
      priorities: r.priorities, improvements: r.improvements, strongest: r.strongest, weakest: r.weakest, noise: r.noise, notListed, answers };
  }

  globalThis.KompasReviewCore = { FILLERS, HEDGES, MARK, weakOpening, words, clamp, secsText, LINE, parse, SMALL_TALK, guessMe, noise, measure, ranked, top, ASKS_WHAT_YOU_DID, tipsFor, findingsFor, sayClean, removedList, scoreOf, asksBack, goodbye, analyse, MAX_CHARS, splitExportJson, splitSessions, normalizeUpload, practice, stateOf, review };
})();
