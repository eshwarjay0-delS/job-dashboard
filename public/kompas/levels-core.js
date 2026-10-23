/* Kompas levels core — one practice answer, nine listeners, two model calls.
   Owner rule (30 Sep 2026): the model writes only an Engineer answer and a Director answer. Analyst, Technical HR and HR are made from the
   Engineer answer; Lead, Supervisor, Architect and Developer from the Director answer. Making them is selection and wording in code:
   no model call, instant, the same on the page and in /api/levels.
   An anchor is a bank of separate points, each tagged with what kind of point it is. A persona is a rule for which kinds that listener
   wants, in what order, how many, and in which wording. Pure code: no DOM, no network, no model.
   Owner rule (5 Oct 2026, approved edit of this closed file): "100% it needs to answer relevant to the question. But depth can be
   changed. Depending the role." Every level keeps the whole opening passage (the direct answer); only how much of the rest follows
   changes with who is asking. A level made from an anchor is shorter than it, never the anchor again under another name. */
(() => {
  const LADDER = ["hr", "technical_hr", "analyst", "engineer", "developer", "supervisor", "architect", "lead", "director"];
  const ANCHORS = ["engineer", "director"];

  // What a point is about. The model tags each point with one of these; the personas choose by them.
  const KINDS = {
    what: "the direct fact: what it is, or what I do",
    how: "the mechanism, or the steps in order",
    tool: "the named tool, setting, command or configuration",
    check: "the evidence: how it was verified, measured or investigated",
    people: "who was involved: hand-offs, support, alignment, delegation",
    why: "the reason or principle behind it",
    risk: "what can go wrong: failure modes, trade-offs, limits",
    decision: "a call that was made, including what I would not do",
    design: "the structure: components, boundaries, the alternatives weighed",
    code: "the implementation detail: the function, query, pipeline, test or edge case",
    cost: "time, money, effort or priority",
    outcome: "what it led to, good or bad",
    direction: "where the work goes next and why",
    motive: "why I care about this work, or why it fits me",
  };

  // Each listener: the anchor it is made from, what they listen for (the owner's persona definitions, checked against how interview
  // loops assign each interviewer a competency), the kinds they want in order, how many points, and the wording.
  //   wording "plain" = every point in plain words; "mixed" = the technical points as said, the rest plain; "say" = as said.
  const PERSONAS = {
    hr: { name: "HR", from: "engineer", wording: "plain", max: 4, kinds: ["what", "motive", "people", "outcome", "why"],
      listensFor: "Whether they can trust you, whether you fit the team, and whether you can explain your work plainly." },
    technical_hr: { name: "Technical HR", from: "engineer", wording: "mixed", max: 5, kinds: ["what", "tool", "how", "people", "outcome", "motive"],
      listensFor: "Whether your tools and your own scope match the job's requirement list, said with confidence." },
    analyst: { name: "Analyst", from: "engineer", wording: "say", max: 6, kinds: ["check", "what", "how", "outcome", "risk", "tool"],
      listensFor: "Evidence first: what you measured, how you investigated, and the decision it supported." },
    engineer: { name: "Engineer", from: "engineer", wording: "say", max: 10, kinds: null,
      listensFor: "How you solve the problem end to end: what you checked first, what you ruled out, the fix, and how you proved it." },
    developer: { name: "Developer", from: "director", wording: "say", max: 7, kinds: ["code", "how", "tool", "check", "risk", "design"],
      listensFor: "Whether you understand how it is really built: the exact function, query or pipeline, and the edge case you guarded." },
    supervisor: { name: "Supervisor", from: "director", wording: "say", max: 7, kinds: ["direction", "people", "design", "risk", "decision", "outcome"],
      listensFor: "Where the work is heading, and how you keep people, process and design moving together." },
    architect: { name: "Architect + Developer", from: "director", wording: "say", max: 9, kinds: ["design", "code", "how", "tool", "check", "risk", "decision", "why", "cost"],
      listensFor: "How it is really built: the design from first principles, the implementation, the alternatives weighed, and where it would break. (Level 2 of the owner's three levels, 22 Oct 2026: Architect + Developer.)" },
    lead: { name: "Lead", from: "director", wording: "say", max: 7, kinds: ["decision", "people", "risk", "outcome", "direction", "how"],
      listensFor: "How you prioritise, unblock and support people, and that you can still do the work yourself." },
    director: { name: "Director", from: "director", wording: "say", max: 10, kinds: null,
      listensFor: "The business: the risk, the cost, the decision and its payoff, with enough mechanism to show you know the work." },
  };
  const MIXED_AS_SAID = new Set(["what", "tool", "how", "check", "code", "design"]);

  // What each anchor must contain so that every level made from it has its points. Used to write the prompt and to judge completeness.
  const NEEDS = {
    engineer: { what: 1, how: 2, tool: 2, check: 1, people: 1, why: 1, risk: 1, outcome: 1, motive: 1 },
    director: { decision: 2, people: 2, risk: 2, design: 2, code: 2, how: 1, direction: 1, cost: 1, outcome: 1, why: 1, tool: 1, check: 1 },
  };

  const one = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").replace(/\[[^\]]*\]/g, "").trim().slice(0, max);
  const count = (t) => (String(t).match(/\S+/g) || []).length;

  // A model's anchor, made safe to use: known kinds only, real sentences only, nothing empty. Returns null when it is not an anchor.
  function shape(raw, level) {
    if (!raw || typeof raw !== "object" || !ANCHORS.includes(level)) return null;
    const points = (Array.isArray(raw.points) ? raw.points : []).map(p => {
      const kind = String((p && p.kind) || "").toLowerCase().trim(), say = one(p && p.say, 420), plain = one(p && p.plain, 420);
      return KINDS[kind] && count(say) >= 5 ? { kind, say, plain: count(plain) >= 5 ? plain : "" } : null;
    }).filter(Boolean).slice(0, 20);
    const a = { level, lead: one(raw.lead, 260), leadPlain: one(raw.leadPlain, 260), points, close: one(raw.close, 220), closePlain: one(raw.closePlain, 220), story: !!raw.story };
    if (raw.cap) a.cap = Math.max(3, Math.min(10, Number(raw.cap) || 7));               // a comparison is capped (owner rule: fewer than eight points)
    return a.lead && points.length ? a : null;
  }
  // Complete enough that every level made from it gets a real answer.
  function complete(a) {
    if (!a || !a.close || a.points.length < (a.cap ? 4 : a.level === "director" ? 10 : 8)) return false;
    if (a.cap) return true;                                                            // a comparison has its own short shape
    const have = new Set(a.points.map(p => p.kind));
    return Object.keys(NEEDS[a.level]).filter(k => have.has(k)).length >= Math.ceil(Object.keys(NEEDS[a.level]).length * 0.75);
  }
  // the opening line said again as a point is one sentence too many
  const bag = (t) => new Set(String(t).toLowerCase().match(/[a-z0-9']{3,}/g) || []);
  const same = (x, y) => { const a = bag(x), b = bag(y); if (!a.size || !b.size) return false; let n = 0; a.forEach(w => { if (b.has(w)) n++; }); return n / Math.min(a.size, b.size) >= 0.8; };

  // How much of the anchor's body each listener hears after the opening. 1 = all of it.
  const DEPTH = { hr: 0.25, technical_hr: 0.35, analyst: 0.5, engineer: 1, developer: 0.6, supervisor: 0.45, architect: 0.85, lead: 0.5, director: 1 };
  const SHORT_WORDS = 140;                                                   // an answer this short is already at its lightest depth
  const sentencesOf = (t) => String(t || "").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => count(s) >= 3);
  const LEANS_BACK = /^(?:this|that|these|those|it|they|which)\b/i;          // a sentence that only makes sense after the one before it
  // A fenced code block is one unit: never split into sentences, never flattened, never cut by depth. When code was asked for, it is the answer.
  const FENCE = /^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm;
  const isCode = (u) => /^```/.test(u);
  function unitsOf(prose) {
    const t = String(prose || ""), out = []; let at = 0;
    for (const m of t.matchAll(FENCE)) { out.push(...sentencesOf(t.slice(at, m.index).replace(/\s+/g, " ")), m[0].trim()); at = m.index + m[0].length; }
    return out.concat(sentencesOf(t.slice(at).replace(/\s+/g, " ")));
  }
  const joinUnits = (us) => us.reduce((s, u, i) => i ? s + (isCode(u) || isCode(us[i - 1]) ? "\n" : " ") + u : u, "");
  // Coding (owner, 5 Oct 2026: "Developer + Architect for Coding"): both hear the code and the design behind it, and more of the body.
  const CODING_MIX = ["code", "design", "how", "risk", "decision", "check", "tool", "why", "cost"];
  const CODING_SHARE = 0.75;

  // A prose anchor at one depth: the whole opening, then the body sentences this listener cares about, in the order they were said.
  function deriveProse(anchor, level, P, share) {
    const S = unitsOf(anchor.prose); if (!S.length) return null;
    const open = Math.max(1, Math.min(6, Number(anchor.open) || 3, S.length));
    const whole = count(anchor.prose) <= SHORT_WORDS || S.length <= open + 3;
    const close = !whole && S.length > open + 1 ? S[S.length - 1] : "";
    const head = S.slice(0, open), body = whole ? S.slice(open) : S.slice(open, close ? -1 : undefined);
    let picked = body.map((_, i) => i);
    if (!whole && share < 1) {
      const want = Math.max(2, Math.round(body.length * share)), ask = bag(head.join(" ")), kinds = P.kinds || [];
      const score = body.map((s, i) => {
        const b = bag(s); let hit = 0; b.forEach(w => { if (ask.has(w)) hit++; });
        const k = kinds.indexOf(guessKind(s));
        return { i, v: (b.size ? (hit / b.size) * 4 : 0) + (k < 0 ? 0 : (kinds.length - k) / kinds.length * 3) - i * 0.01 };
      });
      const keep = new Set(score.sort((a, b) => b.v - a.v).slice(0, want).map(x => x.i));
      body.forEach((u, i) => { if (isCode(u)) keep.add(i); });
      for (const i of [...keep]) if (i > 0 && LEANS_BACK.test(body[i])) keep.add(i - 1);
      picked = [...keep].sort((a, b) => a - b);
    }
    const points = picked.map(i => body[i]);
    const text = whole ? anchor.prose : joinUnits([...head, ...points, close].filter(Boolean));
    return { level, name: P.name, from: P.from, listensFor: P.listensFor, story: !!anchor.story, lead: head[0], points: [...head.slice(1), ...points], kinds: points.map(guessKind), close, words: count(text), text };
  }

  // One level from its anchor: choose the points this listener wants, in their order, in their wording. No model.
  function derive(anchor, level, mode) {
    const P0 = PERSONAS[level]; if (!P0 || !anchor || anchor.level !== P0.from) return null;
    if (anchor.prose) {
      const coding = mode === "coding" && (level === "architect" || level === "developer");
      return deriveProse(anchor, level, coding ? { ...P0, kinds: CODING_MIX } : P0, coding ? CODING_SHARE : DEPTH[level] == null ? 0.5 : DEPTH[level]);
    }
    const P = anchor.cap ? { ...P0, max: Math.min(P0.max, anchor.cap) } : P0;
    const pool = anchor.points.filter(p => !same(p.say, anchor.lead) && !(p.plain && anchor.leadPlain && same(p.plain, anchor.leadPlain)));
    let chosen;
    if (!P.kinds) chosen = pool.slice(0, P.max);                              // the anchor's own listener hears it as written
    else {
      const left = pool.slice(), take = (kind, n) => { const out = []; for (let i = 0; i < left.length && out.length < n; i++) if (left[i].kind === kind) out.push(left.splice(i--, 1)[0]); return out; };
      const groups = P.kinds.map((k, n) => ({ k, got: take(k, n === 0 ? 2 : 1) }));  // two of what they care about most, one of each of the rest
      let total = groups.reduce((s, g) => s + g.got.length, 0);
      for (const g of groups) { if (total >= P.max) break; const more = take(g.k, P.max - total); g.got.push(...more); total += more.length; }   // spare room goes to their kinds, in their order
      chosen = groups.flatMap(g => g.got).slice(0, P.max);
      if (chosen.length < 3) chosen = chosen.concat(left.slice(0, 3 - chosen.length));   // a thin anchor still gives an answer
    }
    const word = (p) => P.wording === "plain" ? (p.plain || p.say) : P.wording === "mixed" ? (MIXED_AS_SAID.has(p.kind) ? p.say : (p.plain || p.say)) : p.say;
    const plainEnds = P.wording !== "say";
    const lead = plainEnds && anchor.leadPlain ? anchor.leadPlain : anchor.lead, close = plainEnds && anchor.closePlain ? anchor.closePlain : anchor.close;
    const points = chosen.map(word), text = [lead, ...points, close].filter(Boolean).join(" ");
    return { level, name: P.name, from: P.from, listensFor: P.listensFor, story: !!anchor.story, lead, points, kinds: chosen.map(p => p.kind), close, words: count(text), text };
  }
  // Every level the anchors in hand can make.
  function deriveAll(anchors) {
    const out = {};
    for (const level of LADDER) { const a = anchors && anchors[PERSONAS[level].from], d = a ? derive(a, level) : null; if (d) out[level] = d; }
    return out;
  }

  // The cache key: the same question, role and resume always give the same key, on any device.
  function hash(s) { let a = 0x811c9dc5, b = 0x1b873593; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x85ebca6b) + a; } return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0"); }
  const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const key = (question, role, resume) => "levels:v1:" + hash(norm(question) + "|" + norm(role) + "|" + hash(norm(resume)));
  // One session, one dossier. The id is the session's. Another session does not use this key.
  const sessionDossierKey = (sessionId) => "perfact.dossier." + String(sessionId || "").trim();
  // The levels cache that sits beside that dossier. perfact.* plus the session id.
  const sessionLevelsKey = (sessionId, question, resume) => "perfact.levels." + String(sessionId || "").trim() + ":" + hash(norm(question) + "|" + hash(norm(resume)));
  // Same question substance and the same resume facts, across sessions. No session id.
  const maturityKey = (question, resume) => "maturity:v1:" + hash(norm(question) + "|" + hash(norm(resume)));

  function guessKind(s) {
    const t = String(s).toLowerCase();
    if (/\b(function|query|code|api|class|pipeline|test)\b/.test(t)) return "code";
    if (/\b(chose|decided|would not|wouldn't|trade-?off)\b/.test(t)) return "decision";
    if (/\b(risk|fail|break|limit)\b/.test(t)) return "risk";
    if (/\b(design|architect|component|boundary)\b/.test(t)) return "design";
    if (/\b(checked|measured|proved|verified|log)\b/.test(t)) return "check";
    if (/\b(team|asked|told|manager|owner)\b/.test(t)) return "people";
    if (/\b(because|so that|reason|principle)\b/.test(t)) return "why";
    if (/\b(splunk|sentinel|tool|configured|setting)\b/.test(t)) return "tool";
    if (/\b(next|roadmap|direction|priority)\b/.test(t)) return "direction";
    if (/\b(result|outcome|still|now)\b/.test(t)) return "outcome";
    if (/\b(how|then|first|step)\b/.test(t)) return "how";
    if (/\b(cost|budget|week|month)\b/.test(t)) return "cost";
    if (/\b(care|fit|want|enjoy)\b/.test(t)) return "motive";
    return "what";
  }

  // The accepted prose, split into points so a derived level can be selected in code. The anchor's own prose is kept whole.
  function fromProse(text, level) {
    const blocks = [];
    const raw = String(text || "").replace(FENCE, m => { blocks.push(m.trim()); return `\n@@CODE${blocks.length - 1}@@\n`; });
    const top = raw.split(/^\s*(?:#{1,6}\s|\d+\.\s|@@CODE)|(?:^|\s)(?:[-*•]\s|\(pause\))/mi)[0];   // the opening passage, before the first heading, bullet or code (also once flattened onto one line)
    const opening = top.length < raw.trim().length ? sentencesOf(top.replace(/\s+/g, " ")).length : 0;
    const clean = raw.replace(/^\s*#{1,6}\s+.*$/gm, "").replace(/\s*\(pause\)\s*/gi, " ").replace(/\s+/g, " ").trim();
    const bits = clean.replace(/@@CODE\d+@@/g, " ").split(/(?<=[.!?])\s+/).map(s => s.replace(/^[-*]\s+/, "").trim()).filter(s => count(s) >= 3);
    if (!bits.length) return null;
    const lead = bits[0];
    const rest = bits.slice(1);
    const close = rest.length > 1 ? rest.pop() : "";
    const points = (rest.length ? rest : [lead]).slice(0, 16).map(say => ({ kind: guessKind(say), say, plain: say }));
    const a = shape({ lead, leadPlain: lead, points, close, closePlain: close }, level);
    if (!a) return null;
    a.prose = clean.replace(/\s*@@CODE(\d+)@@\s*/g, (_, i) => "\n" + blocks[+i] + "\n").trim();
    if (opening) a.open = Math.min(6, opening);
    return a;
  }

  // Engineer and Director show the prose the model wrote. Every other level is derive(). Peer mirrors peerOf.
  // A kind filter that keeps a scrap of a full answer is not a level. The anchor is shown whole.
  function textFor(anchors, level, peerOf, mode) {
    const D = globalThis.KompasDiamond;
    const who = level === "peer" ? (D && D.MAP[peerOf] ? peerOf : "engineer") : level;
    const from = (D && D.MAP[who]) || (PERSONAS[who] && PERSONAS[who].from);
    if (!from || !anchors) return "";
    const a = anchors[from];
    if (!a) return "";
    if ((who === "engineer" || who === "director") && a.prose) return a.prose;
    const d = derive(a, who, mode);
    return d && d.text ? d.text : (a.prose || "");
  }

  globalThis.KompasLevels = { LADDER, ANCHORS, KINDS, PERSONAS, NEEDS, shape, complete, derive, deriveAll, key, hash, fromProse, textFor, guessKind, sessionDossierKey, sessionLevelsKey, maturityKey };
})();
