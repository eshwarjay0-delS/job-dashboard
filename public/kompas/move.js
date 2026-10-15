/* The page move.html: carries a person's Kompas data from one address to another in a file they hold.
   What is carried and how two copies are joined is in move-core.js (KompasMove). This file reads and writes the browser's
   stores and nothing else: no network call is made, and the data never leaves the person's computer except in the file
   they download themselves. */
(() => {
  const M = window.KompasMove, $ = (id) => document.getElementById(id);
  const say = (text, bad) => { const el = $("mvMsg"); if (el) { el.textContent = text; el.classList.toggle("bad", !!bad); } };

  const readLocal = () => { const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (M.wanted(k)) out[k] = localStorage.getItem(k); } return out; };

  // MarketFit has a SECOND data family that perfACT's original export cannot
  // see: corrected dictation, learned words, language, and full transcripts.
  // These exact keys are the only MarketFit browser preferences we carry.
  // Never export arbitrary localStorage: it may contain credentials or tokens.
  const MF_KEYS = new Set(["mf_flow_history", "mf_flow_hint", "mf_flow_learned", "mf_flow_lang"]);
  const MF_DB = "mf_kompas_transcripts", MF_STORE = "sessions";
  const readMfLocal = () => {
    const out = {};
    for (const key of MF_KEYS) { const value = localStorage.getItem(key); if (value !== null) out[key] = value; }
    return out;
  };
  const mfWrong = (file) => {
    // Rule files in the export are descriptive references. Import must never
    // eval code or overwrite an installed engine configuration.
    if (file.enginePolicy && (typeof file.enginePolicy !== "object" ||
      file.enginePolicy.kind !== "kompas-engine-policy" ||
      Number(file.enginePolicy.version) !== 2)) return "Unsupported engine contract.";
    if (!file.marketfit) return "";
    const mf = file.marketfit;
    if (!mf || typeof mf !== "object" || Array.isArray(mf)) return "Invalid MarketFit records.";
    if (!mf.localStorage || typeof mf.localStorage !== "object" || Array.isArray(mf.localStorage)) return "Invalid MarketFit preferences.";
    for (const [key, value] of Object.entries(mf.localStorage)) {
      if (!MF_KEYS.has(key) || typeof value !== "string") return "The archive contains an unsupported preference.";
    }
    if (mf.databases && (typeof mf.databases !== "object" || Array.isArray(mf.databases))) return "Invalid MarketFit database.";
    for (const [name, stores] of Object.entries(mf.databases || {})) {
      if (name !== MF_DB || !stores || typeof stores !== "object" || Array.isArray(stores) ||
        Object.keys(stores).some(k => k !== MF_STORE)) return "Unsupported MarketFit data store.";
      for (const row of stores[MF_STORE] || []) {
        if (!row || typeof row !== "object" || !row.value || typeof row.value !== "object" ||
          typeof row.value.id !== "string" || row.value.id.length > 150) return "Invalid transcript record.";
      }
    }
    return "";
  };
  function openMf() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(MF_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(MF_STORE))
          req.result.createObjectStore(MF_STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function readMarketFit() {
    const localStorage = readMfLocal(), databases = {};
    if (!indexedDB.databases) return { localStorage, databases, incomplete: "IndexedDB listing unsupported: MarketFit transcripts could not be included." };
    const names = new Set((await indexedDB.databases()).map(row => row.name));
    if (names.has(MF_DB)) {
      const db = await openMf();
      try {
        if (!db.objectStoreNames.contains(MF_STORE)) return { localStorage, databases, incomplete: "Transcript table missing." };
        const store = db.transaction(MF_STORE, "readonly").objectStore(MF_STORE);
        const [keys, values] = await Promise.all([done(store.getAllKeys()), done(store.getAll())]);
        databases[MF_DB] = { [MF_STORE]: await Promise.all(values.map(async (v, i) => ({ key: keys[i], value: await pack(v) }))) };
      } finally { db.close(); }
    }
    return { localStorage, databases };
  }
  async function importMarketFit(file) {
    const mf = file.marketfit;
    if (!mf) return { preferences: 0, transcripts: 0, full: 0 };
    let preferences = 0, transcripts = 0, full = 0;
    for (const [key, value] of Object.entries(mf.localStorage || {})) {
      const merged = M.mergeValue(localStorage.getItem(key), value);
      if (merged.action === "added" || merged.action === "merged") {
        try { localStorage.setItem(key, merged.value); preferences++; } catch { full++; }
      }
    }
    for (const [name, stores] of Object.entries(mf.databases || {})) {
      if (name !== MF_DB) continue;
      const list = stores[MF_STORE] || [];
      if (!list.length) continue;
      const db = await openMf();
      try {
        const tx = db.transaction(MF_STORE, "readwrite");
        const store = tx.objectStore(MF_STORE);
        const have = new Set((await done(store.getAllKeys())).map(String));
        for (const row of list) if (!have.has(String(row.key))) {
          const value = unpack(row.value);
          if (!value || value.id !== row.key) { full++; continue; }
          store.add(value); transcripts++;
        }
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
      } finally { db.close(); }
    }
    return { preferences, transcripts, full };
  }


  // A stored value as text for the file, and back. A recording or an uploaded document is bytes, so it is carried as such.
  async function pack(v) {
    if (v instanceof Blob) return { $blob: M.toB64(new Uint8Array(await v.arrayBuffer())), type: v.type, name: v.name || "" };
    if (v instanceof ArrayBuffer) return { $bytes: M.toB64(new Uint8Array(v)) };
    if (ArrayBuffer.isView(v)) return { $bytes: M.toB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)), view: v.constructor.name };
    if (v instanceof Date) return { $date: v.toISOString() };
    if (Array.isArray(v)) return Promise.all(v.map(pack));
    if (v && typeof v === "object") { const out = {}; for (const [k, x] of Object.entries(v)) out[k] = await pack(x); return out; }
    return v;
  }
  function unpack(v) {
    if (Array.isArray(v)) return v.map(unpack);
    if (v && typeof v === "object") {
      if (typeof v.$blob === "string") { const bytes = M.fromB64(v.$blob); return v.name ? new File([bytes], v.name, { type: v.type || "" }) : new Blob([bytes], { type: v.type || "" }); }
      if (typeof v.$bytes === "string") { const bytes = M.fromB64(v.$bytes); const View = v.view && typeof window[v.view] === "function" ? window[v.view] : null; return View ? new View(bytes.buffer) : bytes.buffer; }
      if (typeof v.$date === "string") return new Date(v.$date);
      const out = {}; for (const [k, x] of Object.entries(v)) out[k] = unpack(x); return out;
    }
    return v;
  }

  const done = (request) => new Promise((res, rej) => { request.onsuccess = () => res(request.result); request.onerror = () => rej(request.error); });
  // Which of Kompas's databases are in this browser. Looked up, never opened blind: opening a missing one creates it empty.
  async function existing() {
    if (!indexedDB.databases) return null;                           // this browser cannot say: the databases are left alone
    const names = new Set((await indexedDB.databases()).map((d) => d.name));
    return Object.keys(M.SCHEMA).filter((n) => names.has(n));
  }
  // Opened the way Kompas opens it, so a database made here is the one Kompas expects to find.
  function open(name) {
    const { version, stores } = M.SCHEMA[name];
    return new Promise((res, rej) => {
      const r = indexedDB.open(name, version);
      r.onupgradeneeded = () => { for (const s of stores) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function readDatabases() {
    const names = await existing(), out = {};
    if (!names) return { databases: {}, unread: true };
    for (const name of names) {
      const db = await open(name); out[name] = {};
      for (const store of M.SCHEMA[name].stores.filter((s) => db.objectStoreNames.contains(s))) {
        const tx = db.transaction(store, "readonly").objectStore(store);
        const [keys, values] = await Promise.all([done(tx.getAllKeys()), done(tx.getAll())]);
        out[name][store] = [];
        for (let i = 0; i < keys.length; i++) out[name][store].push({ key: keys[i], value: await pack(values[i]) });
      }
      db.close();
    }
    return { databases: out, unread: false };
  }

  /* Everything Kompas keeps in this browser, on this address. */
  async function exportAll() {
    const { databases, unread } = await readDatabases();
    const marketfit = await readMarketFit();
    return { kind: M.KIND, version: M.VERSION, made: new Date().toISOString(), from: location.origin,
      localStorage: readLocal(), databases, marketfit,
      enginePolicy: window.KompasEnginePolicy || null,
      ...(unread ? { note: "The browser could not list perfACT databases. The original prepared pages or documents may be absent." } : {}),
      ...(marketfit.incomplete ? { marketfitNote: marketfit.incomplete } : {}) };
  }
  const rowsIn = (file) => Object.values(file.databases || {}).reduce((n, db) => n + Object.values(db).reduce((m, rows) => m + rows.length, 0), 0);

  /* Bring a file's data in beside what is here. Nothing here is replaced (move-core.js). Returns what was done. */
  async function importAll(file) {
    const wrong = M.refuse(file) || mfWrong(file); if (wrong) throw new Error(wrong);
    const plan = M.plan(file, readLocal());
    // A browser gives each address a few megabytes. When that runs out the rest is counted and said, never dropped in silence.
    let full = 0;
    for (const row of plan.write) { try { localStorage.setItem(row.key, row.value); } catch { full++; } }
    let rows = 0;
    for (const [name, stores] of Object.entries(file.databases || {})) {
      const db = await open(name);
      for (const [store, list] of Object.entries(stores)) {
        if (!db.objectStoreNames.contains(store) || !list.length) continue;
        const tx = db.transaction(store, "readwrite"), os = tx.objectStore(store);
        const have = new Set((await done(os.getAllKeys())).map((k) => JSON.stringify(k)));
        for (const row of list) if (!have.has(JSON.stringify(row.key))) { os.put(unpack(row.value), row.key); rows++; }
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
      }
      db.close();
    }
    const mf = await importMarketFit(file);
    return { added: plan.added, merged: plan.merged, same: plan.same, kept: plan.kept,
      rows, full: full + mf.full, mfPreferences: mf.preferences, mfTranscripts: mf.transcripts };
  }

  function download(name, object) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(object)], { type: "application/json" }));
    a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const words = (c) => [[c.sessions, "session"], [c.transcripts, "transcript"], [c.questions, "question"], [c.documents, "document"], [c.prepared, "prepared answer set"]]
    .filter(([n]) => n).map(([n, w]) => n + " " + w + (n === 1 ? "" : "s")).join(", ") || "nothing yet";
  const stamp = () => new Date().toISOString().slice(0, 10);

  window.KompasMovePage = { exportAll, importAll, readLocal };
  if (!$("mvOut")) return;

  let chosen = null;
  $("mvHere").textContent = location.host;
  $("mvHas").textContent = words(M.count(readLocal()));
  $("mvOut").addEventListener("click", async () => {
    try { const file = await exportAll(); download(`kompas-data-${location.hostname}-${stamp()}.json`, file); say(`Downloaded: ${words(M.count(file.localStorage))}${rowsIn(file) ? ", and " + rowsIn(file) + " prepared pages and files" : ""}, ${Object.keys(file.marketfit.localStorage).length} MarketFit preferences and ${(file.marketfit.databases[MF_DB]?.[MF_STORE] || []).length} complete MarketFit transcripts. Keep this original archive as a backup.` + (file.note ? " " + file.note : "") + (file.marketfitNote ? " " + file.marketfitNote : "")); }
    catch (e) { say("Could not read the data here: " + String((e && e.message) || e), true); }
  });
  $("mvFile").addEventListener("change", async (e) => {
    chosen = null; $("mvIn").disabled = true; $("mvPlan").textContent = "";
    const picked = e.target.files && e.target.files[0]; if (!picked) return;
    try {
      const file = JSON.parse(await picked.text()), wrong = M.refuse(file);
      if (wrong) return say(wrong, true);
      const extra = mfWrong(file); if (extra) return say(extra, true);
      if (file.from === location.origin) return say("This file was made on this same address. Open this page on the other address to bring it in there.", true);
      const plan = M.plan(file, readLocal());
      chosen = file; $("mvIn").disabled = false;
      $("mvPlan").textContent = `From ${String(file.from || "").replace(/^https?:\/\//, "")}, made ${String(file.made || "").slice(0, 10)}: ${words(M.count(file.localStorage))}. ` +
        `${plan.added + plan.merged} saved things will be added here, ${plan.same} are here already` + (plan.kept.length ? `, and ${plan.kept.length} settings keep the value they have here.` : ".") + " Nothing here is replaced.";
      say("");
    } catch { say("That file could not be read as a Kompas data file.", true); }
  });
  $("mvIn").addEventListener("click", async () => {
    if (!chosen) return;
    $("mvIn").disabled = true;
    try {
      download(`kompas-here-before-${location.hostname}-${stamp()}.json`, await exportAll());   // what is here now, kept in a file first
      const did = await importAll(chosen);
      $("mvHas").textContent = words(M.count(readLocal()));
      say(`Done. ${did.added + did.merged} perfACT items merged${did.rows ? ", with " + did.rows + " prepared pages and files" : ""}; ${did.mfPreferences} MarketFit settings and ${did.mfTranscripts} transcripts imported. A copy of what was here before is in your downloads. Open Kompas to see them.` +
        (did.full ? ` ${did.full} could not be saved: this browser's store for this address is full. Delete old transcripts here and bring the file in again; what is already in is not added twice.` : ""), !!did.full);
      chosen = null; $("mvFile").value = ""; $("mvPlan").textContent = "";
    } catch (e) { say("Nothing more was changed. " + String((e && e.message) || e), true); $("mvIn").disabled = false; }
  });
})();
