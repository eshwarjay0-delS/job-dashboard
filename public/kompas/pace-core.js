/* Kompas pace core: where a spoken answer pauses, and whether a listener can follow it by ear.
   The page loads this file as a script (KompasPace); the endpoint /api/pace imports the same file.
   Pure code: no DOM, no network, no model. A change here changes the page and the API together.

   The owner, 12 Oct 2026, on the answers he practises: "It was being realistic and Interesting with real examples but not
   actually doing great with balancing the answers so the audience would understand. I need conversation pausing and partial
   structural pausing and more good narration. So you're not confusing as well."

   THE MISTAKE THIS FILE PREVENTS is deciding by taste where a speaker should pause. The numbers below were measured on the
   36 interview videos he chose: 345,471 words, 35 hours of speech, with a time stamp on every word. They say what people
   who are easy to follow actually do:
     - they speak at about 168 words a minute;
     - they pause about every 15 words, for about a third of a second (the conversational pause);
     - about every 32 words the pause is a full second (the structural pause: one part has ended, the next begins);
     - half of all sentence ends carry a pause, a quarter of commas do, and a place with no punctuation almost never
       does (1 in 200). A pause is where the sense breaks, not where the breath runs out;
     - a sentence is 14 words at the median, three in four are under 24, and one in ten runs past 45;
     - an answer is about 176 words, a minute, eight sentences, in two or three parts.
   What the measurement cannot say: who was speaking (a long silence may be the other person, so gaps over 2.5 seconds were
   set aside), and how often people said "um" (the recogniser drops most of them).

   So this file never moves, adds or removes a word. It marks where the pauses fall in a text that is already written, says
   how long it takes to say, and names what would make it hard to follow.

   ONE EXCEPTION, by the owner's word on 12 Oct 2026: "on the start, you can have some filler words to start the
   conversation every other time. And the pauses are needed. And one other thing, never disrupt the technical and
   realistic answers that [Kompas] was already producing." opened() puts one starting word ("So,", "Well,") in front of
   every other answer and changes nothing after it: every word of the answer stays, in its order. In the videos 35 answers
   in 100 open that way, and "So" is nearly half of them. Every other answer is the owner's choice, a little more often. */
