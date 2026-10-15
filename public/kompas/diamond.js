/* Prevents a later change from calling the model for a derived level, or from editing a diamond rule by appending a version.
   The rules are frozen. A version is a new record. It does not replace these. docs/REGULATIONS.md is the policy. */
(() => {
  const LADDER = Object.freeze(["hr", "technical_hr", "analyst", "engineer", "developer", "supervisor", "architect", "lead", "director"]);
  const ANCHORS = Object.freeze(["engineer", "director"]);
  const MAP = Object.freeze({
    hr: "engineer",
    technical_hr: "engineer",
    analyst: "engineer",
    engineer: "engineer",
    developer: "director",
    supervisor: "director",
    architect: "director",
    lead: "director",
    director: "director",
  });
  const FROM_ENGINEER = Object.freeze(["analyst", "technical_hr", "hr"]);
  const FROM_DIRECTOR = Object.freeze(["lead", "supervisor", "architect", "developer"]);
  const RULES = Object.freeze([
    Object.freeze({ id: "two-calls", text: "The model is called only for Engineer and Director, once per question." }),
    Object.freeze({ id: "from-director", text: "Lead, Supervisor, Architect, and Developer are derived from Director. No model call for a derived level." }),
    Object.freeze({ id: "from-engineer", text: "Analyst, Tech HR, and HR are derived from Engineer. No model call for a derived level." }),
    Object.freeze({ id: "two-caches", text: "Both anchors are stored on the server and in the local cache beside the dossier." }),
    Object.freeze({ id: "instant-switch", text: "Switching level is instant and does not call the model." }),
    Object.freeze({ id: "prose", text: "The earlier answer prose stays. No side-heading prompt." }),
    Object.freeze({ id: "storage-keys", text: "Storage keys perfact.* are not renamed." }),
    Object.freeze({ id: "no-client-credential", text: "The client holds no model credential." }),
    Object.freeze({ id: "append-only", text: "Maturity is an appended version entry. A version does not change a diamond rule." }),
    Object.freeze({ id: "claude-closed", text: "Claude does not edit the diamond module, the level map, or the live answer path. A person changes a diamond rule, not Claude." }),
    Object.freeze({ id: "faster-each-time", text: "Each time the same question is generated again, the result is faster, uses fewer tokens, and is at least as precise. Quality does not drop to save tokens. The first time, Engineer and Director are written once. Every later time, the cache answers. A derived level never spends a model call." }),
    Object.freeze({ id: "session-dossier", text: "Each session has its own dossier, written as Markdown, and its own levels cache. The dossier key is perfact.dossier. plus the session id. The levels cache beside it is perfact.levels. plus the session id. Session A does not read session B's dossier. A shared maturity store, keyed by maturity:v1: plus the question and the resume facts, holds anchors already produced for that content. When a new session asks for content that store already has, the model is not called." }),
  ]);
  const CYCLE = "Creeks, ponds, lakes, rivers, oceans, belts. Each shipped change appends a version and starts from the last. A version does not change a diamond rule.";
  const WATERS = Object.freeze(["creek", "pond", "lake", "river", "ocean", "belt"]);
  const VERSIONS = Object.freeze([
    Object.freeze({
      date: "2026-10-01",
      version: "2026-10-01",
      water: "creek",
      note: "Two anchors. Engineer and Director are written once per question. The other levels are derived and cached. The regulations are the base policy.",
    }),
    Object.freeze({
      date: "2026-10-01",
      version: "2026-10-01.2",
      water: "pond",
      note: "What went wrong, on the Parakeet sessions already on disk: 61 could be reviewed, fillers sat at 8.6 per 100 words, 511 openings started before the point, 47 answers stopped before a result. The coaching transcripts already saved say a labelled story shell sounds recited. Clarity stays the earlier prose: say the point first, keep the order, land the ending. No side headings.",
    }),
    Object.freeze({
      date: "2026-10-01",
      version: "2026-10-01.3",
      water: "lake",
      note: "What went wrong, from the Parakeet exports and the patterns note: answers open on a filler, end on so yeah, or wear a Situation label. After the two anchors are chosen, those are removed before the text is shown. The remaining sentences stay. No side headings. A repeat of the same question spends no tokens.",
    }),
    Object.freeze({
      date: "2026-10-01",
      version: "2026-10-01.4",
      water: "river",
      note: "Each session keeps its own Markdown dossier and its own levels cache. The same question and the same resume facts, already answered, are served from the shared maturity store. No model call. No side headings.",
    }),
  ]);
  const POLICY = "docs/REGULATIONS.md";
  const ALLOWED = new Set(["date", "version", "water", "note"]);

  const held = (a) => !!(a && (a.prose || (a.lead && a.points)));

  function resolve(level, peerOf) {
    if (level === "peer") return MAP[peerOf] ? peerOf : "engineer";
    return MAP[level] ? level : "engineer";
  }

  // What one level may do. A derived level, and Peer, schedule no model call of their own.
  // anchorCall names the Engineer or Director prose still missing, never the derived level.
  function plan(level, cache, peerOf) {
    const who = resolve(level, peerOf);
    const from = MAP[who];
    const derived = who !== "engineer" && who !== "director";
    const have = held(cache && cache[from]);
    const other = from === "engineer" ? "director" : "engineer";
    return {
      level: who,
      from,
      derived,
      derivedCall: false,
      calls: (derived || level === "peer" || have) ? 0 : 1,
      anchorCall: have ? null : from,
      ready: have,
      other,
      otherReady: held(cache && cache[other]),
    };
  }

  // The whole question: at most the two anchors, once. Derived levels add nothing.
  function questionPlan(cache) {
    const levels = ANCHORS.filter(a => !held(cache && cache[a]));
    return { calls: levels.length, levels: levels.slice(), derivedCalls: 0 };
  }

  function appendVersion(entry, onto) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("a version is a record");
    if ("rules" in entry || "rule" in entry || "diamond" in entry) throw new Error("a version cannot carry a rule");
    for (const k of Object.keys(entry)) if (!ALLOWED.has(k)) throw new Error("a version entry is date, version, water, and note");
    if (!entry.date || !entry.note) throw new Error("a version needs a date and a note");
    const water = entry.water || "creek";
    if (!WATERS.includes(water)) throw new Error("water is creek, pond, lake, river, ocean, or belt");
    const base = Array.isArray(onto) ? onto : VERSIONS;
    return Object.freeze([...base, Object.freeze({
      date: String(entry.date),
      version: String(entry.version || entry.date),
      water,
      note: String(entry.note),
    })]);
  }

  function publicRecord() {
    return {
      policy: POLICY,
      version: VERSIONS[VERSIONS.length - 1].version,
      immutable: true,
      cycle: CYCLE,
      rules: RULES.map(r => ({ id: r.id, text: r.text })),
      versions: VERSIONS.map(v => ({ date: v.date, version: v.version, water: v.water, note: v.note })),
      now: [
        "Live answers use the earlier prose, with no side headings.",
        "Engineer and Director are written once per question.",
        "The other levels are derived in code and shown from cache.",
        "Anchors are kept on the server and beside the dossier on the device.",
      ],
    };
  }

  globalThis.KompasDiamond = {
    LADDER, ANCHORS, MAP, FROM_ENGINEER, FROM_DIRECTOR, RULES, VERSIONS, WATERS, CYCLE, POLICY,
    plan, questionPlan, appendVersion, publicRecord, resolve,
  };
})();
