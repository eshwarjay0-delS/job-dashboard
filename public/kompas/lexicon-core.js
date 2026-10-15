// The enterprise vocabulary, as code: which words a role says at work, how each is written, and how to put a recogniser's spelling
// right when it already has the letters. Shared by the page and /api/lexicon through globalThis, like review-core.js.
// The data (lexicon-data.js) was written by one model reader per function, corrected by a second, read aloud, transcribed and scored;
// "hard" marks the terms the recogniser got wrong with no hints. Nothing here calls a model.
//
// What it does not do: it never changes a word into a different word. "service now" becomes ServiceNow because the letters are the
// same; "socks" is only OFFERED as SOX (in `maybe`), because that is a judgement about what was meant.
(function () {
  const squash = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const data = () => globalThis.KompasLexiconData || { version: "none", functions: {}, common: [], measured: null };
  const tokens = (t) => String(t || "").toLowerCase().match(/[a-z0-9]+/g) || [];

  // The functions whose job titles or name share the most words with the role as the user wrote it. "Senior CyberArk Engineer" has no
  // title in common with any list, so the terms themselves are searched too: a role that names a tool belongs where that tool is.
  const STOP = new Set("senior junior lead principal staff head of the and a an i ii iii chief associate assistant manager director vp vice president officer engineer analyst specialist consultant".split(" "));
  function functionsFor(role, max = 3) {
    const want = tokens(role), keys = want.filter(w => !STOP.has(w)), all = data().functions, scored = [];
    for (const [key, f] of Object.entries(all)) {
      let score = 0;
      const titles = (f.roles || []).map(r => tokens(r));
      for (const w of keys) {
        if (titles.some(t => t.includes(w))) score += 3;
        if (tokens(f.name).includes(w)) score += 2;
        if ((f.terms || []).some(t => tokens(t.w).includes(w))) score += 2;
      }
      for (const w of want.filter(x => STOP.has(x) && x.length > 3)) if (titles.some(t => t.includes(w))) score += 0.2;   // "engineer", "analyst": a weak tie-breaker only
      if (score >= 2) scored.push({ key, name: f.name, score: Math.round(score * 10) / 10 });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, max);
  }

  // The short list worth naming to a recogniser for these functions: the terms it got wrong unaided first, then the acronyms and
  // product names. A recogniser's hint space holds about sixty.
  function hints(keys, max = 60) {
    const out = [], seen = new Set(), all = data().functions;
    const take = (pick) => { for (const k of keys) for (const t of ((all[k] || {}).terms || [])) { if (out.length >= max) return; if (pick(t) && !seen.has(t.w)) { seen.add(t.w); out.push(t.w); } } };
    take(t => t.hard); take(t => t.k === "acronym" || t.k === "tool_or_product");
    return out;
  }

  // One index per set of functions: squashed letters -> the written form.
  //  - A term written all in lower case is left out: "to be" and "to-be", "follow up" and "follow-up", "over time" and "overtime" are
  //    different things, and a recogniser is not wrong to write either.
  //  - `common` marks a term that is also an ordinary word ("lever", "star", "swift", "ups"); canonicalize treats those with care.
  const FUNCTION_WORDS = new Set("i a an the to of and or as so on in at it is am be we you my for with by do go up if no not but he she me us our this that".split(" "));
  const cache = new Map();
  function index(keys) {
    const id = keys.slice().sort().join(","); if (cache.has(id)) return cache.get(id);
    const all = data().functions, common = new Set(data().common || []), styled = new Set(data().styled || []), map = new Map(), spoken = new Map();
    for (const k of keys.length ? keys : Object.keys(all)) for (const t of ((all[k] || {}).terms || [])) {
      const q = squash(t.w); if (q.length < 3) continue;
      if (t.w === t.w.toLowerCase()) continue;                                      // a term written all in lower case is never touched (see canonicalize)
      if (styled.has(q)) continue;                                                  // some function writes it in lower case: its capitals are a matter of style
      if (!/^[A-Za-z0-9]/.test(t.w) || !/[A-Za-z0-9)]$/.test(t.w)) continue;        // ".NET", "TeamMate+", "C#": the sign at its edge cannot be told from the letters
      const caps = !/[a-z]/.test(t.w);                                              // acronym-shaped: no lower-case letter in it
      if (!map.has(q)) map.set(q, { w: t.w, caps, common: common.has(q), plain: !!t.p, parts: t.w.split(/\s+/).length });
      else if (map.get(q).w !== t.w) map.get(q).clash = true;                       // two functions write it differently: leave it alone
      const said = String(t.s || "").trim().toLowerCase();                          // a term said as one plain word ("socks" for SOX, "sim" for SIEM)
      if (/^[a-z]{3,}$/.test(said) && said !== q && !spoken.has(said)) spoken.set(said, t.w);
    }
    const built = { map, spoken }; cache.set(id, built); return built;
  }

  // RULE glued: the recogniser hears the article "a" or the pronoun "I" as one more letter of a spelled-out acronym and glues it on:
  // "As ACPA, I research" for "As a CPA, I research", "As COOI sponsor lean" for "As COO I sponsor lean", "as ACRAI conduct" for
  // "as a CRA I conduct". With a role, a token in capitals that nothing else matched and that is "A" + an acronym of the role, or an
  // acronym of the role + "I", or both, is split back into its words. No letter changes; only the spaces come back.
  // Each condition closes a wrong split (found by listing every string the vocabulary lets the rule split and reading it for real words).
  const GLUE_A = /^[BCDGJKPQTUVWYZ]$/;                                             // "a CPA" but "an SLA": only a letter whose name starts with a consonant takes "a" (an SLA is heard as "NSLA", never "ASLA")
  const GLUE_AS = new Set(["as", "being"]), GLUE_ART = new Set(["a", "an", "the"]);
  const GLUE_BEFORE_A = new Set("as being am is was be been become became with from in into on to for by of at via through like than without".split(" "));
  const GLUE_NOT_AFTER_I = new Set("a an the this that these those my our your his her their its of in on at to for with by from as into than and or but so if because when while which who what where it he she we they you me us them not no there here is are were be been being has does".split(" "));
  let glue = null;
  function glueData() {
    const d = data(); if (glue && glue.d === d) return glue;
    const known = new Set([...(d.common || []), ...(d.styled || [])]), a = new Map();
    for (const f of Object.values(d.functions)) for (const t of (f.terms || [])) {
      const q = squash(t.w); known.add(q);                                          // a term of ANY function, in any case
      for (const p of t.w.split(/\s+/)) if (!/[a-z]/.test(p)) known.add(squash(p)); // and a word in capitals inside one: "ASC" in "ASC 606", "AD" in "AD FS"
      a.set(q, a.get(q) !== false && GLUE_A.test(String(t.s || "").trim().split(/\s+/)[0]));   // spelled out letter by letter, by every function that has it
    }
    return (glue = { d, known, a });
  }
  // -> { from, to, pre, post } or null. `core` and `map` are canonicalize's own.
  function unglue(words, i, map, core) {
    const c = core(words[i]), mid = c.mid, A = mid[0] === "A", I = mid[mid.length - 1] === "I";
    if (mid.length < 4 || !(A || I) || /[a-z]/.test(mid)) return null;              // capitals only: "acid", "Semi" and "Ajit" are words
    const q = squash(mid), g = glueData(); if (g.known.has(q)) return null;         // itself a term somewhere: ASAP is not "a SAP", APR is not "a PR", API is not "AP I", CMMI is not "CMM I"
    // an acronym of the role, one word, three letters or more (the index drops shorter ones: AVP is not "a VP", KPI is not "KP I")
    const acr = (s) => { const h = map.get(s); return h && h.caps && !h.clash && h.parts === 1 ? h.w : null; };
    const read = [];
    if (A && acr(q.slice(1)) && g.a.get(q.slice(1))) read.push({ w: acr(q.slice(1)), a: true, i: false });   // "AFAR" is not "a FAR", "ASUS" is not "a SUS": an acronym said as a word is not a run of letters for "a" to join
    if (I && acr(q.slice(0, -1))) read.push({ w: acr(q.slice(0, -1)), a: false, i: true });
    if (A && I && acr(q.slice(1, -1)) && g.a.get(q.slice(1, -1))) read.push({ w: acr(q.slice(1, -1)), a: true, i: true });
    if (read.length !== 1) return null;                                             // "ACOI" is "a COI" or "ACO I": two readings, so neither
    const r = read[0], at = (j) => (j >= 0 && j < words.length ? core(words[j]) : null), p = at(i - 1), p2 = at(i - 2), n = at(i + 1);
    const plain = (x) => (x && !x.post && /^[A-Z]?[a-z]+$/.test(x.mid) ? x.mid.toLowerCase() : "");   // a neighbour in ordinary case with no stop after it; in a line all in capitals ("BE ABLE TO") capitals mean nothing
    const pw = plain(p), pw2 = plain(p2);
    if (r.a) {
      // the article needs a word before it that takes one: "this ACPI", "the ACES" and a sentence opening with the token are left alone
      const verb = pw && !FUNCTION_WORDS.has(pw) && p.mid === pw && p2 && !p2.post && /^(I|we)$/i.test(p2.mid);   // "I write APR-FAQ": the word after "I" is its verb
      if (c.pre || !(r.i ? GLUE_AS.has(pw) : GLUE_BEFORE_A.has(pw) || verb)) return null;
    }
    if (r.i) {
      // "As COO I sponsor": the pronoun needs the title before it and its verb after it
      if (!r.a && !(GLUE_AS.has(pw) || (GLUE_ART.has(pw) && GLUE_AS.has(pw2)))) return null;                  // "the IMSI attached to the SIM" is not "the IMS I attached": outside "As ...", a name ending in I cannot be told from the pronoun
      if (c.post || !n || n.pre || n.post || !/^[a-z]{2,}$/.test(n.mid)) return null;                          // "As a CACI employee, I ran": a noun before a comma is not a verb
      if (GLUE_NOT_AFTER_I.has(n.mid) || /[^s]s$/.test(n.mid)) return null;                                    // "as MAUI supports", "as ANSI standards": a verb or noun in -s does not follow "I"
      for (let j = i + 2; j < words.length; j++) { const x = core(words[j]); if (/^I('|$)/.test(x.mid)) return null; if (x.post) break; }   // "As a CACI employee I ran": the clause already has its "I"
    }
    return { from: mid, to: (r.a ? "a " : "") + r.w + (r.i ? " I" : ""), pre: c.pre, post: c.post };
  }
  // END RULE glued
  // RULE styled: a term written with a hyphen, a slash or an ampersand inside it ("record-to-report", "go/no-go decision", "M&A").
  // The recogniser has the words and writes them with spaces, or joins them with another sign ("go-no-go"); with a role given, the
  // vocabulary's sign goes back when the words are the same words in the same order. Words are matched one by one, never as squashed
  // letters, so nothing is joined or split ("over time" cannot become "overtime"), and the lower-case terms index() drops are reached.
  // What stays protected is in the guards below; each closes a wrong correction that was seen or that the vocabulary itself shows.
  const SIGN = /[A-Za-z0-9][-\/&]+[A-Za-z0-9]/, signWords = (t) => String(t).toLowerCase().replace(/&/g, " and ").match(/[a-z0-9]+/g) || [];
  const styledCache = new Map(); let styledKeys = null, styledNow = null, spaced = null;
  function styledIndex(keys) {
    if (keys === styledKeys) return styledNow;                                      // the same call of canonicalize: no lookup at all
    const id = keys.slice().sort().join(","), all = data().functions; let built = styledCache.get(id);
    if (!built) {
      if (!spaced) { spaced = new Set(); for (const f of Object.values(all)) for (const t of (f.terms || [])) if (!SIGN.test(t.w)) spaced.add(signWords(t.w).join(" ")); }
      const map = new Map(), heads = new Set();
      for (const k of keys) for (const t of ((all[k] || {}).terms || [])) {
        if (!SIGN.test(t.w)) continue;
        const toks = signWords(t.w), key = toks.join(" "), fw = (x) => FUNCTION_WORDS.has(x);
        if (spaced.has(key)) continue;                                              // some function writes the same words with plain spaces ("procure to pay", "year over year"): the hyphens are a matter of style
        let open = toks.length >= 3 || (t.w.includes("/") && !toks.some(fw));       // "to be" is not to-be, "follow up" is not follow-up, "I am on call" is not on-call: two words keep their spaces, unless a slash pairs two names ("lockout/tagout")
        if (t.w.split(/\s+/).some(p => SIGN.test(p) && signWords(p).every(fw))) open = false;   // "it has to be process driven" is not "to-be process": a group made only of function words is ordinary grammar
        if (!/[\s\/]/.test(t.w) && t.k !== "process_or_activity") open = false;     // "we made it just in time" is not just-in-time, "careful not to exceed it" is not not-to-exceed: a compound with no word beside it is restored only as the name of a process ("record-to-report"); with one it is safe ("just-in-time access")
        if (!map.has(key)) map.set(key, { w: t.w, parts: t.w.split(/\s+/).length, open, and: t.w.includes("&") ? t.w.replace(/&/g, " and ") : null });
        else if (map.get(key).w !== t.w) map.get(key).clash = true;                 // "P-card" and "P-Card": two functions write it differently, leave it alone
        heads.add(toks[0]);
      }
      built = { map, heads }; styledCache.set(id, built);
    }
    styledKeys = keys; styledNow = built; return built;
  }
  // The words of a span (`inner`, `n` of them as written) -> the form to write, or null to leave them.
  function styledForm(keys, inner, n, starts) {
    const { map, heads } = styledIndex(keys), head = /^[A-Za-z0-9]+/.exec(inner);
    if (!head || !heads.has(head[0].toLowerCase())) return null;                    // no term of these functions starts with this word (the usual case, kept cheap)
    if (!/[A-Za-z0-9]$/.test(inner) || /[^A-Za-z0-9 '&\/-]/.test(inner)) return null;   // a quotation mark or a bracket inside the span: not the bare words, and writing over it would swallow the mark
    const e = map.get(signWords(inner).join(" ")); if (!e || e.clash) return null;
    if (inner.toLowerCase() === e.w.toLowerCase()) return null;                     // "Record-to-Report" in a heading: the signs are already there and capitals are style
    if (e.and) { if (inner.replace(/ ?& ?/g, " and ") !== e.and) return null; }     // "M and A" is M&A, but "the MD and a partner" is not MD&A: beside "and" the letters must be the capitals the term has
    else if (n > e.parts && !e.open) return null;                                   // spaces where the vocabulary has a sign: only for the terms found safe above ("go-no-go" for go/no-go needs no such care, it is already joined)
    const keep = /^[a-z]/.test(e.w) && /^[A-Z]/.test(inner) && (starts || inner.slice(1) === inner.slice(1).toLowerCase());
    return keep ? e.w[0].toUpperCase() + e.w.slice(1) : e.w;                        // "Month end close is mine." keeps its capital: the start of a sentence is not lowered
  }
  // END RULE styled
  // RULE nearmiss: for a name it does not know, the recogniser invents a spelling that is no word at all ("Kiriba" for Kyriba,
  // "Saviant" for Saviynt, "NAGOHS" for Nagios). With a role given, such a token is put right when exactly ONE term of the role's
  // functions sounds the same: the same consonants in the same order, and all but a letter or two the same. This is the only rule
  // that changes letters, so every line of it is a refusal; it returns the written form, or null.
  const NEAR_KINDS = new Set(["tool_or_product", "framework_or_standard", "acronym"]), nearCache = new Map(); let nearKnown = null;
  // The consonants a word is heard by: "ght" is t, c is k or s, a doubled letter is one, vowels (and h, w, y) after the first letter go.
  const skeleton = (q) => { const s = q.replace(/ght/g, "t").replace(/ph/g, "f").replace(/c(?=[eiy])/g, "s").replace(/[cq]/g, "k").replace(/x/g, "ks").replace(/z/g, "s"); return ((/^[aeiouy]/.test(s) ? "a" : s[0]) + s.slice(1).replace(/[aeiouyhw]/g, "")).replace(/(.)\1+/g, "$1"); };
  const edits = (a, b) => { let prev = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[b.length]; };
  function nearIndex(keys) {
    const id = keys.slice().sort().join(","); if (nearCache.has(id)) return nearCache.get(id);
    const all = data().functions, { map } = index(keys), by = new Map();
    if (!nearKnown) {                                                               // every word the vocabulary itself uses, in any function: a token that is one of these is a word, not an invention
      nearKnown = new Set(data().common || []);
      for (const f of Object.values(all)) { for (const w of tokens(f.name + " " + (f.roles || []).join(" "))) nearKnown.add(w); for (const t of (f.terms || [])) { nearKnown.add(squash(t.w)); for (const w of tokens(t.w)) nearKnown.add(w); } }
    }
    for (const k of keys) for (const t of ((all[k] || {}).terms || [])) {
      const q = squash(t.w); if (!/^[A-Za-z]+$/.test(t.w) || q.length < 5) continue;                  // one word of letters, five or more
      const sk = skeleton(q), hit = map.get(q), list = by.get(sk) || []; by.set(sk, list);
      // a rival of any kind is kept (it makes the token ambiguous); only a product, standard or acronym with one settled written form may be the answer
      const ok = NEAR_KINDS.has(t.k) && !!hit && !hit.clash && hit.w === t.w && !hit.plain, old = list.find(x => x.q === q);
      if (old) old.ok = old.ok && ok; else list.push({ q, w: t.w, ok, common: !!hit && hit.common });
    }
    nearCache.set(id, by); return by;
  }
  function nearmiss(mid, keys, beside) {
    if (!beside || !/^[A-Z][A-Za-z]{5,}$/.test(mid)) return null;                   // "octa", "flizer": a token in lower case may be any ordinary word; nor a short one, a number, or the first word of a sentence
    if (!beside.some(w => /^[^A-Za-z]*[a-z]/.test(w || ""))) return null;             // a shouted or Title Case run: its capitals say nothing
    const q = mid.toLowerCase(), list = nearIndex(keys).get(skeleton(q)); if (!list || nearKnown.has(q)) return null;
    const odd = /[A-Z]/.test(mid.slice(1)), max = !odd ? 1 : q.length >= 9 ? 3 : 2;   // "Boston" is shaped like a name, so one letter only; "PlayWrite" and "KOHBIT" are shaped like nothing else
    const close = list.filter(x => Math.abs(x.q.length - q.length) <= 2 && edits(q, x.q) <= max);
    if (close.length !== 1 || !close[0].ok) return null;                            // two terms as near as each other ("Jagger": Jaeger or Jaggaer), or the near one is a concept in lower case
    if (close[0].common && !odd) return null;                                       // "Decker" is not Docker: beside an ordinary-word term, a name-shaped token is more likely a name
    return close[0].w;
  }
  // end RULE nearmiss

  // text -> { text, changes: [{ from, to, n }], maybe: [{ from, to, n }] }. `keys` are function keys; with none, every function is used
  // for the letter-identical corrections and nothing is offered in `maybe` (an offer needs a role to make sense of it).
  function canonicalize(text, keys = []) {
    const { map, spoken } = index(keys), src = String(text || "");
    const parts = src.split(/(\s+)/), words = [], at = [];                         // words and the gaps between them, so the spacing survives
    parts.forEach((p, i) => { if (i % 2 === 0 && p) { words.push(p); at.push(i); } });
    const core = (w) => { const m = /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/.exec(w); return { pre: m[1], mid: m[2], post: m[3] }; };
    const changes = new Map(), maybe = new Map(), note = (m, from, to) => { const k = from + "\u0000" + to; m.set(k, (m.get(k) || 0) + 1); };
    const startsSentence = (i) => i === 0 || /[.!?]["')\]]*$/.test(words[i - 1]);
    for (let i = 0; i < words.length; i++) {
      let done = false;
      for (let n = Math.min(5, words.length - i); n >= 1 && !done; n--) {
        const span = words.slice(i, i + n), first = core(span[0]), last = core(span[n - 1]);
        if (n > 1 && span.slice(0, -1).some(w => /[.!?,;:]$/.test(w))) continue;    // a phrase does not run across punctuation
        const inner = n === 1 ? first.mid : [first.mid, ...span.slice(1, -1), last.mid].join(" ");
        const sf = keys.length ? styledForm(keys, inner, n, startsSentence(i)) : null;                // RULE styled (call site): needs a role, like every join
        if (sf) { note(changes, inner, sf); parts[at[i]] = first.pre + sf + (n === 1 ? first.post : last.post); for (let k = 1; k < n; k++) { parts[at[i + k]] = ""; parts[at[i + k] - 1] = ""; } i += n - 1; done = true; continue; }
        const hit = map.get(squash(inner)); if (!hit || hit.clash) continue;
        const to = hit.w; if (inner === to) continue;
        // The rules below were set by running the corrector over text that is already right (1,903 written sentences) and over
        // 249,000 words of real answers, and reading every change it made. Each one closes a wrong correction seen there.
        const toks = inner.split(" "), ups = (inner.match(/[A-Z]/g) || []).length;
        if (hit.caps) {
          // an acronym: "As a" is not ASA, "I am" is not IAM, "IDs" is not IDS, "ups" is not UPS
          if (n > 1 && !toks.every(t => /^[A-Z0-9]+$/.test(t) || /^[A-Za-z]$/.test(t))) continue;   // several words join into an acronym only when each is capitals or one letter ("CI CD", "P V W A")
          if (n > 1 && toks.some(t => FUNCTION_WORDS.has(t.toLowerCase()))) continue;               // "AM I" is not AMI: a word is not a letter
          if (n === 1 && /^[A-Z0-9]+s$/.test(inner)) continue;                                      // a plural: IDs, VMs, KPIs
          if (n === 1 && hit.common && ups < 2) continue;                                           // an ordinary word, however it is capitalised: star, fair, art, ups
        } else {
          // a name with mixed capitals: "I manage" is not iManage, "to tango" is not Totango, "lever" is not Lever
          if (hit.plain && n === hit.parts) continue;                                               // "product owner" / "Product Owner": capitals on ordinary words are style, not an error
          if (n !== hit.parts && !keys.length) continue;                                            // a join ("good time" to GoodTime) needs a role that makes the product likely
          if (n !== hit.parts && toks.some(t => FUNCTION_WORDS.has(t.toLowerCase()))) continue;     // a join or a split never swallows a function word
          if (n === 1 && hit.parts === 1 && hit.common && inner === inner.toLowerCase()) continue;  // an ordinary word in lower case
          if (n === 1 && inner.includes("-") && !to.includes("-")) continue;                        // "X-ray" is not Xray: a hyphenated word is its own word
        }
        note(changes, inner, to);
        parts[at[i]] = first.pre + to + (n === 1 ? first.post : last.post);
        for (let k = 1; k < n; k++) { parts[at[i + k]] = ""; parts[at[i + k] - 1] = ""; }
        i += n - 1; done = true;
      }
      if (done || !keys.length) continue;
      const split = unglue(words, i, map, core);                                    // RULE glued: "ACPA" -> "a CPA", "COOI" -> "COO I"
      if (split) { note(changes, split.from, split.to); parts[at[i]] = split.pre + split.to + split.post; continue; }
      const c = core(words[i]), offer = spoken.get(squash(c.mid));                  // said as a word ("socks"): offered, never applied
      const fix = nearmiss(c.mid, keys, startsSentence(i) || /\n/.test(parts[at[i] - 1]) ? null : [words[i - 1], words[i + 1]]);   // RULE nearmiss: its one call
      // Is another term of the same functions within fifteen words? Asked by the two rules that judge what was MEANT.
      const beside = () => { for (let j = Math.max(0, i - 15); j < Math.min(words.length, i + 16); j++) { if (j === i) continue; const h = map.get(squash(core(words[j]).mid)); if (h && !h.common) return true; } return false; };
      // nearmiss changes letters, so the neighbourhood has to be talking about the role's tools: "the migration from Tatango to Gainsight" is
      // Totango, and "I'll provide the detailed feedback to Kabana" is a person, not Kibana (both from real interview transcripts; the second
      // was a wrong correction this condition closes).
      if (fix && beside()) { note(changes, c.mid, fix); parts[at[i]] = c.pre + fix + c.post; continue; }
      if (offer && c.mid && c.mid.toLowerCase() === c.mid && beside()) note(maybe, c.mid, offer);   // said as a word ("socks"): only beside another term of the same functions
    }
    const list = (m) => [...m.entries()].map(([k, n]) => { const [from, to] = k.split("\u0000"); return { from, to, n }; }).sort((a, b) => b.n - a.n);
    return { text: parts.join(""), changes: list(changes), maybe: list(maybe) };
  }

  globalThis.KompasLexicon = { squash, functionsFor, hints, canonicalize, version: () => data().version, measured: () => data().measured,
    functions: () => Object.entries(data().functions).map(([key, f]) => ({ key, name: f.name, roles: (f.roles || []).length, terms: (f.terms || []).length, hard: (f.terms || []).filter(t => t.hard).length })) };
})();