(() => {
  const MEASURED = {
    videos: 36, words: 345471, hours: 35,
    wordsPerMinute: 168,
    wordsBetweenPauses: 15, wordsBetweenLongPauses: 32,
    shortPauseSeconds: 0.36, longPauseSeconds: 1.0,
    sentenceWords: { median: 14, most: 24, far: 45 },
    pauseAfter: { sentence: 0.505, comma: 0.267, nothing: 0.005 },
    answer: { words: 176, longWords: 310, seconds: 61, sentences: 8, parts: 2 },
    openers: { share: 0.35, so: 0.46 },       // of 392 answers, 138 open with a starting word; 63 of those with "So"
  };

  // A starting word: said before the answer begins, carrying none of it.
  const STARTER = /^(?:so|well|yeah|yes|yep|okay|ok|right|sure|alright|all right|absolutely|definitely|um|uh|oh|now|honestly|actually|basically|i mean|you know)\b/i;
  // The ones put in front of an answer, in the order they are used. "So" every second time, as in the videos.
  const OPENERS = ["So,", "Well,", "So,", "Yeah, so", "So,", "Okay, so", "So,", "Right,"];
  // A first word that has its capital only because it came first. A name keeps its capital ("So, Kubernetes notices").
  const LOWER = new Set("The A An It Its It's They We This That There These Those My Our When If In On At For To You Your He She What Because Since After Before During Most Every Each One Some Any All First Then With As By From Here How Why Where While Once Usually Typically Generally".split(" "));
  /* The starting word for this answer, or "". `turn` counts answers from 0: the first, the third, the fifth get one.
     None when the answer already starts with one. `own` is a starting word the speaker said themselves: it is used
     whatever the turn (Say it better keeps how a person began). */
  function openerFor(text, turn, own) {
    const t = String(text || "").trim();
    if (!t || STARTER.test(t)) return "";
    if (own) return String(own);
    const n = turn === null || turn === undefined || turn === "" ? NaN : Number(turn);          // no turn given is not turn 0
    return Number.isInteger(n) && n >= 0 && n % 2 === 0 ? OPENERS[(n / 2) % OPENERS.length] : "";
  }
  /* The answer with its starting word in front. Nothing after the starting word is touched, except the capital of a
     first word that only had one because it came first. */
  function opened(text, turn, own) {
    const t = String(text || "").trim(), opener = openerFor(t, turn, own);
    if (!opener) return t;
    const first = t.split(/\s+/)[0];
    return opener + " " + (LOWER.has(first.replace(/[^A-Za-z']/g, "")) ? first[0].toLowerCase() + t.slice(1) : t);
  }

  const count = (t) => { const s = String(t || "").trim(); return s ? s.split(/\s+/).length : 0; };
  // A full stop that does not end a sentence: "e.g.", "U.S.", "Dr.", "3.5". Hidden while sentences are cut, then put back.
  const DOT = "․";
  // Always inside a sentence: "e.g.", "U.S.", and a title before a name ("Dr. Lopez", with its capital).
  const ALWAYS = /\b(?:e\.g|i\.e|vs|u\.s|u\.k)\./gi, TITLES = /\b(?:Mr|Mrs|Ms|Dr|Sr|Jr|St)\./g;
  // Inside a sentence unless a new one plainly starts after it: "etc. Then we stopped" ends there, "etc. and more" does not.
  // (Before 12 Oct 2026 these always hid the stop, so "It took 40 ms. Then we fixed it." and "No. We tried again." were one sentence.)
  const SOMETIMES = /\b(?:[Ee]tc|[Nn]o|[Ii]nc|[Ll]td|[Cc]o|[Aa]\.m|[Pp]\.m)\.(?!\s+["'(]?[A-Z])/g;
  const dots = (m) => m.replace(/\./g, DOT);
  // A stop with a letter or a digit on both sides is inside a word: "3.5", "v1.2.3", "10.0.0.1", "Node.js".
  const hide = (t) => String(t || "").replace(/\s+/g, " ").trim().replace(ALWAYS, dots).replace(TITLES, dots).replace(SOMETIMES, dots).replace(/(\w)\.(?=\w)/g, "$1" + DOT);
  const show = (t) => t.split(DOT).join(".");

  function sentences(text) {
    return (hide(text).match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || []).map((s) => s.trim()).filter(Boolean);
  }
  // The places inside a sentence where the sense breaks: after a comma, a semicolon, a colon or a dash.
  const clauses = (sentence) => (sentence.match(/[^,;:–—]+(?:[,;:–—]+|$)/g) || [sentence]).map((c) => c.trim()).filter(Boolean);
  // A sentence that opens one of these ways begins a new part of the answer: the turn, the next step, the example, the result.
  const NEW_PART = /^(but|however|so|then|next|after that|first|second|third|finally|lastly|for example|for instance|because of that|as a result|in the end|overall|that is why|that's why|now|instead|the result|what i learned|since then)\b/i;
  const JOINING = /\s+(?=(?:and|but|because|so|which|when|while|although|then)\s)/i;

  /* The text as the pieces a speaker says in one go. `after` is what follows the piece: "" (carry on), "beat" (a short
     pause) or "breath" (stop for a second: a new part begins). */
  function pace(text) {
    const all = sentences(text), out = [];
    let piece = "", sincePause = 0, sinceBreath = 0;
    const flush = (after) => { if (piece) out.push({ text: show(piece), after }); piece = ""; if (after) sincePause = 0; if (after === "breath") sinceBreath = 0; };
    all.forEach((sentence, si) => {
      let parts = clauses(sentence);
      // A long sentence with no punctuation in it has nowhere to pause. One place is offered, before a joining word near
      // the middle: the only case in which a pause is marked where the writer put no mark.
      if (parts.length === 1 && count(sentence) > MEASURED.sentenceWords.most) {
        const cuts = sentence.split(JOINING);
        if (cuts.length > 1) {
          let best = 1, total = 0, half = count(sentence) / 2, near = Infinity;
          cuts.forEach((c, k) => { total += count(c); if (k < cuts.length - 1 && Math.abs(total - half) < near) { near = Math.abs(total - half); best = k + 1; } });
          parts = [cuts.slice(0, best).join(" "), cuts.slice(best).join(" ")];
        }
      }
      parts.forEach((clause, ci) => {
        const n = count(clause), last = ci === parts.length - 1;
        piece = piece ? piece + " " + clause : clause;
        sincePause += n; sinceBreath += n;
        if (last) {
          const next = all[si + 1];
          if (!next) flush("");
          else flush(NEW_PART.test(next) || sinceBreath >= MEASURED.wordsBetweenLongPauses ? "breath" : "beat");
        } else if (sincePause + count(parts[ci + 1]) > MEASURED.wordsBetweenPauses && n >= 2) {
          // A pause at this comma only if the next one is out of reach. A list ("Python, Go and Bash") is said in one go.
          flush("beat");
        }
      });
    });
    return out;
  }

  /* Which sentences open a new part of the answer, counted from 0: before each of these the speaker stops for a second.
     The same rule pace() uses, for a caller that keeps its own marks in the text (Say it better). */
  function partStarts(text) {
    const all = sentences(text), starts = [];
    let since = 0;
    all.forEach((s, i) => {
      if (i > 0 && (NEW_PART.test(s) || since >= MEASURED.wordsBetweenLongPauses)) { starts.push(i); since = 0; }
      since += count(s);
    });
    return starts;
  }

  /* The same words with the pauses marked: a dot for a short pause, a new line for a full stop of a second. */
  function marked(text) {
    return pace(text).map((u) => u.text + (u.after === "beat" ? " · " : u.after === "breath" ? "\n" : "")).join("").replace(/ +\n/g, "\n").trim();
  }

  function seconds(text) {
    const units = pace(text), n = count(text);
    const beats = units.filter((u) => u.after === "beat").length, breaths = units.filter((u) => u.after === "breath").length;
    return n / MEASURED.wordsPerMinute * 60 + beats * MEASURED.shortPauseSeconds + breaths * MEASURED.longPauseSeconds;
  }
  function timeText(text) {
    const s = Math.round(seconds(text));
    if (s < 50) return `About ${Math.max(5, Math.round(s / 5) * 5)} seconds`;
    const m = Math.floor(s / 60), r = Math.round((s % 60) / 15) * 15;
    return r === 60 ? `About ${m + 1} minute${m + 1 === 1 ? "" : "s"}` : m === 0 ? "About 50 seconds" : `About ${m} minute${m === 1 ? "" : "s"}${r ? ` ${r} seconds` : ""}`;
  }

  // The moves that let a listener keep hold of the thread. Each is counted in the videos; none is a formula to recite.
  // A word counts only in the sense that makes the move: "since we had no logs" is a reason and "since 2019" is not;
  // "First, I checked" places a step and "my first job" does not. An apostrophe may be straight or curly.
  const MOVES = {
    why: /\b(?:because|the reason|that is why|that['’]s why|which is why|so that|due to|in order to)\b|(?:^|[,.;]\s+)since\s+(?:i|we|it|they|the|this|that|there|my|our)\b/i,
    example: /\b(?:for example|for instance|let['’]s say|one time|there was a time|at my last|when i was|in my last)\b/i,
    turn: /\b(?:but|however|instead|although|though|unfortunately|the problem was|what went wrong|went wrong|turned out|did not work|didn['’]t work|did not go|didn['’]t go|except that)\b/i,
    order: /(?:^|[.!?,;:]\s+|\b(?:and|but|so|i|we|they)\s+)(?:first|firstly|second|secondly|third|then|next|after that|finally|lastly)\b|\b(?:the first (?:thing|step)|first of all)\b/i,
    landing: /\b(as a result|in the end|the result|so overall|overall|that is how|that's how|since then|what i learned|which meant|that meant)\b/i,
  };

  /* What would make this text hard to follow when it is said, in plain words, the most important first and never more
     than three. An answer that is fine gets no notes at all. */
  function report(text, options = {}) {
    const all = sentences(text).map(show), n = count(text);
    const lengths = all.map(count);
    // A sentence past 24 words is ordinary speech (one in four is). Past 45 it is one in ten, and that is what is named.
    const long = all.filter((s) => count(s) > MEASURED.sentenceWords.most);
    const far = all.filter((s) => count(s) > MEASURED.sentenceWords.far);
    const units = pace(text);
    let run = 0, longestRun = 0;
    for (const u of units) { run += count(u.text); if (u.after) { longestRun = Math.max(longestRun, run); run = 0; } }
    longestRun = Math.max(longestRun, run);
    const moves = Object.fromEntries(Object.entries(MOVES).map(([k, rx]) => [k, rx.test(text)]));
    const last = all[all.length - 1] || "";
    const notes = [];
    const skip = new Set(options.skip || []);
    if (n >= 25) {
      if (far.length && !skip.has("long")) notes.push(`${far.length === 1 ? "One sentence runs" : far.length + " sentences run"} past ${MEASURED.sentenceWords.far} words. In the interviews you gave me, nine in ten sentences are shorter than that. Cut the longest in two at "and", "which" or "because".`);
      if (longestRun > 35) notes.push(`There is a stretch of ${longestRun} words with nowhere to pause. People pause about every ${MEASURED.wordsBetweenPauses} words. Add a full stop, or a comma where the sense breaks.`);
      if (n > MEASURED.answer.longWords) notes.push(`This takes ${timeText(text).toLowerCase()} to say. An answer in those interviews runs about a minute. Keep the part that answers the question and one example.`);
      if (!moves.why) notes.push(`Nothing in it says why. One "because" lets the listener follow your reasoning and not only your steps.`);
      if (all.length >= 4 && !moves.turn && !moves.order && !moves.example) notes.push(`Every sentence starts the same way, so the parts run together. Open the next part with "First", "But" or "For example" so it can be heard as a new part.`);
      if (all.length >= 4 && !moves.landing && count(last) > MEASURED.sentenceWords.most) notes.push(`It stops without landing. End on what happened, in one short sentence.`);
    }
    return {
      words: n, sentences: all.length, seconds: Math.round(seconds(text)), time: timeText(text),
      parts: units.filter((u) => u.after === "breath").length + 1,
      medianSentenceWords: lengths.length ? [...lengths].sort((a, b) => a - b)[Math.floor(lengths.length / 2)] : 0,
      longSentences: long.length, veryLongSentences: far.length, longestRun, moves, notes: notes.slice(0, 3),
    };
  }

  globalThis.KompasPace = { MEASURED, MOVES, NEW_PART, STARTER, OPENERS, openerFor, opened, count, sentences: (t) => sentences(t).map(show), pace, partStarts, marked, seconds, timeText, report };
})();
