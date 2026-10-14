/* The page move.html: carries a person's Kompas data from one address to another in a file they hold.
   What is carried and how two copies are joined is in move-core.js (KompasMove). This file reads and writes the browser's
   stores and nothing else: no network call is made, and the data never leaves the person's computer except in the file
   they download themselves. */
(() => {
  const M = window.KompasMove, $ = (id) => document.getElementById(id);
  const say = (text, bad) => { const el = $("mvMsg"); if (el) { el.textContent = text; el.classList.toggle("bad", !!bad); } };

  const readLocal = () => { const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (M.wanted(k)) out[k] = localStorage.getItem(k); } return out; };

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
    return { kind: M.KIND, version: M.VERSION, made: new Date().toISOString(), from: location.origin, localStorage: readLocal(), databases, ...(unread ? { note: "This browser could not list its databases, so prepared answers and uploaded files are not in this file." } : {}) };
  }
  const rowsIn = (file) => Object.values(file.databases || {}).reduce((n, db) => n + Object.values(db).reduce((m, rows) => m + rows.length, 0), 0);

  /* Bring a file's data in beside what is here. Nothing here is replaced (move-core.js). Returns what was done. */
  async function importAll(file) {
    const wrong = M.refuse(file); if (wrong) throw new Error(wrong);
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
    return { added: plan.added, merged: plan.merged, same: plan.same, kept: plan.kept, rows, full };
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
    try { const file = await exportAll(); download(`kompas-data-${location.hostname}-${stamp()}.json`, file); say(`Downloaded: ${words(M.count(file.localStorage))}${rowsIn(file) ? ", and " + rowsIn(file) + " prepared pages and files" : ""}. Now open this page on the address you are keeping and choose that file there.` + (file.note ? " " + file.note : "")); }
    catch (e) { say("Could not read the data here: " + String((e && e.message) || e), true); }
  });
  $("mvFile").addEventListener("change", async (e) => {
    chosen = null; $("mvIn").disabled = true; $("mvPlan").textContent = "";
    const picked = e.target.files && e.target.files[0]; if (!picked) return;
    try {
      const file = JSON.parse(await picked.text()), wrong = M.refuse(file);
      if (wrong) return say(wrong, true);
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
      say(`Done. ${did.added + did.merged - did.full} saved things were added${did.rows ? ", with " + did.rows + " prepared pages and files" : ""}. A copy of what was here before is in your downloads. Open Kompas to see them.` +
        (did.full ? ` ${did.full} could not be saved: this browser's store for this address is full. Delete old transcripts here and bring the file in again; what is already in is not added twice.` : ""), !!did.full);
      chosen = null; $("mvFile").value = ""; $("mvPlan").textContent = "";
    } catch (e) { say("Nothing more was changed. " + String((e && e.message) || e), true); $("mvIn").disabled = false; }
  });
})();
