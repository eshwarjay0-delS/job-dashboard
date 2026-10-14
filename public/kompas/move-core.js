/* Kompas move core: what is carried from one address to another, and how two copies are joined.
   The page move.html loads this file (KompasMove); move.test.mjs runs the same file. Pure code: no DOM, no network.

   The owner, 12 Oct 2026: "can you combine perfact kompas and job dashboard to & one place? All the data transcripts and
   updates from over there as well."

   WHY THERE IS ANYTHING TO MOVE. Kompas keeps sessions, transcripts, the Question Bank, resumes, documents and prepared
   answers in the browser, and a browser keeps a separate store for every address. So what was done on
   perfact-ten.vercel.app is not there on the MarketFit address, though both show the same Kompas. No server holds a copy:
   the only way across is a file the person carries.

   THE MISTAKES THIS FILE PREVENTS
   1. Losing what is already here. Bringing data in never replaces a value. A list gets the entries it does not have yet
      (by their id); a setting that differs keeps the value that is here.
   2. Opening a store that does not exist. Asking the browser for a missing database creates an empty one, and Kompas
      would then find a database with no tables in it. SCHEMA says what Kompas itself creates, and the page looks before
      it opens.
   3. Trusting a file. Only keys Kompas itself writes are accepted, and only its two databases. */
(() => {
  const KIND = "kompas-data", VERSION = 1, PREFIX = "perfact.";
  // Not carried: the heartbeat of a tab that is open now, a note about the other address's theme, and where the call runs
  // (browser, desktop app or phone). That last one is a choice about one address on one computer. Carried on 12 Oct 2026,
  // it set the owner's Connect dialog on the MarketFit address to "Desktop app", a route that could not open there.
  const LEFT = /^perfact\.(?:live\.|themeFrom$|connectApp$)/;
  // The databases Kompas creates, as it creates them (app.js and anchors.js; move.test.mjs fails if they change).
  const SCHEMA = { "perfact-dossier": { version: 2, stores: ["d", "levels"] }, "perfact-files": { version: 1, stores: ["files"] } };
  const wanted = (key) => typeof key === "string" && key.startsWith(PREFIX) && !LEFT.test(key);

  const parse = (s) => { try { return { ok: true, v: JSON.parse(s) }; } catch { return { ok: false, v: null }; } };
  const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const idOf = (x) => (isObj(x) && (typeof x.id === "string" || typeof x.id === "number") ? String(x.id) : null);
  // The entries of `there` that `here` does not have: by id when they have one, by content when they do not.
  function union(here, there) {
    const ids = new Set(here.map(idOf).filter((x) => x !== null)), whole = new Set(here.map((x) => JSON.stringify(x)));
    const add = there.filter((x) => { const id = idOf(x); return id !== null ? !ids.has(id) : !whole.has(JSON.stringify(x)); });
    return { value: [...here, ...add], added: add.length };
  }
  /* One stored value from each address, joined. `here` wins wherever the two disagree.
     action: "added" (it was not here), "merged" (entries were added to what is here), "same", "kept" (they differ and
     cannot be joined, so what is here stays). */
  function mergeValue(here, there) {
    const same = { value: here, action: "same", added: 0 };
    if (there === null || there === undefined) return same;
    if (here === null || here === undefined) return { value: there, action: "added", added: 1 };
    if (here === there) return same;
    const a = parse(here), b = parse(there);
    if (a.ok && b.ok) {
      if (Array.isArray(a.v) && Array.isArray(b.v)) { const u = union(a.v, b.v); return u.added ? { value: JSON.stringify(u.value), action: "merged", added: u.added } : same; }
      if (isObj(a.v) && isObj(b.v)) {
        if (Array.isArray(a.v.items) && Array.isArray(b.v.items)) { const u = union(a.v.items, b.v.items); return u.added ? { value: JSON.stringify({ ...a.v, items: u.value }), action: "merged", added: u.added } : same; }
        const extra = Object.keys(b.v).filter((k) => !Object.prototype.hasOwnProperty.call(a.v, k));
        if (extra.length) return { value: JSON.stringify({ ...a.v, ...Object.fromEntries(extra.map((k) => [k, b.v[k]])) }), action: "merged", added: extra.length };
      }
    }
    return { value: here, action: "kept", added: 0 };
  }

  // What a store holds, in the words a person uses for it.
  function count(local) {
    const list = (key, inner) => { const p = parse(local[key] || "null"); const v = inner && isObj(p.v) ? p.v[inner] : p.v; return Array.isArray(v) ? v.length : 0; };
    const keys = Object.keys(local).filter(wanted);
    return { sessions: list("perfact.sessions"), transcripts: keys.filter((k) => k.startsWith("perfact.log.")).length, questions: list("perfact.qbank", "items"),
      documents: list("perfact.docs"), prepared: keys.filter((k) => /^perfact\.(?:dossier|levels)\./.test(k)).length, everything: keys.length };
  }

  /* Is this a file this page made? Returns "" when it is, or what is wrong with it in plain words. */
  function refuse(file) {
    if (!isObj(file) || file.kind !== KIND) return "This is not a Kompas data file.";
    if (file.version !== VERSION) return "This file was made by a different version of this page.";
    if (!isObj(file.localStorage)) return "The file holds no saved data.";
    for (const [k, v] of Object.entries(file.localStorage)) if (!wanted(k) || typeof v !== "string") return "The file holds something Kompas does not save: " + String(k).slice(0, 40);
    for (const name of Object.keys(isObj(file.databases) ? file.databases : {})) {
      if (!SCHEMA[name]) return "The file holds a database Kompas does not use: " + String(name).slice(0, 40);
      for (const store of Object.keys(file.databases[name] || {})) if (!SCHEMA[name].stores.includes(store)) return "The file holds a table Kompas does not use: " + String(store).slice(0, 40);
    }
    return "";
  }

  /* What bringing this file in would do to the saved data here, key by key, before anything is written. */
  function plan(file, here) {
    const rows = Object.keys(file.localStorage).filter(wanted).sort().map((key) => ({ key, ...mergeValue(Object.prototype.hasOwnProperty.call(here, key) ? here[key] : null, file.localStorage[key]) }));
    const of = (action) => rows.filter((r) => r.action === action);
    return { rows, write: rows.filter((r) => r.action === "added" || r.action === "merged"), added: of("added").length, merged: of("merged").length, same: of("same").length, kept: of("kept").map((r) => r.key) };
  }

  // Bytes as text, for a file a person carries: a recording or an uploaded document is not text.
  const toB64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = (text) => { const s = atob(text), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };

  globalThis.KompasMove = { KIND, VERSION, PREFIX, SCHEMA, wanted, mergeValue, count, refuse, plan, toB64, fromB64 };
})();
