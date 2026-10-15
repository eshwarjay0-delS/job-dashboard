/* After the two anchors are chosen, a recorded mistake is removed before the text is shown.
   Opening fillers, a trail-off ending, and a Situation / Task / Action / Result label do not survive.
   The remaining sentences stay. This does not call a model and does not add a side heading. */
(() => {
  const OPEN = /^(?:(?:yeah|yes|ok|okay|uh|um)[,.]?\s+)+(?:(?:so|like|uh|um)[,.]?\s+)*/i;
  const TRAIL = /[,.]?\s*(?:so yeah|uh,?\s*yeah|and,?\s*uh|you know|like that)\s*[.!]?\s*$/i;
  const LABEL = /\b(Situation|Task|Action|Result)\s*:\s*/gi;

  function correct(text) {
    let t = String(text || "").replace(/^\s*#{1,6}\s+.*$/gm, "");
    t = t.replace(LABEL, "");
    let prev;
    do { prev = t; t = t.replace(OPEN, ""); } while (t !== prev);
    t = t.replace(TRAIL, "");
    t = t.replace(/\s{2,}/g, " ").replace(/\s+([.!?])/g, "$1").trim();
    t = t.replace(/^([a-z])/, (m, c) => c.toUpperCase());
    if (t && !/[.!?]$/.test(t)) t += ".";
    return asSpeaker(t);
  }

  // He is rehearsing as himself. A line that talks about him by name is something he would never say.
  const NOT_A_VERB = new Set("platforms years systems credentials alerts banks engineers services accounts sessions logs rules tokens hosts groups users threats controls frameworks dashboards pipelines processes products companies environments incidents detections responses identities analysis operations technologies applications organizations solutions experiences responsibilities certifications".split(" "));
  function dropPerson(verb) {
    const v = String(verb || "");
    const l = v.toLowerCase();
    if (l === "is") return "am";
    if (l === "has") return "have";
    if (l === "does") return "do";
    if (NOT_A_VERB.has(l)) return v;
    if (/(?:us|is|os|as)$/i.test(v)) return v;   // "I focus" ends in -s but is not third person ("I focu on", 5 Oct)
    if (/ies$/i.test(v) && v.length > 4) return v.slice(0, -3) + "y";
    if (/s$/i.test(v) && !/ss$/i.test(v) && v.length > 3) return v.slice(0, -1);
    return v;
  }
  function asSpeaker(text, name) {
    let t = String(text || "");
    const hinted = (t.match(/\b([A-Z][a-z]{2,})\s+currently\b/) || [])[1];
    const who = String(name || globalThis.__speakerName || hinted || "").trim();
    if (who && who !== "I") {
      const re = new RegExp("\\b" + who.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
      t = t.replace(re, "I");
    }
    t = t.replace(/\bI(?:\s+currently)?\s+([A-Za-z]+)/g, (m, v) => m.slice(0, m.length - v.length) + dropPerson(v));
    t = t.replace(/\b(I\b[^.!?]{0,500}?)\band\s+([a-z]{4,}s)\b/g, (m, left, v) => {
      const next = dropPerson(v);
      return next === v ? m : left + "and " + next;
    });
    // Only the first sentence can change. Splitting the whole text and joining it with spaces flattened every
    // bullet into one line, so the stack repair below never saw a stack.
    const first = (t.match(/^[^.!?]*[.!?]/) || [t])[0];
    if (first && !/\b(I|I'm|I’ve)\b/.test(first) && !/\b(is|am|are|was|were|have|has|currently)\b/i.test(first)
      && /(?<![\p{L}\p{M}\p{N}])(?:engineer|analyst|architect|developer|manager|director|lead)(?![\p{L}\p{M}\p{N}])/iu.test(first)
      && !/^\s*(?:the|this|that|these|those|a|an|it|its|we|our|my|each|every)\s/i.test(first) && first.split(/\s+/).length >= 4) {   // "I'm a The architecture…" (5 Oct)
      t = "I'm a " + first.trim().replace(/\.$/, "") + "." + t.slice(first.length);
    }
    return t;
  }

  // A stack of short "I …" lines is slow to say. Neighbours that are one action become one line.
  // Every line after the first opens with So, And, Like, Then, or But — the connector is the first word.
  const CONNECTOR = /^(?:so|and|like|then|but)\b/i;
  const BULLET = /^(?:[-•*]|\d+[.)])\s+/;
  const STOP = new Set("with that this from have were been they them their your into over about after before would could should there where when what which while through other than just also only some more most very like".split(" "));

  function cleanItem(s) {
    let t = String(s || "").replace(BULLET, "").replace(LABEL, "").trim();
    let prev;
    do { prev = t; t = t.replace(OPEN, ""); } while (t !== prev);
    return t.replace(TRAIL, "").replace(/\s+/g, " ").trim();
  }
  const wordsOf = (s) => (String(s).match(/\S+/g) || []);
  const content = (s) => (String(s).toLowerCase().match(/[a-z][a-z0-9]{3,}/g) || []).filter(w => !STOP.has(w));
  function sameAction(a, b) {
    if (wordsOf(a).length > 22 || wordsOf(b).length > 22) return false;
    const A = new Set(content(a));
    return content(b).some(w => A.has(w));
  }
  function itemsFrom(text) {
    const src = String(text || "").replace(/^\s*#{1,6}\s+.*$/gm, "").trim();
    if (!src || src.includes("```")) return null;
    const lines = src.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const bullets = lines.filter(l => BULLET.test(l));
    // A written answer is prose. Only a real bullet stack is said as connected lines.
    // Treating short sentences as bullets glued "and The engineer" onto the line before it.
    if (bullets.length >= 2 && bullets.length >= lines.length - 1) return bullets.map(cleanItem).filter(Boolean);
    return null;
  }
  function clause(s) {
    return cleanItem(s).replace(CONNECTOR, "").replace(/^[,\s]+/, "").replace(/[.!?]+$/, "").trim();
  }
  function combine(group) {
    const parts = group.map(clause).filter(Boolean);
    if (parts.length <= 1) return parts[0] || "";
    const rest = parts.slice(1).map(p => {
      const x = p.replace(/^I\s+/, "");
      return x ? x.charAt(0).toLowerCase() + x.slice(1) : x;
    });
    if (rest.length === 1) return parts[0] + " and " + rest[0];
    return parts[0] + ", " + rest.slice(0, -1).join(", ") + ", and " + rest[rest.length - 1];
  }
  function linkWord(text, n) {
    const t = clause(text);
    if (/\b(worried|concern|however|instead|although)\b/i.test(t) || /^but\b/i.test(t)) return "But";
    if (/\b(then|next|afterwards)\b/i.test(t) || /\bafter that\b/i.test(t)) return "Then";
    if (/\b(for example|such as|for instance)\b/i.test(t)) return "Like";
    if (/\b(so that|because|therefore|crucial|shifted)\b/i.test(t)) return "So";
    return n % 2 === 0 ? "And" : "So";
  }
  function keepI(s) {
    return s.replace(/\bi\b/g, "I");
  }
  function openWith(word, body) {
    const bare = body.replace(CONNECTOR, "").replace(/^[,\s]+/, "").trim();
    const tail = /^I\b/.test(bare) ? bare : bare.charAt(0).toLowerCase() + bare.slice(1);
    return keepI(word + " " + tail);
  }
  function finish(s) {
    let t = keepI(String(s || "").replace(/\s+/g, " ").trim());
    if (t && !/[.!?]$/.test(t)) t += ".";
    return t;
  }

  function speak(text) {
    const items = itemsFrom(text);
    if (!items || items.length < 2) return String(text || "");
    const groups = [];
    let cur = [];
    for (const item of items) {
      if (cur.length && cur.length < 4 && sameAction(cur[cur.length - 1], item)) cur.push(item);
      else { if (cur.length) groups.push(cur); cur = [item]; }
    }
    if (cur.length) groups.push(cur);
    let n = 0;
    return groups.map((g, i) => {
      const merged = finish(combine(g));
      if (!merged) return "";
      if (i === 0) return "- " + merged.replace(CONNECTOR, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()).replace(/^([a-z])/, (c) => c.toUpperCase());
      const existing = g.length === 1 && CONNECTOR.exec(cleanItem(g[0]));
      const line = existing ? finish(cleanItem(g[0]).replace(CONNECTOR, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())) : openWith(linkWord(g[0], n++), merged);
      return "- " + line;
    }).filter(Boolean).join("\n");
  }

  // The critic's recorded faults, applied after an anchor is written. A stack is said as one person.
  // This does not rewrite the answer prompt and does not add a side heading.
  function contentWords(q) {
    return (String(q || "").toLowerCase().match(/[a-z]{5,}/g) || []).filter(w => !/^(about|would|could|should|there|where|which|their|these|those)$/.test(w));
  }
  // An answer that misses the question leads with the sentence that actually answers it. Nothing is invented.
  function leadWithMatch(text, question) {
    const keys = contentWords(question);
    if (!keys.length) return text;
    const hits = (s) => keys.some(w => s.toLowerCase().includes(w));
    const parts = String(text || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
    const bullets = parts.filter(s => BULLET.test(s));
    const units = bullets.length >= 2 ? bullets : String(text || "").replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    if (units.length < 2 || hits(units[0])) return text;
    const i = units.findIndex(hits);
    if (i <= 0) return text;
    const next = [units[i], ...units.slice(0, i), ...units.slice(i + 1)];
    return bullets.length >= 2 ? next.join("\n") : next.join(" ");
  }

  // A design question told as finished work becomes the plan it should have been: "I designed" -> "I would design".
  // A sentence with real proof (an employer, a year, "in my last role") stays in the past. Nothing is added.
  function asDesign(text) {
    const J = globalThis.KompasJev;
    if (!J || !J.PAST_CLAIM) return text;
    const verbs = [...Object.keys(J.BASE), ...Object.keys(J.IRREGULAR || {})].sort((a, b) => b.length - a.length).join("|").replace(/ /g, "\\s+");
    // A later "-ed" word is a verb only when an object follows it: "and confirmed the alerts", not "and related tools".
    const later = new RegExp(`(\\b(?:and|then|or)\\s+|,\\s+(?:then\\s+)?)((?:${verbs})(?![\\w-])|[a-z]{3,}ed(?=\\s+(?:the|a|an|it|them|my|our|its|their|this|that|those|these|every|each|all|both)\\b))`, "g");
    const base = (v) => J.baseOf ? J.baseOf(v) : (J.BASE[v.toLowerCase().replace(/\s+/g, " ")] || v);
    return String(text || "").split("\n").map(line => line.split(/(?<=[.!?])(\s+)/).map(s => {
      if (J.PROOF.test(s)) return s;
      if (!J.PAST_CLAIM.test(s)) return /\b(?:I|[Ww]e) would\b/.test(s) ? s.replace(later, (x, link, v) => link + base(v)) : s;
      const m = s.match(J.PAST_CLAIM);
      const head = s.slice(0, m.index) + m[1] + " would " + (m[2] || "") + base(m[3]);
      const tail = s.slice(m.index + m[0].length).replace(later, (x, link, v) => link + base(v));
      return head + tail;
    }).join("")).join("\n");
  }
  // A sentence that ranks speed above the requirement the question set is removed, never rewritten into a new claim.
  function dropRuleBreaks(text, question) {
    const J = globalThis.KompasJev;
    if (!J || !J.ruleBroken) return text;
    const bad = new Set(J.ruleBroken(text, question));
    if (!bad.size) return text;
    const out = String(text || "").split("\n").map(line => line.split(/(?<=[.!?])\s+/).filter(s => !bad.has(s.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim())).join(" "));
    const kept = out.filter(l => l.trim() && !/^\s*(?:[-•*]|\d+[.)])\s*$/.test(l));
    return kept.join("\n").trim() ? kept.join("\n") : text;
  }

  function applyCritic(text, notes, question) {
    const ids = new Set();
    for (const n of notes || []) for (const id of (n && n.faults) || []) ids.add(id);
    if (globalThis.KompasJev && globalThis.KompasJev.faults) {
      for (const f of globalThis.KompasJev.faults(text, question || "")) ids.add(f.id);
    }
    let t = correct(text);
    if (ids.has("heading")) t = t.replace(/^\s*#{1,6}\s+.*$/gm, "").trim();
    if (ids.has("label")) t = t.replace(LABEL, "");
    if (ids.has("ending") || ids.has("opening")) t = correct(t);
    if (globalThis.KompasJev && globalThis.KompasJev.designAsk && globalThis.KompasJev.designAsk(question)) t = asDesign(t);
    if (ids.has("rule")) t = dropRuleBreaks(t, question);
    if (ids.has("mismatch")) t = leadWithMatch(t, question);
    if (ids.has("stack")) t = speak(t);
    return t;
  }

  // The findings on one anchor, and the repaired text. The faults are judged on what the model wrote.
  function review(text, question) {
    const J = globalThis.KompasJev;
    const found = J && J.faults ? J.faults(text, question || "") : [];
    return { text: aroundCode(applyCritic)(text, [], question), faults: found };
  }
  // A fenced code block is code, not speech: no repair touches it (a "# comment" is not a heading), and it comes back with its lines.
  const FENCE = /^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm;
  function aroundCode(fn) {
    return (text, ...rest) => {
      const t = String(text || "");
      if (!t.includes("```")) return fn(t, ...rest);
      const out = []; let at = 0;
      for (const m of t.matchAll(FENCE)) {
        const prose = t.slice(at, m.index);
        if (prose.trim()) out.push(fn(prose, ...rest));
        out.push(m[0].trim()); at = m.index + m[0].length;
      }
      const tail = t.slice(at);
      if (tail.trim()) out.push(fn(tail, ...rest));
      return out.filter(Boolean).join("\n");
    };
  }
  // What went wrong, said to the next writer of the same question. It goes first: the next request keeps 900 characters.
  // Only faults the code cannot repair need saying: a missed question, a missing part, a told design, a broken requirement.
  function criticNote(found) {
    const said = [];
    for (const f of found || []) {
      if (f.id === "mismatch") said.push(`it answered a different question and never dealt with ${(f.missing || []).slice(0, 4).join(", ") || "what was asked"}. Lead with exactly what was asked`);
      if (f.id === "parts") said.push(`it left part of the question unanswered (${(f.missing || []).join("; ")}). Answer every part by name`);
      if (f.id === "tense") said.push("it told a design question as finished work. Say what you would do, and claim only tools the resume names");
      if (f.id === "rule") said.push("it argued against a requirement the question set. Keep that requirement and design around it");
      if (f.id === "drift") said.push("it told a different story from the other depth. Tell the same story");
    }
    return said.length ? `(What went wrong on the other depth for this question: ${said.join("; ")}.)` : "";
  }

  globalThis.KompasCorrect = { correct: aroundCode(correct), speak: aroundCode(speak), applyCritic: aroundCode(applyCritic), asSpeaker, asDesign, dropRuleBreaks, review, criticNote };
})();
