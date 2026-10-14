/* Kompas voice layer: the owner's human-voice rules, hardcoded as the soil and root.
   Ported from perfACT's copilot-api/_voice.js (perfACT sunset, 2026-10-14).

   Whatever model or API writes the answer, every line passes through here before it reaches the
   screen, so these procedures hold even when the AI behind it changes. No model, no network, no
   dependencies: plain deterministic string repairs.

   Sources of truth
   - engine.py validate(), BANNED and TECHY: calibrated on 817 sentences of real NotebookLM output.
   - The Master Copilot prompt: FULL STOPS ARE MANDATORY (past 25 words it becomes two),
     DELIVERY MARKUP (bold / italic / pause caps), A HABIT IS A CLAIM, VOICE (the scan words).

   MarketFit adaptation: perfACT used (pause); MarketFit uses [beat]/[breath].
   All pause markers normalise to (pause) internally; output restores [breath].

   Exports
   - voiceState()             per-answer counters { italics, pauses, paragraphs }
   - voiceLine(line, state)   repair ONE completed line while the answer streams
   - voiceFinish(text)        whole-answer pass after streaming (adds a missing breath)
   - voiceCheck(text, tier)   JS port of engine.py validate(): the same 12 checks and thresholds
   - voiceRepair(text)        whole-answer convenience: voiceLine per line + voiceFinish */

/* ------------------------------------------------------------------ shared constants */

const HY = "[-\\u2010\\u2011\\u2012\\u2013]";          // hyphen, U+2010, U+2011 (non-breaking), U+2012, U+2013
const NOT_WORD_BEFORE = "(?<![\\w\\u2010-\\u2013'’-])";
const NOT_WORD_AFTER = "(?![\\w\\u2010-\\u2013'’-])";
const CAP = "\u0001";                                  // internal marker: "capitalise the next word"
const MAX_WORDS = 25;                                  // FULL STOPS: past 25 words it becomes two
const MAX_BOLD_WORDS = 6;
const MAX_PAUSES_PER_ANSWER = 4;
const PAUSE_OUT = "[breath]";                          // internal (pause) restores to this on output

// Lower-case tool names that must never be capitalised at a sentence start.
const LOWER_TOOLS = new Set(("npm pip git kubectl curl grep sudo ssh iptables systemd bash zsh yum apt nmap " +
  "openssl regedit gpupdate certutil netsh wmic psexec sysmon").split(" "));

// Abbreviations that end with a period but do not end a sentence.
const ABBR = new Set(["e.g.", "i.e.", "vs.", "etc.", "mr.", "mrs.", "ms.", "dr.", "st.", "no.", "approx.", "inc.",
  "ltd.", "corp.", "jr.", "sr.", "u.s.", "a.m.", "p.m.", "fig.", "cf.", "al.", "dept.", "est."]);

