/* Prevents a level change from calling the model again. The two anchors sit in perfact-dossier, store "levels", beside store "d". */
(() => {
  const db = {
    _p: null,
    open() {
      if (this._p) return this._p;
      this._p = new Promise((res, rej) => {
        const r = indexedDB.open("perfact-dossier", 2);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains("d")) d.createObjectStore("d");
          if (!d.objectStoreNames.contains("levels")) d.createObjectStore("levels");
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return this._p;
    },
    async get(key) {
      try {
        const d = await this.open();
        return await new Promise(res => {
          const rq = d.transaction("levels", "readonly").objectStore("levels").get(key);
          rq.onsuccess = () => res(rq.result || null);
          rq.onerror = () => res(null);
        });
      } catch { return null; }
    },
    async put(key, value) {
      try {
        const d = await this.open();
        await new Promise(res => {
          const tx = d.transaction("levels", "readwrite");
          tx.objectStore("levels").put(value, key);
          tx.oncomplete = res;
          tx.onerror = res;
        });
      } catch {}
    },
  };

  function keyOf(question, role, resume, sessionId) {
    const L = globalThis.KompasLevels;
    if (!L) return "";
    return sessionId ? L.sessionLevelsKey(sessionId, question, resume) : L.maturityKey(question, resume);
  }

  async function load(question, role, resume, sessionId) {
    const key = keyOf(question, role, resume, sessionId);
    if (!key) return { key: "", anchors: null, source: "miss" };
    const local = await db.get(key);
    if (local && local.engineer && local.director) return { key, anchors: local, source: "session" };
    let remote = null;
    try {
      const r = await fetch("/api/levels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookup: true, question, role, resume, sessionId: sessionId || "" }),
      });
      remote = await r.json();
    } catch {}
    const anchors = (remote && remote.anchors) || local || null;
    if (anchors && (anchors.engineer || anchors.director)) await db.put(key, anchors);
    return { key, anchors, source: remote && remote.anchors ? (remote.source || "maturity") : (local ? "session" : "miss") };
  }

  async function save(question, role, resume, anchors, sessionId) {
    const key = keyOf(question, role, resume, sessionId);
    if (!key || !anchors) return "";
    await db.put(key, anchors);
    const prose = {};
    if (anchors.engineer && anchors.engineer.prose) prose.engineer = anchors.engineer.prose;
    if (anchors.director && anchors.director.prose) prose.director = anchors.director.prose;
    if (prose.engineer || prose.director) {
      try {
        await fetch("/api/levels", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question, role, resume, sessionId: sessionId || "", prose }),
        });
      } catch {}
    }
    return key;
  }

  async function fetchProse(question, anchor, body) {
    const D = globalThis.KompasDiamond;
    if (!D || !D.ANCHORS.includes(anchor)) return "";
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(body || {}),
        stream: false,
        question,
        config: { ...((body && body.config) || {}), interviewer: anchor },
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    if (!data || data.degraded || data.noQuestion || data.busy) return "";
    return String(data.text || "");
  }

  globalThis.KompasAnchors = { load, save, fetchProse, db };
})();
