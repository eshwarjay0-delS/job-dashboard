/* Stops a cache hit, a derived level, or a selected label from becoming a model call.
   Jay, 1 Oct 2026: Jev is the brain of Kompas. Same inputs, same decision.
   The procedure is the System One reference (edition 1.1.1), implemented here and not copied:
   bound the decision, keep evidence as data, ask one batch of atomic questions, check the
   packet, then combine in code. A live Jev call would be a third model. Diamond rules 1, 2
   and 10 forbid that, so this route stays agent simulation: jev_called is false, and
   probability and confidence stay null. needs_review is not a go-ahead. A selected label
   is not permission. */
(() => {
  const ready = (a) => !!(a && a.engineer && (a.engineer.prose || a.engineer.lead) && a.director && (a.director.prose || a.director.lead));

  const CACHE_ROUTES = {
    session: "The session cache holds both anchors, and this request is not a fresh write.",
    maturity: "The maturity store holds both anchors, and this request is not a fresh write.",
    shared: "The older shared key holds both anchors, and this request is not a fresh write.",
    generate: "No ready pair is stored, or this request is the one fresh write of the two anchors.",
  };
  const ANCHOR_ROUTES = {
    engineer: "Analyst, Tech HR, and HR read the Engineer answer. Engineer reads itself.",
    director: "Lead, Supervisor, Architect, and Developer read the Director answer. Director reads itself.",
  };

  // What this module will not ask Jev to decide. Words, sums, dates, pictures, and permission stay outside it.
  const REFUSALS = {
    generate: "Jev does not write prose. Engineer and Director write the words.",
    arithmetic: "Counting and arithmetic stay in code.",
    dates: "Date and time order stays in code.",
    media: "Jev reads text. Audio and images stay outside the judgement.",
    authorize: "A judgement does not grant a model call, consent, or spending.",
  };

  function typed(type, value, instructions, needsReview) {
    const review = !!needsReview || value == null;
    return {
      type,
      value: review ? null : value,
      needs_review: review,
      reason: String(instructions || ""),
      probability: null,
      confidence: null,
    };
  }

  function dataOnly(evidence) {
    if (!evidence || typeof evidence !== "object") return evidence == null ? null : evidence;
    if (Array.isArray(evidence)) return evidence.map(item => dataOnly(item));
    const out = {};
    for (const [key, value] of Object.entries(evidence)) {
      if (typeof value === "function") continue;
      out[key] = value && typeof value === "object" ? dataOnly(value) : value;
    }
    return out;
  }

  function packetShape(answer, spec) {
    if (!answer || answer.probability !== null || answer.confidence !== null) return false;
    if (!spec || typeof spec.instructions !== "string" || !spec.instructions.trim()) return false;
    if (answer.type !== spec.type) return false;
    if (answer.needs_review) return answer.value === null;
    if (answer.type === "noul") return typeof answer.value === "boolean";
    if (answer.type === "choice") {
      const labels = spec.labels && typeof spec.labels === "object" ? spec.labels : {};
      if (typeof answer.value !== "string" || !Object.prototype.hasOwnProperty.call(labels, answer.value)) return false;
      if (spec.closed === "anchors") {
        const keys = Object.keys(labels);
        return keys.length === 2 && keys.includes("engineer") && keys.includes("director");
      }
      return typeof spec.noMatch === "string" && Object.prototype.hasOwnProperty.call(labels, spec.noMatch);
    }
    if (answer.type === "score") {
      const levels = Array.isArray(spec.levels) ? spec.levels.length : 0;
      return levels >= 2 && levels <= 10 && Number.isInteger(answer.value) && answer.value >= 0 && answer.value < levels;
    }
    return false;
  }

  // Order: refuse, filter the state, one isolated batch, then the checks. Exit 2 abstains. Exit 1 is a bad packet.
  function think(spec) {
    const id = spec && spec.id;
    const goal = spec && spec.goal;
    const policy = spec && spec.policy;
    const refused = spec && REFUSALS[spec.asks];
    if (refused || !spec || !spec.questions || typeof spec.questions !== "object" || Array.isArray(spec.questions)) {
      return {
        mode: "agent_simulation",
        jev_called: false,
        decision: id || "",
        goal: goal || "",
        policy: policy || "",
        evidence: dataOnly(spec && spec.evidence),
        decisions: {},
        exit: 1,
        refused: refused || "A decision needs a bounded question batch.",
      };
    }
    const evidence = dataOnly(spec.evidence);
    const questions = Object.entries(spec.questions);
    const decisions = {};
    for (const [key, q] of questions) {
      const item = q && typeof q === "object" ? q : {};
      if (item.type === "choice") {
        const labels = item.labels && typeof item.labels === "object" ? item.labels : {};
        const known = item.value != null && Object.prototype.hasOwnProperty.call(labels, item.value);
        decisions[key] = typed("choice", known ? item.value : null, item.instructions, !known || item.unresolved);
      } else if (item.type === "score") {
        const levels = Array.isArray(item.levels) ? item.levels.length : 0;
        const index = Number.isInteger(item.value) ? item.value : null;
        const known = index != null && index >= 0 && index < levels;
        decisions[key] = typed("score", known ? index : null, item.instructions, !known || item.unresolved);
      } else {
        decisions[key] = typed("noul", item.unresolved ? null : !!item.value, item.instructions, !!item.unresolved);
      }
    }
    const broken = questions.length === 0 || questions.some(([key, q]) => !packetShape(decisions[key], q));
    const review = Object.values(decisions).some(a => a.needs_review);
    return {
      mode: "agent_simulation",
      jev_called: false,
      decision: id,
      goal,
      policy,
      evidence,
      decisions,
      exit: broken ? 1 : review ? 2 : 0,
      refused: null,
    };
  }

  function usable(sim) {
    return !!(sim && sim.mode === "agent_simulation" && sim.jev_called === false && sim.exit === 0 && !sim.refused);
  }

  function anyTrue(sim, suffix) {
    return Object.entries(sim.decisions).some(([key, answer]) => key.endsWith(suffix) && answer.value === true);
  }

  // Session dossier first, then the shared maturity store, then an older shared key.
  function cacheDecision(hits) {
    const packet = !!hits && typeof hits === "object" && !Array.isArray(hits);
    const h = packet ? hits : {};
    const sessionReady = packet && !h.fresh && ready(h.session);
    const maturityReady = packet && !h.fresh && ready(h.maturity);
    const sharedReady = packet && !h.fresh && ready(h.legacy);
    let route = null;
    let why = "No cache packet was supplied.";
    if (packet && sessionReady) {
      route = "session";
      why = CACHE_ROUTES.session;
    } else if (packet && maturityReady) {
      route = "maturity";
      why = CACHE_ROUTES.maturity;
    } else if (packet && sharedReady) {
      route = "shared";
      why = CACHE_ROUTES.shared;
    } else if (packet) {
      route = "generate";
      why = CACHE_ROUTES.generate;
    }
    const sim = think({
      id: "cache",
      asks: "judge",
      goal: "Serve a repeated question from cache. Write Engineer and Director only on a miss.",
      policy: "The model is called only for the two anchors, once. A later request is the cache. A derived level never spends a call. The route is not permission by itself.",
      evidence: {
        fresh: packet ? !!h.fresh : null,
        sessionReady,
        maturityReady,
        sharedReady,
      },
      questions: {
        session_ready: {
          type: "noul",
          instructions: sessionReady ? "Session anchors are ready." : "The session cache has no ready pair.",
          value: sessionReady,
          unresolved: !packet,
        },
        maturity_ready: {
          type: "noul",
          instructions: maturityReady ? "Maturity anchors are ready." : "The maturity store has no ready pair.",
          value: maturityReady,
          unresolved: !packet,
        },
        shared_ready: {
          type: "noul",
          instructions: sharedReady ? "The older shared key is ready." : "The older shared key has no ready pair.",
          value: sharedReady,
          unresolved: !packet,
        },
        route: {
          type: "choice",
          instructions: why,
          value: route,
          labels: CACHE_ROUTES,
          noMatch: "generate",
        },
      },
    });
    if (!usable(sim)) return { hit: false, source: "miss", model: false, anchors: null };
    const chosen = sim.decisions.route.value;
    if (chosen === "session") return { hit: true, source: "session", model: false, anchors: h.session };
    if (chosen === "maturity") return { hit: true, source: "maturity", model: false, anchors: h.maturity };
    if (chosen === "shared") return { hit: true, source: "shared", model: false, anchors: h.legacy };
    if (chosen === "generate") return { hit: false, source: "miss", model: true, anchors: null };
    return { hit: false, source: "miss", model: false, anchors: null };
  }

  // Only Engineer and Director, and only when the cache missed. A derived level is refused. A repeat is refused.
  function allowModel(level, decision) {
    const D = globalThis.KompasDiamond;
    const packet = !!decision && typeof decision === "object";
    const named = typeof level === "string" && level.length > 0;
    const diamond = !!(D && Array.isArray(D.ANCHORS));
    const isAnchor = named && diamond && D.ANCHORS.includes(level);
    const cacheMiss = packet && decision.hit === false && decision.model === true;
    const priorBlocked = packet && decision.judgment && decision.judgment.exit !== 0;
    const sim = think({
      id: "model",
      asks: "judge",
      goal: "Call the model only for an anchor, and only when the cache missed.",
      policy: "A selected label is not permission. Diamond rules still decide who may be written. Confidence is not a gate.",
      evidence: {
        level: named ? level : null,
        hit: packet ? !!decision.hit : null,
        model: packet ? decision.model === true : null,
        diamond,
      },
      questions: {
        is_anchor: {
          type: "noul",
          instructions: isAnchor ? level + " is an anchor." : "This level is derived, or the diamond list is absent.",
          value: isAnchor,
          unresolved: !named || !diamond,
        },
        cache_miss: {
          type: "noul",
          instructions: cacheMiss ? "The cache missed and a first write is still open." : "The cache already answered, or the model was not requested.",
          value: cacheMiss,
          unresolved: !packet,
        },
      },
    });
    if (!usable(sim) || priorBlocked) return false;
    if (!diamond || !D.ANCHORS.includes(level)) return false;
    if (sim.decisions.is_anchor.value !== true) return false;
    if (sim.decisions.cache_miss.value !== true) return false;
    return true;
  }

  function anchorFor(level, peerOf) {
    const D = globalThis.KompasDiamond;
    const plan = D && typeof D.plan === "function" ? D.plan(level, {}, peerOf) : null;
    const from = plan && (plan.from === "engineer" || plan.from === "director") ? plan.from : null;
    const sim = think({
      id: "anchor",
      asks: "judge",
      goal: "Choose the anchor this level reads. Do not call the model for a derived level.",
      policy: "Peer mirrors the level already selected. It is not a third model call. No side headings. An unknown level follows the diamond map.",
      evidence: {
        level: level == null ? null : level,
        peerOf: peerOf == null ? null : peerOf,
        from,
        derived: plan ? !!plan.derived : null,
      },
      questions: {
        anchor: {
          type: "choice",
          instructions: from ? "The diamond map reads " + plan.level + " from " + from + "." : "The diamond map is absent.",
          value: from,
          labels: ANCHOR_ROUTES,
          closed: "anchors",
        },
      },
    });
    if (!usable(sim) || !plan) return { level: "engineer", from: "engineer", derived: false, model: false };
    return { level: plan.level, from: plan.from, derived: plan.derived, model: false };
  }

  // Live trial, 5 Oct 2026. The old mismatch test fired only when NO question word appeared, so an answer about a
  // SIEM content program passed a question about an alert, a playbook and isolating a host. A question carries a
  // few words naming what it asks about; an answer that touches under a third of them answered something else.
  const ASK_STOP = new Set(("about above after again also another answer approach asked asking back been before being best both call come comes " +
    "coming could check decide describe does doesn didn done each either even every example explain first from give goes going good handle " +
    "happen happens have having here into just keep know like make making many match matter matters more most much need next only other over " +
    "really right same should situation some someone something sure take tell than that their them then there these they thing think this " +
    "those through time today together tomorrow tonight under very walk want well were what when where which while will with without work would " +
    "year years your yours").split(" "));
  const stem = (w) => { const l = String(w).toLowerCase(); return (l.length > 4 && /s$/.test(l) && !/ss$/.test(l) ? l.slice(0, -1) : l).slice(0, 5); };
  function askWords(text) {
    const seen = new Map();
    for (const raw of String(text || "").toLowerCase().match(/[a-z][a-z'’-]{3,}/g) || []) {
      const w = raw.replace(/['’].*$/, "").replace(/-+$/, "");
      if (w.length < 4 || ASK_STOP.has(w)) continue;
      if (!seen.has(stem(w))) seen.set(stem(w), w);
    }
    return [...seen].map(([s, word]) => ({ stem: s, word }));
  }
  const stemsOf = (text) => new Set((String(text || "").toLowerCase().match(/[a-z]{4,}/g) || []).map(stem));
  const sentencesOf = (text) => String(text || "").replace(/^\s*(?:[-•*]|\d+[.)])\s+/gm, "").replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

  // Coverage and parts are judged only on a clean question (the derived question a live anchor answers). On a raw
  // interviewer turn ("nutshell… feel free… stuff") they flagged 44 of 72 real Parakeet answers, so a rambling turn
  // keeps the old test: not one of its words in the answer.
  const cleanAsk = (q) => { const t = String(q || "").trim(); return !!t && t.split(/\s+/).length <= 45 && !/^[….]/.test(t) && !/\b(?:um+|uh+|erm|you know|i mean|like,)(?![a-z])/i.test(t); };
  // Only the asking sentences decide: "Thanks for clarifying your monitoring process. Are you located in the US?" is
  // about location. The preamble's words are still named in what was missed, so the next writer sees them.
  const askingText = (q) => String(q || "").replace(/\s+/g, " ").trim().split(/(?<=[?.!])\s+/).filter(s => /\?\s*$/.test(s) || ASKS_WORD.test(s)).join(" ");
  function missesAsk(answer, question) {
    const asking = askingText(question);
    if (!cleanAsk(question) || !asking || (String(answer || "").match(/\S+/g) || []).length < 25) {
      const words = (String(question || "").toLowerCase().match(/[a-z]{5,}/g) || []).filter(w => !/^(?:about|would|could|should|there|where|which|their|these|those)$/.test(w));
      return words.length >= 2 && !words.some(w => String(answer || "").toLowerCase().includes(w)) ? words.slice(0, 6) : null;
    }
    const keys = askWords(asking);
    if (keys.length < 2) return null;
    const have = stemsOf(answer);
    const missing = keys.filter(k => !have.has(k.stem));
    const share = (keys.length - missing.length) / keys.length;
    if (!(keys.length >= 3 ? share < 0.34 : share === 0)) return null;
    const context = askWords(question).filter(k => !have.has(k.stem) && !keys.some(x => x.stem === k.stem));
    return [...context, ...missing].map(k => k.word);
  }

  // "What do you do first, and who do you tell first?" is two questions. Each part needs its own answer.
  const ASKS_WORD = /\b(?:who|whom|what|when|where|why|how|which|whether)\b/i;
  const TELL_ASK = /\b(?:who|whom)\b[^?.]*\b(?:tell|told|inform|notify|call|escalate|loop|brief|page|contact|update|communicate|know)\b|\b(?:tell|inform|notify|call|escalate|brief|page|contact)\b[^?.]*\b(?:who|whom)\b/i;
  const TELL_DONE = /\b(?:tell|tells|told|inform|informs|informed|notify|notifies|notified|call|calls|called|page|pages|paged|escalate|escalates|escalated|brief|briefs|briefed|loop(?:s|ed)? in|let\b[^.!?]{0,30}\bknow|update|updates|updated|ping|pinged|email|emailed|phone|bring in|pull in|contact|contacted|raise|raised)\b/i;
  const ROLE = /\b(?:manager|director|ciso|cio|cto|ceo|vp|head of|lead|owner|on-?call|commander|change (?:manager|advisory board)|cab|stakeholders?|business|team|soc|noc|legal|compliance|privacy|executive|leadership|supervisor|boss|service desk|help ?desk|customers?|regulators?|duty officer|bridge)\b/i;
  function questionParts(question) {
    const parts = [];
    for (const s of String(question || "").replace(/\s+/g, " ").trim().split(/(?<=[?.!])\s+/)) {
      if (!/\?\s*$/.test(s) && !ASKS_WORD.test(s)) continue;
      // "…and do you tell legal" is a second ask; "…but does not become the normal way in" has no subject of its own,
      // so it is a requirement on the first ask, judged by ruleBroken, not a part.
      for (const piece of s.split(/,?\s+(?:and|but|also|plus|then)\s+(?=(?:who|whom|what|when|where|why|how|which|whether)\b|(?:do|does|did|would|will|can|could|should)\s+(?:you|we|they|i|your|the team)\b)/i)) {
        const text = piece.replace(/[?.!]+\s*$/, "").trim();
        if (text) parts.push({ text, tell: TELL_ASK.test(text), keys: askWords(text) });
      }
    }
    return parts;
  }
  function missingParts(answer, question) {
    if (!cleanAsk(question) || (String(answer || "").match(/\S+/g) || []).length < 25) return [];
    const asked = questionParts(question).filter(p => p.tell || p.keys.length);
    if (asked.length < 2 && !asked.some(p => p.tell)) return [];
    const said = sentencesOf(answer);
    const have = stemsOf(answer);
    return asked.filter(p => p.tell
      ? !said.some(s => TELL_DONE.test(s) && ROLE.test(s))
      : !p.keys.some(k => have.has(k.stem))).map(p => p.text);
  }

  // A design question answered as finished work ("I designed…") claims a project that may never have happened.
  const DESIGN_ASK = /\b(?:how would you|what would you|would you|how (?:do|would|will|should) you (?:design|architect|build|structure|plan)|design (?:a|an|the|your)|what if|suppose|imagine|if you (?:had|were|found|saw|got|inherit)|walk me through how you(?:['’]d| would)|how (?:do|would) you (?:handle|approach|keep|maintain|ensure|detect)\b[^?]*\b(?:when|if|while)\b)/i;
  const PAST_ASK = /\b(?:tell me about a time|describe a time|give me an example of (?:a|when)|a time when you|have you ever|did you|when did you|what did you|walk me through (?:a|the) time|your experience)\b/i;
  const BASE = {
    designed: "design", built: "build", implemented: "implement", deployed: "deploy", created: "create", configured: "configure",
    integrated: "integrate", architected: "architect", introduced: "introduce", added: "add", wrote: "write", moved: "move",
    migrated: "migrate", used: "use", routed: "route", buffered: "buffer", tuned: "tune", established: "establish", defined: "define",
    replaced: "replace", enabled: "enable", automated: "automate", scaled: "scale", partitioned: "partition", prioritized: "prioritize",
    onboarded: "onboard", isolated: "isolate", contained: "contain", escalated: "escalate", notified: "notify", told: "tell",
    briefed: "brief", chose: "choose", decided: "decide", ran: "run", started: "start", began: "begin", mapped: "map", shifted: "shift",
    kept: "keep", sent: "send", forwarded: "forward", filtered: "filter", dropped: "drop", sampled: "sample", throttled: "throttle",
    switched: "switch", rerouted: "reroute", checked: "check", verified: "verify", validated: "validate", reviewed: "review",
    monitored: "monitor", documented: "document", tested: "test", pulled: "pull", pushed: "push", correlated: "correlate", paged: "page",
    called: "call", segmented: "segment", deduplicated: "deduplicate", normalized: "normalize", ingested: "ingest", queued: "queue",
    stored: "store", retained: "retain", replayed: "replay", backfilled: "backfill", measured: "measure", proved: "prove",
    "set up": "set up", "stood up": "stand up", "rolled out": "roll out", "failed over": "fail over", "spun up": "spin up", "put in place": "put in place",
  };
  // Live re-run, 5 Oct: a list of verbs left "I handled… I confirmed… I adjusted" in the past beside the sentences it
  // did turn into "I would", which reads worse than either tense. Any regular past verb counts, with a base form.
  const IRREGULAR = {
    made: "make", took: "take", led: "lead", got: "get", found: "find", brought: "bring", gave: "give", saw: "see",
    drove: "drive", held: "hold", spun: "spin", stood: "stand", caught: "catch", taught: "teach", knew: "know", met: "meet",
    paid: "pay", laid: "lay", rebuilt: "rebuild", rewrote: "rewrite", oversaw: "oversee", drew: "draw", grew: "grow",
    threw: "throw", went: "go", came: "come", fed: "feed", sought: "seek", bought: "buy", froze: "freeze",
  };
  const NO_E = {
    focused: "focus", biased: "bias", pinged: "ping", belonged: "belong", monitored: "monitor", mentored: "mentor",
    authored: "author", sponsored: "sponsor", tailored: "tailor", anchored: "anchor", factored: "factor", honored: "honor",
    piloted: "pilot", pivoted: "pivot", treated: "treat", repeated: "repeat", synced: "sync", developed: "develop",
    controlled: "control", patrolled: "patrol", cancelled: "cancel", labelled: "label", modelled: "model", signalled: "signal",
    cached: "cache", scoped: "scope", invited: "invite", cited: "cite", excited: "excite", united: "unite", guided: "guide",
  };
  const NOT_PAST = /^(?:need|proceed|exceed|succeed|feed|seed|bleed|breed|speed|heed|embed|shred)$/;
  function baseOf(verb) {
    const v = String(verb || "").toLowerCase().replace(/\s+/g, " ");
    const pre = v.match(/^([a-z]+[-‐‑])(.+)$/);
    if (pre) return pre[1] + baseOf(pre[2]);
    if (BASE[v] || IRREGULAR[v] || NO_E[v]) return BASE[v] || IRREGULAR[v] || NO_E[v];
    if (!/ed$/.test(v)) return v;
    if (/ied$/.test(v)) return v.slice(0, -3) + "y";
    if (/eed$/.test(v)) return v.slice(0, -1);
    const stem = v.slice(0, -2);
    if (/e$/.test(stem)) return stem;
    if (/([b-df-hj-np-tv-z])\1$/.test(stem) && !/(?:ll|ss|ff|zz)$/.test(stem)) return stem.slice(0, -1);
    const e = /(?:[vz]|[^s]s|[^aeiou]l|ul|[^aeiou]il|c|[aeiou]g|[^n]g|[ae]ng|[^aeiou]at|ut|(?:[mn]|qu)ot|let|ur|[^aeiou]ar|(?:qu|[^aeiou])ir|or|[^aeiou]in|[^aeiou]un|um|[^aeiou]am|ud|od|[^aeiou]id|uid|[^aeiou]ad|ib|ob|[^aeiou][aiy]p|[^aeiou]ok|ik)$/;
    return e.test(stem) && !/(?:ll|ss)$/.test(stem) ? stem + "e" : stem;
  }
  const VERBS = [...Object.keys(BASE), ...Object.keys(IRREGULAR)].sort((a, b) => b.length - a.length).join("|").replace(/ /g, "\\s+");
  const PAST_VERB = `(?:${VERBS}|(?!(?:${NOT_PAST.source.slice(4, -2)})(?![\\w-]))(?:[a-z]+[-‐‑])?[a-z]{2,}ed)(?![\\w-])(?!(?<=\\bused)\\s+to\\b)`;
  const PAST_CLAIM = new RegExp(`\\b(I|[Ww]e|[Mm]y team and I|[Tt]he team and I)\\s+((?:first|then|also|quickly|immediately|initially|next|just|finally)\\s+)?(${PAST_VERB})`);
  // One sentence of real proof ("At Cigna I built…") is allowed in a design answer; that is not the fault.
  const PROOF = /\b[Aa]t\s+[A-Z][\w&.-]+|\b(?:[Pp]revious|[Ll]ast|[Cc]urrent|[Pp]rior|[Ee]arlier) (?:role|job|team|company|employer|position)\b|\b[Ww]hen I was\b|\b[Ii]n (?:19|20)\d\d\b|\b[Bb]ack (?:then|at|when)\b|\b[Ll]ast (?:year|quarter|month)\b|\b[Pp]reviously\b|\b[Tt]hat (?:time|incident|outage|project)\b/;
  const CONDITIONAL = /\b(?:would|I['’]d|we['’]d|I['’]ll|we['’]ll|will|my first move|I start|I begin|I check|I look|I pull|I route|I make)\b/;
  const designAsk = (question) => DESIGN_ASK.test(String(question || "")) && !PAST_ASK.test(String(question || ""));
  function designTold(answer, question) {
    if (!designAsk(question)) return false;
    const said = sentencesOf(answer);
    const past = said.filter(s => PAST_CLAIM.test(s) && !PROOF.test(s));
    if (!past.length) return false;
    const opener = said.find(s => PAST_CLAIM.test(s) || CONDITIONAL.test(s));
    return (opener && past.includes(opener)) || past.length > said.filter(s => CONDITIONAL.test(s)).length;
  }

  // A question that sets a requirement ("break-glass must not become the normal way in") is not answered by
  // ranking speed above it. That sentence argues against the brief it was given.
  const RULE_ASK = /\b(?:must not|mustn['’]t|should not|shouldn['’]t|never|not become|doesn['’]t become|does not become|never becomes|can['’]t become|cannot become|not turn into|without becoming|isn['’]t the (?:normal|default)|not the (?:normal|default|everyday|usual))\b/i;
  const RULE_BREAK = /\b(?:speed|convenience|uptime|availability|velocity|agility|productivity|getting (?:in|access)|being fast)\b[^.!?]{0,40}\b(?:matters? more than|is more important than|trumps|outweighs|beats|comes before|takes priority over|wins over|ahead of)\b[^.!?]{0,30}\b(?:prevention|preventing|control|controls|security|governance|oversight|approvals?|reviews?|audit(?:ing)?|least privilege|compliance|process|friction)\b|\b(?:speed|convenience|velocity)\s+over\s+(?:prevention|control|security|governance)\b|\b(?:prevention|control|controls|security|governance|oversight|approvals?)\b[^.!?]{0,30}\b(?:matters? less|is less important|comes second|takes a back seat|can wait)\b/i;
  function ruleBroken(answer, question) {
    if (!RULE_ASK.test(String(question || ""))) return [];
    return sentencesOf(answer).filter(s => RULE_BREAK.test(s));
  }

  // Engineer and Director answer one question with one story at two depths. Different dominant topics are two stories.
  const TOPICS = {
    endpoint: /\b(?:EDR|XDR|endpoints?|CrowdStrike|Falcon|SentinelOne|Carbon Black|Defender for Endpoint|antivirus)\b/gi,
    governance: /\b(?:identity governance|IGA|SailPoint|Saviynt|access reviews?|certification campaigns?|joiners?|movers?|leavers?|entitlements?)\b/gi,
    privileged: /\b(?:PAM|privileged|CyberArk|BeyondTrust|break-?glass|session recording|password vault)\b/gi,
    detection: /\b(?:SIEM|Splunk|Sentinel|QRadar|detections?|correlation|log sources?|use cases?|alerts?)\b/gi,
    identity: /\b(?:MFA|SSO|Okta|Entra|Azure AD|conditional access|identity provider|federation)\b/gi,
    email: /\b(?:phishing|email security|Proofpoint|Mimecast|DMARC)\b/gi,
    data: /\b(?:DLP|data loss|classification|encryption at rest|tokeni[sz]ation)\b/gi,
    vulnerability: /\b(?:vulnerabilit(?:y|ies)|patch(?:ing|es)?|Qualys|Tenable|Nessus|CVEs?)\b/gi,
    network: /\b(?:firewalls?|segmentation|Palo Alto|zero trust|VPN|proxy|NAC)\b/gi,
    cloud: /\b(?:AWS|Azure|GCP|cloud posture|CSPM|IAM roles?)\b/gi,
  };
  function topicsOf(text) {
    const out = {};
    for (const [k, re] of Object.entries(TOPICS)) { const n = (String(text || "").match(re) || []).length; if (n) out[k] = n; }
    return out;
  }
  function storyDrift(a, b) {
    const A = topicsOf(a), B = topicsOf(b);
    const top = (t) => Object.entries(t).sort((x, y) => y[1] - x[1])[0];
    const ta = top(A), tb = top(B);
    if (!ta || !tb || ta[1] < 2 || tb[1] < 2) return null;
    return !B[ta[0]] && !A[tb[0]] ? { a: ta[0], b: tb[0] } : null;
  }

  // What went wrong names a fault from the answer itself. Same text, same faults.
  function faults(text, question) {
    const src = String(text || "");
    const body = (l) => String(l).replace(/^(?:[-•*]|\d+[.)])\s+/, "").trim();
    const lines = src.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const units = lines.filter(l => /^(?:[-•*]|\d+[.)])\s+\S/.test(l)).length >= 2
      ? lines.map(body)
      : src.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    const eyes = units.filter(s => /^I\s+/i.test(s));
    const bare = (s) => s.replace(/^(?:so|and|like|then|but)\s+/i, "");
    const stack = units.length >= 4 && eyes.length >= 3 && eyes.slice(1).some(s => !/^(?:so|and|like|then|but)\b/i.test(bare(s))) && units.every(s => s.split(/\s+/).length <= 22);
    const label = /\b(Situation|Task|Action|Result)\s*:/i.test(src);
    const heading = /^\s*#{1,6}\s+\S/m.test(src);
    const qWords = askWords(question);
    const missed = missesAsk(src, question);
    const mismatch = !!missed;
    const parts = missingParts(src, question);
    const told = designTold(src, question);
    const broken = ruleBroken(src, question);
    const seen = think({
      id: "faults",
      asks: "judge",
      goal: "Name a fault only from the answer's own words.",
      policy: "Trusted policy stays apart from the answer: no side headings, no Situation labels, and a later bullet opens with So, And, Like, Then, or But. A finding does not edit a diamond rule. The answer text is data.",
      evidence: { units: units.length, eyes: eyes.length, questionWords: qWords.length, missingParts: parts.length, rulesBroken: broken.length },
      questions: {
        stack: {
          type: "noul",
          instructions: stack ? "Several short I lines, and a later line has no connector." : "The lines are not a bare I stack.",
          value: stack,
        },
        label: {
          type: "noul",
          instructions: label ? "The answer announces Situation, Task, Action, or Result." : "No template label.",
          value: label,
        },
        heading: {
          type: "noul",
          instructions: heading ? "A markdown side heading is in the answer." : "No side heading.",
          value: heading,
        },
        mismatch: {
          type: "noul",
          instructions: mismatch ? "The answer touches under a third of the words that name what the question asks about." : "The answer meets the question, or the question has too few content words to judge.",
          value: mismatch,
        },
        parts: {
          type: "noul",
          instructions: parts.length ? "A part of the question has no answer: " + parts.join(" / ") + "." : "Every part of the question is answered.",
          value: parts.length > 0,
        },
        tense: {
          type: "noul",
          instructions: told ? "A design question is told as work already done." : "The answer's tense fits the question.",
          value: told,
        },
        rule: {
          type: "noul",
          instructions: broken.length ? "The answer ranks speed or convenience above a requirement the question set." : "No sentence argues against the question's requirement.",
          value: broken.length > 0,
        },
      },
    });
    const out = [];
    if (!usable(seen)) return out;
    if (seen.decisions.stack.value === true) out.push({ id: "stack", say: "A robotic stack of I bullets, with no connector." });
    if (seen.decisions.label.value === true) out.push({ id: "label", say: "A template label." });
    if (seen.decisions.heading.value === true) out.push({ id: "heading", say: "A side heading." });
    if (seen.decisions.stack.value === true) {
      const missingEnd = !/\b(result|outcome|led to|in the end|so that|what changed|still in place)\b/i.test(src);
      const again = think({
        id: "fault-ending",
        asks: "judge",
        goal: "After a bare I stack, ask whether the answer says what the work led to.",
        policy: "This question waits until the stack finding is known. It does not add a side heading.",
        evidence: { stack: true },
        questions: {
          ending: {
            type: "noul",
            instructions: missingEnd ? "The stack never says the result." : "The stack names an ending.",
            value: missingEnd,
          },
        },
      });
      if (usable(again) && again.decisions.ending.value === true) out.push({ id: "ending", say: "A missing ending." });
    }
    if (seen.decisions.mismatch.value === true) out.push({ id: "mismatch", say: "An answer that does not match the question.", missing: missed });
    if (seen.decisions.parts.value === true) out.push({ id: "parts", say: "Part of the question was not answered.", missing: parts });
    if (seen.decisions.tense.value === true) out.push({ id: "tense", say: "A design question told as finished work." });
    if (seen.decisions.rule.value === true) out.push({ id: "rule", say: "The answer argues against a requirement the question set.", sentences: broken });
    return out;
  }

  // What went wrong: record and append a version only when a judged answer is weak.
  function shouldRecord(sessions) {
    const packet = Array.isArray(sessions);
    const questions = {};
    let weak = 0;
    if (packet) {
      sessions.forEach((s, si) => {
        const answers = (s && s.answers) || [];
        answers.forEach((a, ai) => {
          const id = "s" + si + "a" + ai;
          if (a && (a.state === "mis-heard" || a.state === "both-sides")) {
            questions[id + "_skipped"] = {
              type: "noul",
              instructions: "Mis-heard or both-sides is not a judged answer.",
              value: true,
            };
            return;
          }
          const named = faults((a && a.text) || "", (a && a.question) || "");
          const tips = (a && a.tips) || [];
          const tipWeak = tips.length > 0 && !(tips.length === 1 && /^Clear and direct/.test(String(tips[0])));
          const isWeak = named.length > 0 || tipWeak;
          if (isWeak) weak++;
          questions[id + "_weak"] = {
            type: "noul",
            instructions: isWeak ? "The answer has a named fault or a real tip." : "Nothing to record on this answer.",
            value: isWeak,
          };
        });
      });
    }
    if (packet && Object.keys(questions).length === 0) {
      questions.none = {
        type: "noul",
        instructions: "No judged answer was supplied.",
        value: false,
      };
    }
    const sim = think({
      id: "record",
      asks: "judge",
      goal: "Record a mistake only when a judged answer is weak. Append a version note. Do not edit a diamond rule.",
      policy: "Maturity is an appended version only. Mis-heard and both-sides answers are not evidence. Whether to record is code, not a further question.",
      evidence: { sessions: packet ? sessions.length : null, weak: packet ? weak : null },
      questions: packet ? questions : {
        missing: {
          type: "noul",
          instructions: "No session list was supplied.",
          unresolved: true,
          value: false,
        },
      },
    });
    if (!packet || !usable(sim)) return { record: false, appendVersion: false };
    if (!anyTrue(sim, "_weak")) return { record: false, appendVersion: false };
    return { record: true, appendVersion: true };
  }

  globalThis.KompasJev = { cacheDecision, allowModel, anchorFor, shouldRecord, faults, questionParts, missingParts, designAsk, designTold, ruleBroken, storyDrift, PAST_CLAIM, PAST_VERB, PROOF, BASE, IRREGULAR, baseOf };
})();