const ITALIC_RE = /(^|[^*\w])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![*\w])/g;
const BOLD_RE = /\*\*([^*\n]+?)\*\*/g;
// perfACT (pause) plus MarketFit [beat]/[breath] and bracket/paren variants.
const PAUSE_ANY = /[([]\s*(?:(?:short|brief|long|small|quick)\s+)?(?:pause|beat|breath)\s*[)\]]/gi;
const LABEL_RE = /^\*\*[A-Za-z][\w '’/&-]{0,30}?(?::\*\*|\*\*:)/;   // "**Situation:**" bullet label

export interface VoiceState { italics: number; pauses: number; paragraphs: number }

/* ------------------------------------------------------------------ small helpers */

function capWord(w: string): string { return w.charAt(0).toUpperCase() + w.slice(1); }

function keepCase(src: string, rep: string): string { return /^[A-Z]/.test(src) ? capWord(rep) : rep; }

function countWords(s: string): number {
  return String(s).replace(/\(pause\)/gi, " ").replace(/\*/g, "").split(/\s+/)
    .filter((t) => /[A-Za-z0-9]/.test(t)).length;
}

// True when `before` (the text preceding a position) ends at a sentence start.
function atSentenceStart(before: string): boolean {
  return /(?:^|[.!?]["”’')\]*]*\s+|\(pause\)\s+)$/.test(before) || /^\s*$/.test(before);
}

// Resolve CAP markers: capitalise the following plain lower-case word, then drop the marker.
function fixCaps(t: string): string {
  if (!t.includes(CAP)) return t;
  return t
    .replace(new RegExp(`${CAP}+\\s*((?:\\(pause\\)\\s*)*(?:\\*\\*|\\*|["“‘(])?)([a-z][a-z'’-]*)(?![A-Za-z0-9])`, "g"),
      (_m, pre: string, w: string) => pre + (LOWER_TOOLS.has(w) ? w : capWord(w)))
    .replace(new RegExp(`${CAP}+\\s*`, "g"), "");
}

// Capitalise the first plain lower-case word of a sentence (never a product like macOS or iPhone).
function capFirst(s: string): string {
  return s.replace(/^(\s*(?:\(pause\)\s*)*(?:\*\*|\*|["“‘(])?)([a-z][a-z'’-]*)(?![A-Za-z0-9])/,
    (_m, pre: string, w: string) => pre + (LOWER_TOOLS.has(w) ? w : capWord(w)));
}

// Whitespace and punctuation left behind by a removal.
function tidy(t: string): string {
  return t
    .replace(/\s{2,}/g, " ")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/\s+([,.;:!?])(?=\s|$|["”’)*])/g, "$1")
    .replace(/,\s*([.;:!?])(?!\.)/g, "$1")
    .replace(/^\s*[,;:]\s*/, "")
    .trim();
}

// a / an before the word that now follows the article.
const WORD_ACRONYMS = new Set(["SIEM", "SOC", "SOAR", "SAML", "SASE", "NIST", "SCIM", "LAPS", "RADIUS", "SOX", "CASB", "PAM", "NAC", "GRC", "CASE"]);
function needsAn(word: string): boolean {
  const w = String(word || "").replace(/^[*“"'‘(]+/, "");
  if (!w) return false;
  if (/^\d/.test(w)) return /^(?:8|11|18)(?!\d)|^8\d/.test(w);
  const tok = w.replace(/[^A-Za-z0-9].*$/, "");
  if (/^[A-Z][A-Z0-9]+s?$/.test(tok)) {
    const base = tok.replace(/s$/, "");
    if (WORD_ACRONYMS.has(base)) return /^[AEIOU]/.test(base);
    return /^[AEFHILMNORSX]/.test(base);
  }
  const l = tok.toLowerCase();
  if (/^(?:u[bcfhjkmnrstv][aeiou]|use|usu|uni|eu|one|once|ubiq)/.test(l)) return false;
  if (/^(?:hour|honest|honou?r|heir)/.test(l)) return true;
  return /^[aeiou]/.test(l);
}
function aOrAn(nextWord: string, art: string): string {
  const base = needsAn(nextWord) ? "an" : "a";
  return /^A/.test(art) ? capWord(base) : base;
}

/* ------------------------------------------------------------------ masks and sentences */

// 1 = position is inside parentheses/brackets, quotes, bold, italic or a version number (never split there).
function maskOf(s: string): Uint8Array {
  const bad = new Uint8Array(s.length + 1);
  const mark = (a: number, b: number) => { for (let k = Math.max(0, a); k < b && k < bad.length; k++) bad[k] = 1; };
  let depth = 0, open = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[") { if (depth === 0) open = i; depth++; }
    else if ((c === ")" || c === "]") && depth > 0) { depth--; if (depth === 0) mark(open, i + 1); }
  }
  if (depth > 0) mark(open, s.length + 1);
  for (const m of s.matchAll(/“[^”]*(?:”|$)|"[^"]*(?:"|$)/g)) mark(m.index ?? 0, (m.index ?? 0) + m[0].length);
  for (const m of s.matchAll(BOLD_RE)) mark(m.index ?? 0, (m.index ?? 0) + m[0].length);
  for (const m of s.matchAll(ITALIC_RE)) mark((m.index ?? 0) + m[1].length, (m.index ?? 0) + m[0].length);
  for (const m of s.matchAll(/\bv?\d+(?:\.\d+)+\b/gi)) mark(m.index ?? 0, (m.index ?? 0) + m[0].length);
  return bad;
}

// Sentence segmentation that respects abbreviations, versions, quotes, parentheses and bold.
function segment(s: string): string[] {
  const bad = maskOf(s), out: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== "." && c !== "!" && c !== "?") continue;
    let j = i + 1;
    while (j < s.length && /["”’')\]*]/.test(s[j])) j++;
    if (j >= s.length || !/\s/.test(s[j]) || bad[j]) continue;
    if (c === ".") {
      let ts = i; while (ts > 0 && !/\s/.test(s[ts - 1])) ts--;
      const tok = s.slice(ts, i + 1).replace(/^[(“"‘*]+/, "").toLowerCase();
      if (ABBR.has(tok)) {
        if (tok !== "etc." || !/^\s+["“(*]*[A-Z]/.test(s.slice(j))) continue;
      } else if (/^[a-hj-z]\.$/.test(tok) && /^[A-Z]\.$/.test(s.slice(ts, i + 1).replace(/^[(“"‘*]+/, ""))) {
        continue;                                           // an initial such as "J. Smith"
      }
    }
    const piece = s.slice(start, j).trim();
    if (piece) out.push(piece);
    let k = j; while (k < s.length && /\s/.test(s[k])) k++;
    start = k; i = k - 1;
  }
  const rest = s.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/* ------------------------------------------------------------------ (a) filled pauses */

const FILL = "(?:u+m+|u+h+m*|e+r+m*|h+m{2,})";   // um, umm, uh, uhm, er, erm, hmm
const FILL_RE = new RegExp(`(\\s*,)?\\s*${NOT_WORD_BEFORE}(${FILL})${NOT_WORD_AFTER}(\\.\\.\\.|…)?(\\s*,)?`, "gi");
const YOUKNOW_RE = new RegExp(`(\\s*,)?\\s*${NOT_WORD_BEFORE}(you know)(\\s*,)`, "gi");

function dropFillers(t: string): string {
  t = t.replace(FILL_RE, (m: string, c1: string, f: string, ell: string, c2: string, idx: number, str: string) => {
    if (f.length > 1 && f === f.toUpperCase()) return m;           // ER, UM: acronyms, not fillers
    const before = str.slice(0, idx), after = str.slice(idx + m.length);
    if (!c1 && /(?:^|[.!?]["”’')\]*]*|\(pause\))\s*$/.test(before)) return (before ? " " : "") + CAP;
    if (/^\s*(?:[.!?]|$)/.test(after)) return "";                    // "... the audit, um."
    if (c1 && c2) return " ";                                         // "I did, um, the rotation"
    if (c1 || c2) return ", ";
    return " ";
  });
  t = t.replace(YOUKNOW_RE, (m: string, c1: string, _yk: string, _c2: string, idx: number, str: string) => {
    const before = str.slice(0, idx);
    if (!c1 && /(?:^|[.!?]["”’')\]*]*|\(pause\))\s*$/.test(before)) return (before ? " " : "") + CAP;
    if (c1 && !/\b(?:as|if|do|did|what|now)\s*$/i.test(before)) return " ";
    return m;                                                         // turn-final "you know" is a wanted marker
  });
  return fixCaps(t);
}

/* ------------------------------------------------------------------ (b) banned phrases and scan words */

const ADV_NEXT = new Set(("and or but so then across for with in on at by from to through within without before after " +
  "while because until as when where which who that is was were are it this i we myself ourselves again too also once " +
  "into over under").split(" "));

function nextWordOf(after: string): string {
  const m = after.match(/^\s+(\S+)/);
  return m ? m[1].replace(/^[*“"'‘(]+/, "") : "";
}

const E2E_RE = new RegExp(`(\\b(?:an?)\\s+)?${NOT_WORD_BEFORE}(from\\s+)?(end(?:${HY}|\\s)to(?:${HY}|\\s)end)${NOT_WORD_AFTER}(,?)`, "gi");
const BIC_RE = new RegExp(`(\\b(?:an?)\\s+)?${NOT_WORD_BEFORE}(best(?:${HY}|\\s)in(?:${HY}|\\s)class)${NOT_WORD_AFTER}`, "gi");

function dropEndToEnd(t: string): string {
  t = t.replace(E2E_RE, (m: string, art: string, from: string, core: string, comma: string, idx: number, str: string) => {
    const before = str.slice(0, idx), after = str.slice(idx + m.length);
    const spaced = !/[-‐-–]/.test(core);
    if (spaced && (/\b(?:back|front|one|other|either|each|high|low|dead|deep|tail|rear|west|east)\s*$/i.test(before + (art || "")) ||
        /^\s*-?users?\b/i.test(after))) return m;                  // "back end to end users" is not the phrase
    const next = nextWordOf(comma ? "" : after);
    if (/^(encrypt|test|latency|delay|monitor|trac|tls|coverage|suite)/i.test(next)) return m;   // "end-to-end encryption / tests / latency" are technical terms
    const start = !art && !from && atSentenceStart(before);
    if (from) return (art || "") + "fully" + comma;                // "traced it from end to end" -> "traced it fully"
    const adjective = !comma && /^\s+[*“"'‘(]*[A-Za-z0-9]/.test(after) && !ADV_NEXT.has(next.toLowerCase().replace(/[^a-z']/g, ""));
    if (adjective) {
      if (art) return aOrAn(next, art.trim()) + " ";
      return start ? CAP : "";
    }
    if (art) return m;                                              // an odd noun use: leave it
    if (/\b(?:is|was|are|were|be|been|being)\s+$/i.test(before)) return m;   // predicate use: no safe rewrite
    if (start) return CAP;                                          // "End-to-end, I owned it" -> "I owned it"
    return "fully" + comma;                                         // trailing adverb
  });
  t = t.replace(BIC_RE, (m: string, art: string, _core: string, idx: number, str: string) => {
    const before = str.slice(0, idx), after = str.slice(idx + m.length);
    const next = nextWordOf(after);
    const adjective = /^\s+[*“"'‘(]*[A-Za-z0-9]/.test(after) && !ADV_NEXT.has(next.toLowerCase().replace(/[^a-z']/g, ""));
    if (!adjective) return m;                                       // predicate use: no safe rewrite
    if (art) return aOrAn(next, art.trim()) + " ";
    return !art && atSentenceStart(before) ? CAP : "";
  });
  return fixCaps(t);
}

function wordSwaps(t: string): string {
  t = t.replace(/\b(leverag)(e|es|ed|ing)\b/gi, (m: string, _stem: string, suf: string, idx: number, str: string) => {
    const s = suf.toLowerCase();
    // bare "leverage" is only rewritten when it is clearly a verb ("to leverage", "we leverage", "can leverage")
    if (s === "e" && !/\b(?:I|we|they|you|to|can|could|will|would|should|must|did|do|does|also|then|always|and|or)\s+(?:\w+ly\s+)?$/i.test(str.slice(0, idx))) return m;
    return keepCase(m, { e: "use", es: "uses", ed: "used", ing: "using" }[s] ?? m);
  });
  t = t.replace(/\bspearhead(s|ed|ing)?\b/gi, (m: string, suf: string) => keepCase(m, { "": "lead", s: "leads", ed: "led", ing: "leading" }[(suf || "").toLowerCase()] ?? m));
  t = t.replace(/\b(work(?:s|ed|ing)?)\s+with\s+(?:all\s+)?(?:the\s+|our\s+)?stakeholders\b/gi, (_m: string, v: string) => `${v} with the application owners`);
  t = t.replace(/\blistened\s+and\s+collaborated\s+with\b/gi, (m: string) => keepCase(m, "worked with"));
  t = t.replace(/\bbusiness\s+stakeholder(s?)\b/gi, (m: string, s: string) => keepCase(m, "business owner" + s));
  t = t.replace(/\bstakeholder(s?)\b/gi, (m: string, s: string) => keepCase(m, "team" + s));
  t = t.replace(/\baligned\s+with\s+((?:the|senior|executive|our)\s+)?leadership\b/gi, (m: string, q: string) => keepCase(m, `got sign-off from ${q || ""}leadership`));
  t = t.replace(/\bimprov(e|es|ed|ing)\s+(?:(?:our|the|their|its|overall|organi[sz]ation['’]s)\s+)*security\s+posture\b/gi,
    (m: string, suf: string) => keepCase(m, `reduc${suf.toLowerCase()} the risk`));
  t = t.replace(/\bensur(e|es|ed|ing)\s+compliance\b/gi,
    (m: string, suf: string) => keepCase(m, `${{ e: "keep", es: "keeps", ed: "kept", ing: "keeping" }[suf.toLowerCase()] ?? suf} it compliant`));
  t = t.replace(/\bvery\s+passionate\s+about\b/gi, (m: string) => keepCase(m, "focused on"));
  return dropEndToEnd(t);
}

const OPENERS = /^(?:(?:first and foremost|so yeah)\s*,?\s+|(?:in summary|in conclusion|to summarize|to summarise|to recap)\s*[,:]?\s+|(?:in short|at the end of the day)\s*[,:]\s*|it(?:['’]s|\s+is)\s+important\s+to\s+note(?:\s+that\s+|\s*[,:]\s*))/i;

function midDrops(t: string): string {
  t = t.replace(/,\s*(?:in short|in summary|in conclusion|to summarize|to summarise|to recap|at the end of the day|first and foremost),\s*/gi, " ");
  t = t.replace(/\b(and|but|so)\s+(?:in short|in summary|in conclusion|to summarize|to summarise|to recap|at the end of the day),\s*/gi, "$1 ");
  t = t.replace(/\bit(?:['’]s|\s+is)\s+important\s+to\s+note\s+that\s+/gi, (m: string, idx: number, str: string) => (atSentenceStart(str.slice(0, idx)) ? CAP : ""));
  t = t.replace(/,?\s+and\s+that['’]s\s+about\s+it(?=\s*[.!]|\s*$)/gi, "");
  return fixCaps(t);
}

/* ------------------------------------------------------------------ (c) habit markers about his own work */

const SUBORD = new Set("when if because since while after before once although though as until unless whenever whereas".split(" "));
const SKIP_ADV = new Set("also then first quickly finally personally just actually later eventually immediately initially next".split(" "));

interface Tok { raw: string; w: string; i: number; end: number }

function tokensOf(s: string, limit = 12): Tok[] {
  const out: Tok[] = [];
  for (const m of s.matchAll(/\S+/g)) {
    const clean = m[0].replace(/^[*“"'‘(]+|[*”"'’),.;:!?]+$/g, "");
    if (/^\(pause\)$/i.test(m[0])) continue;
    out.push({ raw: m[0], w: clean, i: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
    if (out.length >= limit) break;
  }
  return out;
}

interface Subj { pron: string; perfect: boolean; end: number; main: string | null; mainEnd: number }

// The sentence's own subject when it is I / we, found in the first five words and not inside a
// "When I ..." style subordinate opener. Returns null when there is none.
function subjectOf(s: string): Subj | null {
  const toks = tokensOf(s, 14);
  if (!toks.length || SUBORD.has(toks[0].w.toLowerCase())) return null;
  for (let k = 0; k < Math.min(5, toks.length); k++) {
    const w = toks[k].w;
    if (k > 0 && SUBORD.has(w.toLowerCase())) return null;
    if (/^(?:I|we|We)(?:['’]ve)?$/.test(w)) {
      let n = k + 1;
      while (n < toks.length && SKIP_ADV.has(toks[n].w.toLowerCase())) n++;
      const main = n < toks.length ? toks[n] : null;
      return { pron: w[0] === "I" ? "I" : "We", perfect: /ve$/.test(w), end: toks[k].end, main: main && main.w, mainEnd: main ? main.end : toks[k].end };
    }
  }
  return null;
}

function habits(t: string): string {
  // Quoted words belong to someone else ("“I always approve it,” the manager said"): left alone.
  const quoted = (idx: number) => maskOf(t)[idx] && /[“"]/.test(t.slice(0, idx));
  t = t.replace(/\b(I|[Ww]e)((?:['’](?:ve|d|ll|m))?)\s+(?:always|routinely|usually|regularly)\b\s*/g,
    (m: string, p: string, c: string, idx: number) => (quoted(idx) ? m : `${p}${c} `));
  t = t.replace(/\b(I|[Ww]e)\s+(have|had|would|will)\s+(?:always|routinely|usually|regularly)\s+/g,
    (m: string, p: string, v: string, idx: number) => (quoted(idx) ? m : `${p} ${v} `));
  return t;
}

function allTheTime(s: string): string {
  if (!subjectOf(s)) return s;
  return s.replace(/\s*,?\s+all\s+the\s+time(?=\s*[.,!?;:)]|\s*$|\s+(?:and|but|because|so|when|since)\b)/gi,
    (m: string, idx: number, str: string) => (/\b(?:not|never|no)\b|n['’]t\b/i.test(str.slice(0, idx)) ? m : ""));   // "I didn't ... all the time" keeps its meaning
}

/* ------------------------------------------------------------------ sentence-level drops */

function sentenceLevel(seg: string): string {
  const pre = (seg.match(/^(?:\(pause\)\s*)*/) || [""])[0];
  let s = seg.slice(pre.length);
  const keep = () => (pre.trim() ? pre.trim() : "");
  for (let k = 0; k < 4; k++) {
    const before = s;
    if (/^(?:(?:that['’]s|that is|what) a )?great question[.!]*$/i.test(s)) return keep();
    if (/^(?:(?:so|and|yeah|so yeah)[,.]?\s+)?that['’]s about it[.!]*$/i.test(s)) return keep();
    if (/^(?:so\s+)?yeah[.!]*$/i.test(s)) return keep();
    const walk = s.match(/^(?:(?:so|okay|ok|alright|well|now)\s*,?\s+)?let me walk you through\b(.*)$/i);
    if (walk) {
      const cut = walk[1].search(/[:—–]/);
      if (cut < 0) return keep();                                     // a pure signpost sentence: drop it
      s = CAP + walk[1].slice(cut + 1).replace(/^\s+/, "");
    }
    s = s.replace(/^(?:(?:that['’]s|that is|what) a )?great question(?:\s*[,!.—–-]+\s*|\s+)/i, CAP);
    s = s.replace(OPENERS, CAP);
    s = fixCaps(s);
    s = allTheTime(s);
    if (s === before) break;
  }
  s = s.trim();
  if (!countWords(s) && !/\(pause\)/.test(s)) return keep();
  return (pre + s).trim();
}

/* ------------------------------------------------------------------ lexical pass (a, b, c) */

function normPauses(t: string): string { return t.replace(PAUSE_ANY, "(pause)"); }

function lexical(t: string): string {
  let prev: string | null = null;
  for (let k = 0; k < 6 && t !== prev; k++) {
    prev = t;
    t = normPauses(t);
    t = dropFillers(t);
    t = wordSwaps(t);
    t = midDrops(t);
    t = habits(t);
    t = tidy(t);
    t = segment(t).map(sentenceLevel).filter(Boolean).join(" ");
    t = tidy(fixCaps(t));
  }
  return t;
}

/* ------------------------------------------------------------------ (d) FULL STOPS */

const IRREG_PAST = new Set(("ran built wrote led made took got found put kept held brought began drove sent spent told saw chose cut gave " +
  "met paid rebuilt thought understood went did knew left lost shut split won taught caught sought fought bought stood rewrote broke " +
  "froze dug hid hit let meant rode shook sold stuck swept threw tore woke wore fell fed felt fled forgot grew hung laid lent lit " +
  "overrode oversaw redid reran undid upheld withdrew wound sat spoke stole struck swore drew dealt set").split(" "));
const NOT_PAST = new Set(("need feed seed speed breed bleed proceed succeed exceed indeed deed weed reed heed greed steed tweed creed " +
  "bed red shed embed hundred sacred naked wicked kindred rugged ragged jagged crooked beloved based related compared dedicated " +
  "associated located limited supposed advanced experienced skilled varied aged").split(" "));
const DETS = new Set(("the a an this that these those our my their its his her your it them him us me each every all both some any " +
  "no several multiple two three four five six seven eight nine ten how what whether why which where when").split(" "));
const WITH_VERBS = new Set("worked met spoke partnered sat talked checked synced teamed".split(" "));
const CLAUSE_BLOCK = /\b(?:he|she|they|it|you|we|I|who|whom|whose|which|that)\b|\b(?:that|because|since|while|after|before|when|where|if|until|unless|although|though|once|as|whereas)\s+(?:the|a|an|it|they|he|she|we|I|you|this|these|those|our|their|his|her|its|my|there|nobody|someone|everyone)\b|[,;]\s+(?:and|but|or|so|yet)\s+(?:the|a|an|this|that|these|those|our|their|his|her|its|my|there|he|she|they|it|you)\b/i;

function isPast(w: string): boolean {
  w = String(w || "").toLowerCase();
  if (!/^[a-z]+$/.test(w) || NOT_PAST.has(w)) return false;
  return IRREG_PAST.has(w) || /^[a-z]{3,}ed$/.test(w);
}
// A past-tense word outside the shared-subject series ("the analysts escalated") means another
// clause with its own subject sits in between: never split across it.
function hiddenClause(slice: string): boolean {
  const toks = slice.split(/\s+/).filter(Boolean);
  const clean = (x: string) => x.replace(/^[*“"'‘(]+|[*”"'’),.;:!?]+$/g, "");
  for (let k = 1; k < toks.length; k++) {
    if (!isPast(clean(toks[k]))) continue;
    if (/[,;:]["”’)*]*$/.test(toks[k - 1])) continue;
    const p = clean(toks[k - 1]).toLowerCase();
    if (DETS.has(p) || /^(?:and|or|then|also|had|have|has|was|were|been|be|is|are|not|never|just|already|well)$/.test(p) || /ly$/.test(p)) continue;
    return true;
  }
  return false;
}
function followsLikeVerb(verb: string, after: string): boolean {
  const m = after.match(/^\s+(\S+)/);
  if (!m) return false;
  const w = m[1].replace(/^[*“"'‘(]+/, "").replace(/[*”"'’),.;:!?]+$/, "");
  const lw = w.toLowerCase();
  if (/^\d/.test(w)) return true;
  if (DETS.has(lw)) return true;
  return lw === "with" && WITH_VERBS.has(verb.toLowerCase());
}

interface Joint { cut: number; lead: string; rest: string }

// The split tiers, in the Master's order. Each returns candidate joints for a sentence.
function jointCandidates(s: string, tier: number, bad: Uint8Array, subj: Subj | null): Joint[] {
  const out: Joint[] = [];
  const safe = (a: number, b: number) => { for (let k = a; k < b; k++) if (bad[k]) return false; return true; };
  const pron = (p: string) => (p === "I" ? "I" : "We");
  const add = (m: RegExpMatchArray, lead: string, rest: string) => {
    const idx = m.index ?? 0;
    if (safe(idx, idx + m[0].length)) out.push({ cut: idx, lead, rest });
  };
  switch (tier) {
    case 0: for (const m of s.matchAll(/;\s+/g)) {
      const leftSeg = s.slice(0, m.index ?? 0).split(";").pop() ?? "", rightSeg = s.slice((m.index ?? 0) + m[0].length).split(";")[0];
      if (countWords(leftSeg) >= 3 && countWords(rightSeg) >= 3) add(m, "", s.slice((m.index ?? 0) + m[0].length));
    } break;
    case 1: for (const m of s.matchAll(/,\s+and\s+(I|we)(?=['’\s])/g)) add(m, pron(m[1]), s.slice((m.index ?? 0) + m[0].length)); break;
    case 2: for (const m of s.matchAll(/,\s+and\s+then\s+/g)) add(m, "Then ", s.slice((m.index ?? 0) + m[0].length)); break;
    case 3: for (const m of s.matchAll(/,\s+then\s+(I|we)(?=['’\s])/g)) add(m, "Then " + m[1], s.slice((m.index ?? 0) + m[0].length)); break;
    case 4: for (const m of s.matchAll(/,\s+so\s+(I|we)(?=['’\s])/g)) add(m, "So " + m[1], s.slice((m.index ?? 0) + m[0].length)); break;
    case 5: for (const m of s.matchAll(/,\s+but\s+(I|we)(?=['’\s])/g)) add(m, "But " + m[1], s.slice((m.index ?? 0) + m[0].length)); break;
    // Tiers 6-9 go past the Master's list, still at joints where both halves stand as sentences.
    // 6: ", and it / they / he / she / there / you ..." (a subject pronoun opens a new clause)
    case 6: for (const m of s.matchAll(/,\s+(and|but|so)\s+(?=(?:it|they|he|she|there|you)(?:['’][a-z]+)?\s)/g))
      add(m, m[1] === "and" ? "" : capWord(m[1]), s.slice((m.index ?? 0) + m[0].length)); break;
    // 7: ", and the analysts had ..." (a short noun phrase, then an auxiliary: a new clause, not a list item)
    case 7: for (const m of s.matchAll(/,\s+(and|but|so)\s+(?=(?:the|our|my|their|his|her|its|this|these|those|every|each|no|nobody|everyone|someone)\b(?:\s+[^\s,;]+){0,3}?\s+(?:had|has|have|was|were|is|are|did|could|would|will|can|couldn['’]t|wouldn['’]t|didn['’]t|wasn['’]t|weren['’]t|hadn['’]t|never|still)\b)/g))
      add(m, m[1] === "and" ? "" : capWord(m[1]), s.slice((m.index ?? 0) + m[0].length)); break;
    // 8 and 9: shared-subject verbs ("I pulled X, applied Y, and validated Z"). Only when the sentence's
    // own subject is I/we, its main verb is past tense, the next verb is past tense and takes a
    // determiner or number, and no other clause (he / which / "that the") sits in between.
    case 8: case 9: {
      if (!subj || !(isPast(subj.main ?? "") || subj.perfect)) break;
      const re = tier === 8 ? /,?\s+and\s+([a-z]+)(?=\s)/g : /,\s+([a-z]+)(?=\s)/g;
      for (const m of s.matchAll(re)) {
        const idx = m.index ?? 0;
        if (idx < subj.mainEnd || !isPast(m[1])) continue;
        const rest = s.slice(idx + m[0].length);
        if (!followsLikeVerb(m[1], rest)) continue;
        const between = s.slice(subj.end, idx);
        if (CLAUSE_BLOCK.test(between) || hiddenClause(between)) continue;
        add(m, subj.pron + " " + m[1], rest);
      }
      break;
    }
  }
  return out;
}

function splitLong(s: string, depth = 0): string[] {
  if (depth > 12 || countWords(s) <= MAX_WORDS) return [s];
  if (/\?["”’)*]*$/.test(s)) return [s];                      // never split a question
  const firstTok = (s.match(/^[\s*“"'‘(]*([A-Za-z]+)/) || [])[1];
  if (depth === 0 && firstTok && SUBORD.has(firstTok.toLowerCase())) return [s];   // "When the vault failed…, and I…" — splitting orphans the clause
  const bad = maskOf(s), subj = subjectOf(s), total = countWords(s);
  for (let tier = 0; tier < 10; tier++) {
    let best: (Joint & { score: number }) | null = null;
    for (const c of jointCandidates(s, tier, bad, subj)) {
      const wl = countWords(s.slice(0, c.cut)), wr = total - wl;
      if (wl < 3 || wr < 3) continue;
      const score = Math.abs(wl - wr);
      if (!best || score < best.score) best = { ...c, score };
    }
    if (!best) continue;
    let left = s.slice(0, best.cut).replace(/\s+$/, "");
    let right = best.lead ? best.lead + (/^['’]/.test(best.rest) ? "" : " ") + best.rest.replace(/^\s+/, "") : capFirst(best.rest);
    const pauseTail = left.match(/\s*\(pause\)$/);
    if (pauseTail) { left = left.slice(0, pauseTail.index); right = "(pause) " + right; }
    if (!/[.!?]$/.test(left)) left += ".";
    return [...splitLong(left, depth + 1), ...splitLong(right.replace(/\s{2,}/g, " "), depth + 1)];
  }
  return [s];
}

function listLike(body: string): boolean {
  const b = body.replace(LABEL_RE, "").trim().replace(/[.!?]$/, "");
  const segs = b.split(/\s*[;,]\s+/).filter(Boolean);
  if (segs.length < 3) return false;
  return segs.filter((x) => countWords(x) <= 3).length / segs.length >= 0.6;
}

function splitAll(body: string): string {
  let prev: string | null = null, t = body;
  for (let k = 0; k < 6 && t !== prev; k++) {
    prev = t;
    t = segment(t).flatMap((s) => splitLong(s)).join(" ");
    t = lexical(t);
  }
  return t;
}

/* ------------------------------------------------------------------ (e) bold, (f) italic, (g) pause */

function capBold(body: string): string {
  const lab = body.match(LABEL_RE);
  const skipTo = lab && countWords(lab[0]) <= 3 ? lab[0].length : 0;
  let n = 0;
  return body.replace(BOLD_RE, (m: string, inner: string, idx: number) => {
    if (idx < skipTo) return `__${inner.replace(/:$/, "")}__`;
    if (countWords(inner) > MAX_BOLD_WORDS || n >= 4) return inner;
    n++;
    return `__${inner}__`;
  });
}

function capItalic(body: string, state: VoiceState): string {
  const allow = state.paragraphs > 4 ? 2 : 1;
  return body.replace(ITALIC_RE, (m: string, pre: string, inner: string) => {
    if (state.italics < allow) { state.italics++; return m; }
    return pre + inner;
  });
}

function capPauses(body: string, state: VoiceState): string {
  if (!/\(pause\)/.test(body)) return body;
  const sentences = segment(body).filter((x) => countWords(x) > 0).length;
  const cap = sentences > 3 ? 2 : 1;
  let here = 0;
  const out = body.replace(/\s*\(pause\)\s*/g, (m: string, idx: number, str: string) => {
    if (here < cap && state.pauses < MAX_PAUSES_PER_ANSWER) { here++; state.pauses++; return m; }
    return idx === 0 || idx + m.length >= str.length ? "" : " ";
  });
  return tidy(out);
}

/* ------------------------------------------------------------------ exports */

export function voiceState(): VoiceState { return { italics: 0, pauses: 0, paragraphs: 0 }; }

// Repair ONE completed line: a paragraph, a bullet "- ..." or a side heading "## ...".
export function voiceLine(line: string, state: VoiceState = voiceState()): string {
  if (typeof line !== "string") line = String(line ?? "");
  if (!line.trim()) return line;
  const lead = (line.match(/^\s*/) || [""])[0], trail = (line.match(/\s*$/) || [""])[0];
  const core = line.slice(lead.length, line.length - trail.length);

  if (/^#{1,6}\s/.test(core)) {                                     // side heading: word swaps only
    const h = core.match(/^(#{1,6}\s+)([\s\S]*)$/);
    if (!h) return line;
    const swapped = fixCaps(wordSwaps(h[2]));
    const text = swapped === h[2] ? h[2] : tidy(swapped);
    return lead + h[1] + (text || h[2]) + trail;
  }
  if (/^QUESTION\s*:/i.test(core)) return line;                      // the interviewer's words, not his

  const bm = core.match(/^(?:[-•]|\*(?=\s)|\d{1,2}[.)])\s+/);
  const prefix = bm ? bm[0] : "";
  let body = normPauses(core.slice(prefix.length));
  if (!countWords(body) && !/\(pause\)/.test(body)) return line;      // a bare marker or symbol: leave it

  if (/^\(pause\)$/.test(body.trim())) { if (state.pauses >= MAX_PAUSES_PER_ANSWER) return ""; state.pauses++; return lead + prefix + "(pause)" + trail; }

  // inline code, URLs and file paths are not prose: masked so no repair touches them (a *.log glob is not italics)
  const kept: string[] = [];
  body = body.replace(/`[^`]*`|\bhttps?:\/\/[^\s)]*[^\s).,;]|(?:\b[A-Za-z]:)?(?:[\w.-]*[\/\\][\w*?-]+(?:[.\/\\][\w*?-]+)*)|\*\.\w+/g, (m: string) => { kept.push(m); return `⟦${kept.length - 1}⟧`; });
  const unmask = (t: string) => t.replace(/⟦(\d+)⟧/g, (_: string, i: string) => kept[+i]);
  body = lexical(body);
  if (!countWords(body) && !/\(pause\)/.test(body)) return "";       // the whole line was filler
  state.paragraphs++;
  body = capBold(body);
  body = capItalic(body, state);
  if (!(prefix && listLike(body))) body = splitAll(body);
  body = capPauses(body, state);
  return lead + prefix + unmask(tidy(body)) + trail;
}

// Whole-answer pass after streaming: a multi-paragraph answer with no pause gets one.
export function voiceFinish(text: string): string {
  const src = String(text ?? "");
  if (/\(pause\)|\[beat\]|\[breath\]/i.test(src)) return restorePauses(src);
  const lines = src.split("\n");
  const prose: number[] = [];
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t || /^#{1,6}\s/.test(t) || /^(?:[-•]|\*(?=\s)|\d{1,2}[.)])\s+/.test(t) || /^QUESTION\s*:/i.test(t)) return;
    prose.push(i);
  });
  if (prose.length < 2) return restorePauses(src);
  const i = prose[0];
  const m = lines[i].match(/^([\s\S]*?)(\s*)$/);
  if (!m || !/[.!?]$/.test(m[1])) return restorePauses(src);
  lines[i] = m[1] + " (pause)" + m[2];
  return restorePauses(lines.join("\n"));
}

// Convert internal (pause) markers back to MarketFit [breath].
function restorePauses(t: string): string {
  return t.replace(/\(pause\)/gi, PAUSE_OUT);
}

/* ------------------------------------------------------------------ voiceCheck: port of engine.py validate() */

const BANNED = ["worked with stakeholders", "aligned with leadership", "improved security posture",
  "ensured compliance", "leveraged", "listened and collaborated", "spearheaded",
  "end-to-end", "best-in-class", "first and foremost", "so yeah", "that's about it",
  "very passionate", "at the end of the day", "it's important to note", "in summary",
  "in conclusion", "let me walk you through", "great question", "to summarize",
  "in short", "to recap"];

const TECHY = /\b(policy|policies|endpoint|privilege|elevation|allowlist|blocklist|greylist|SIEM|telemetry|remediation|entitlement|RBAC|SSO|OAuth|CPM|EPM|authentication|authorization|configuration|vulnerability|control)\b/i;

// Python rounds exact binary ties to even (round(2.25, 1) == 2.2); JS toFixed rounds them up.
// Detail strings therefore match engine.py character for character.
function pyRound(x: number, d: number): number {
  const s = 10 ** d, q = Math.round(x * s * 2);
  if (Number.isFinite(x) && q % 2 !== 0 && q / (2 * s) === x && (d === 0 || q % 5 === 0)) {
    const m = (q - 1) / 2;
    return (m % 2 === 0 ? m : m + 1) / s;
  }
  return Number(x.toFixed(d));
}
function pyFloat(x: number): string { return Number.isInteger(x) ? x.toFixed(1) : String(x); }

export interface VoiceCheckResult {
  passed: number; total: number;
  fails: string[];
  checks: { ok: boolean; name: string; detail: string }[];
  stats: { words: number; sentences: number; longest: number; shortest: number };
}

export function voiceCheck(text: string, tier = 2): VoiceCheckResult {
  // Plain text: headings and QUESTION lines dropped, bullet markers, ** / * and pauses stripped,
  // curly apostrophes and Unicode hyphens folded so the banned list sees them.
  const lines = String(text ?? "").split(/\r?\n/)
    .filter((l) => !/^\s*#{1,6}\s/.test(l) && !/^\s*QUESTION\s*:/i.test(l))
    .map((l) => l.replace(/^\s*(?:[-•]|\d{1,2}[.)])\s+/, "")
      .replace(PAUSE_ANY, " ").replace(/\*/g, "")
      .replace(/[‘’]/g, "'").replace(/[‐‑‒]/g, "-")
      .replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const answer = lines.join("\n");
  // engine.py sentences(): split after . ! ? — a line break also ends a sentence (a bullet or beat
  // with no final stop would otherwise run into the next line).
  const S = lines.flatMap((l) => l.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean));
  const L = S.map((s) => s.split(/\s+/).filter(Boolean).length);
  const n = answer.split(/\s+/).filter(Boolean).length;
  const checks: { ok: boolean; name: string; detail: string }[] = [];
  const chk = (ok: boolean, name: string, detail: string) => checks.push({ ok: !!ok, name, detail });

  const fp = (answer.match(/\b(um+|uh+|er)\b/gi) || []).length;
  chk(fp === 0, "no filled pauses", `${fp} found`);

  if (L.length >= 2) {
    let adj = 0;
    for (let i = 0; i + 1 < L.length; i++) if (Math.abs(L[i] - L[i + 1]) <= 2) adj++;
    const frac = adj / Math.max(L.length - 1, 1);
    chk(frac <= 0.32, "sentence length variance",
      `${adj}/${L.length - 1} near-equal = ${pyRound(frac * 100, 0)}% (real output 19%, ceiling 32%)`);
    const mx = Math.max(...L), mn = Math.min(...L);
    const ratio = mx / Math.max(mn, 1);
    const need = tier === 1 ? 12 : 6;
    chk(ratio >= need, "long/short ratio", `${mx}/${mn} = ${pyRound(ratio, 1).toFixed(1)}x (need ${need}x; real median 31x)`);
    const longs: number[] = [];
    for (let i = 0; i < L.length - 1; i++) if (L[i] > 30) longs.push(i);
    const shortAfter = longs.filter((i) => L[i + 1] < 12).length;
    chk(!longs.length || shortAfter / longs.length >= 0.5, "recovery after long sentence",
      `${shortAfter}/${longs.length} long sentences followed by a short one (real 62%)`);
  }

  const low = answer.toLowerCase();
  const b = BANNED.filter((x) => low.includes(x.toLowerCase()));
  chk(!b.length, "no banned phrases", b.length ? b.join(", ") : "clean");

  const last = S.length ? S[S.length - 1] : "";
  const lw = last.split(/\s+/).filter(Boolean).length;
  chk(lw <= 25, "landing length", `${lw} words`);
  const lastTechy = TECHY.test(last);
  chk(!lastTechy, "landing is plain language", lastTechy ? "contains jargon" : "clean");

  let run = 0, worst = 0;
  for (const s of S) { if (TECHY.test(s)) { run++; worst = Math.max(worst, run); } else run = 0; }
  chk(worst <= 3, "register mixing", `longest technical run = ${worst} sentences`);

  const mk: Record<string, number> = {};
  for (const m of ["just", "actually", "I mean"]) mk[m] = (answer.match(new RegExp(`\\b${m}\\b`, "gi")) || []).length;
  const per1k: Record<string, number> = {};
  for (const k of Object.keys(mk)) per1k[k] = pyRound(1000 * mk[k] / Math.max(n, 1), 1);
  chk(per1k.just >= 3, "marker density",
    `per 1k: {${Object.keys(per1k).map((k) => `'${k}': ${pyFloat(per1k[k])}`).join(", ")}}`);

  const qs = (answer.match(/\?/g) || []).length;
  chk(n > 120 ? qs >= 1 : true, "self-question present", `${qs} questions in ${n} words`);

  const lastl = last.toLowerCase();
  const weak = ["so ", "in summary", "in short", "to recap", "that's it", "yeah", "basically"].some((w) => lastl.startsWith(w));
  chk(!weak && lw >= 4, "landing is a real close", weak || lw < 4 ? "weak or truncated closer" : "clean");

  const iC = (answer.match(/\bI\b/g) || []).length, wC = (answer.match(/\bwe\b/gi) || []).length;
  chk(iC > 0, "first person ownership", `I=${iC} we=${wC}`);

  const passed = checks.filter((c) => c.ok).length;
  return {
    passed, total: checks.length,
    fails: checks.filter((c) => !c.ok).map((c) => c.name),
    checks,
    stats: { words: n, sentences: S.length, longest: L.length ? Math.max(...L) : 0, shortest: L.length ? Math.min(...L) : 0 },
  };
}

/* ------------------------------------------------------------------ whole-answer convenience */

/**
 * Repair a full answer: voiceLine per line, then voiceFinish for the pause guarantee.
 * Keeps the existing MarketFit export name used by /api/kompas/answer.
 */
export function voiceRepair(text: string): string {
  const src = String(text ?? "");
  if (!src.trim()) return src;
  const state = voiceState();
  const lines = src.split("\n").map((l) => voiceLine(l, state));
  return voiceFinish(lines.join("\n"));
}
