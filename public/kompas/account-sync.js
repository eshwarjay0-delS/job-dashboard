/* Account-scoped, offline-aware Kompas interview list synchronization.
 * Shared by browser and desktop renderer. No global browser list is treated as
 * authoritative until the server confirms the authenticated owner.
 */
(function (root, factory) {
  const moduleApi = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = moduleApi;
  if (root) root.KompasSessionCloud = moduleApi;
})(typeof window !== "undefined" ? window : null, function () {
  const FIELDS = new Set([
    "id","createdAt","type","jobLink","company","role","jd","resume","documents",
    "docIds","resumeId","model","language","length","tone","mode","instructions",
    "autoAnswer","autoMode","saveTranscript","interviewer","difficulty","dossierSize",
    "runAt","pausedAt","endedAt","endedBy","transcripts","bibleSyncedAt","note","site",
  ]);
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  function delta(before, after) {
    const a = new Map((Array.isArray(before) ? before : []).filter(s=>s&&s.id).map(s=>[s.id,s]));
    const b = new Map((Array.isArray(after) ? after : []).filter(s=>s&&s.id).map(s=>[s.id,s]));
    const ops = [];
    for (const [id,s] of b) {
      if (!/^[A-Za-z0-9:_-]{1,128}$/.test(id)) continue;
      const prev = a.get(id);
      const patch = {};
      for (const k of FIELDS) {
        if (k === "id") continue;
        if (Object.prototype.hasOwnProperty.call(s,k) && (!prev || !same(prev[k],s[k]))) patch[k]=s[k];
        else if (prev && Object.prototype.hasOwnProperty.call(prev,k) && !Object.prototype.hasOwnProperty.call(s,k)) patch[k]=null;
      }
      if (!prev || Object.keys(patch).length) ops.push({id,patch:{...patch,id},deleted:false});
    }
    for (const [id] of a) if (!b.has(id) && /^[A-Za-z0-9:_-]{1,128}$/.test(id)) ops.push({id,patch:{},deleted:true});
    return ops;
  }
  function combine(records, locally, pending) {
    const local = new Map((locally||[]).filter(s=>s&&s.id).map(s=>[s.id,s]));
    const output = new Map();
    const tombstones = new Set();
    for (const r of records||[]) {
      if (!r || !r.id) continue;
      if (r.deleted) { tombstones.add(r.id); continue; }
      if (!r.session) continue;
      output.set(r.id,{...(local.get(r.id)||{}),...r.session,id:r.id});
    }
    for (const [id,s] of local) {
      if (!tombstones.has(id) && !output.has(id) && pending[id] && !pending[id].deleted)
        output.set(id,{...s,...pending[id].patch});
    }
    for (const [id,op] of Object.entries(pending)) {
      if (tombstones.has(id) || op.deleted) {output.delete(id);continue;}
      if (output.has(id)) output.set(id,{...output.get(id),...op.patch});
      else if (local.has(id)) output.set(id,{...local.get(id),...op.patch});
    }
    return [...output.values()].sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
  }
  function create(opts) {
    const {storage,fetcher,read,write,render,notify,authToken} = opts;
    const prefix = "perfact.cloud.";
    const getJSON = (key,fallback) => { try{return JSON.parse(storage.getItem(key))||fallback;}catch{return fallback;} };
    const putJSON = (key,value) => {try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
    let owner="", applied=false, busy=false, requesting=null, flushing=false, importing=false, lastCheck=0, lastError=0;
    let pending={}, local=[];
    const syncStatus=(status)=>{if(typeof notify==="function")notify(status);};
    const headers=()=>{ const token=typeof authToken==="function"?authToken():""; return { "content-type":"application/json",...(token?{Authorization:"Bearer "+token}:{}) }; };
    function persist() { if(owner){putJSON(prefix+"cache."+owner,read());putJSON(prefix+"pending."+owner,pending);} }
    function queue(op) {
      const previous=pending[op.id];
      if(previous && previous.deleted) return; // a deletion is final
      pending[op.id]=op.deleted?op:{id:op.id,patch:{...(previous?.patch||{}),...op.patch},deleted:false};
    }
    function localWrite(before,after) {
      if(applied||!owner) return;
      for(const op of delta(before,after)) queue(op);
      persist();
      void flush();
    }
    function remoteWrite(next) {
      applied=true;
      try { write(next); local=next; persist(); render(); }
      finally { applied=false; }
    }
    async function api(method, body, cursor = "") {
      const url = "/api/kompas/account-sessions" + (cursor ? "?after=" + encodeURIComponent(cursor) : "");
      const response=await fetcher(url,{method,credentials:"same-origin",headers:headers(),...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"});
      if(!response.ok) throw new Error("Session synchronization unavailable ("+response.status+").");
      const parsed=await response.json();
      if(!parsed || !parsed.ok || !parsed.userId) throw new Error("Account session response unavailable.");
      return parsed;
    }
    async function refresh() {
      if(requesting) return requesting;
      requesting=(async()=>{
        const data=await api("GET");
        // Pull the entire account catalog, not only the first page.
        const seen = new Set((data.records || []).map(r => r.id));
        let cursor = data.nextCursor || "";
        while (cursor) {
          const page = await api("GET",null,cursor);
          if (page.userId !== data.userId) throw new Error("Account switched during synchronization.");
          for (const item of page.records || []) if (!seen.has(item.id)) {
            seen.add(item.id);data.records.push(item);
          }
          if (!page.nextCursor || page.nextCursor === cursor) break;
          cursor = page.nextCursor;
        }
        const nextOwner=data.userId;
        const firstPullForOwner = owner !== nextOwner;
        if(firstPullForOwner){
          if(owner)persist();
          const previous=storage.getItem(prefix+"owner")||"";
          const unscoped=read();
          if(!previous && Array.isArray(unscoped) && unscoped.length && !storage.getItem(prefix+"legacy")) {
            putJSON(prefix+"legacy",unscoped); // requires deliberate import before account upload
          } else if(previous && previous!==nextOwner && Array.isArray(unscoped)) {
            putJSON(prefix+"cache."+previous,unscoped);
          }
          owner=nextOwner;
          storage.setItem(prefix+"owner",owner);
          pending=getJSON(prefix+"pending."+owner,{});
          const cached=getJSON(prefix+"cache."+owner,[]);
          // Only this exact verified owner can reuse the current browser list.
          // A present unscoped list is authoritative on this device, even when
          // empty: unioning it with a stale cache could resurrect deleted
          // sessions after an interrupted save. When the browser's session key
          // is genuinely missing, fall back to the same-owner shadow cache.
          const sameOwner=previous===nextOwner && Array.isArray(unscoped) &&
            storage.getItem("perfact.sessions")!==null;
          local=sameOwner?unscoped:(Array.isArray(cached)?cached:[]);
        } else {local=read();}
        // A device which belonged to this same authenticated account may have
        // previously created sessions offline. Those missing from the server
        // are queued, but never infer the ownership of unscoped legacy records.
        const knownIds=new Set((data.records||[]).map(r=>r.id));
        for (const s of local) if(firstPullForOwner && !knownIds.has(s.id) && !pending[s.id]){
          const op=delta([],[s])[0];if(op)queue(op);
        }
        remoteWrite(combine(data.records||[],local,pending));
        lastCheck=Date.now();
        syncStatus({state:importing?"importing":"synced",legacy:getJSON(prefix+"legacy",[]).length,owner});
        if(Object.keys(pending).length) void flush();
        return true;
      })().catch(err=>{
        lastError=Date.now();syncStatus({state:"offline",message:err.message});
        return false;
      }).finally(()=>{requesting=null;});
      return requesting;
    }
    async function flush() {
      if(flushing || !owner) return false;
      if(!Object.keys(pending).length) return true;
      flushing=true;
      try {
        for(let round=0;round<40;round++) {
          const group=Object.values(pending).slice(0,5);
          if(!group.length) break;
          const snapshot=Object.fromEntries(group.map(x=>[x.id,JSON.stringify(x)]));
          const data=await api("POST",{operations:group});
          if(data.userId!==owner)throw new Error("Account changed during synchronization.");
          for (const op of group) if (snapshot[op.id]===JSON.stringify(pending[op.id])) delete pending[op.id];
          persist();
        }
        if(!Object.keys(pending).length) void refresh();
        return !Object.keys(pending).length;
      } catch(err) {
        lastError=Date.now();
        syncStatus({state:"offline",message:err.message});
        return false;
      } finally {flushing=false;}
    }
    async function importLegacy() {
      if(!owner || importing)return false;
      const existing=getJSON(prefix+"legacy",[]);
      if(!Array.isArray(existing) || !existing.length)return false;
      const verifiedOwner=owner;
      const current=read();
      // Imported records have no trustworthy account marker. The user must
      // deliberately import them after authenticatedUser confirms ownership.
      // Never overwrite a newer account record with an older browser snapshot.
      const currentIds=new Set(current.map(s=>s.id));
      const additions=existing.filter(s=>s && typeof s.id==="string" && !currentIds.has(s.id));
      importing=true;
      syncStatus({state:"importing",legacy:existing.length,owner});
      try {
        for(const op of delta([],additions))queue(op);
        remoteWrite([...current,...additions]);
        persist();
        // Do not remove the original offline backup until the service accepts
        // the full transfer and the verified account can read every session.
        const uploaded=await flush();
        if(!uploaded || owner!==verifiedOwner)return false;
        const loaded=await refresh();
        if(!loaded || owner!==verifiedOwner ||
            !existing.every(s=>read().some(row=>row.id===s.id)))return false;
        storage.removeItem(prefix+"legacy");
        syncStatus({state:"synced",legacy:0,owner});
        return true;
      } finally {
        importing=false;
        if(storage.getItem(prefix+"legacy"))
          syncStatus({state:"import-failed",legacy:existing.length,owner,
            message:"Your earlier sessions remain safely on this device. Account transfer could not be confirmed; retry Import local sessions."});
      }
    }
    function start() {
      void refresh();
      setInterval(()=>{if(typeof document==="undefined" || !document.hidden)void refresh();},12000);
      if(typeof window!=="undefined"){
        window.addEventListener("focus",()=>{void refresh();});
        document.addEventListener("visibilitychange",()=>{if(!document.hidden)void refresh();});
      }
    }
    function signOutLocal() {
      if(owner)persist();owner="";pending={};
      storage.removeItem(prefix+"owner"); // never show previous owner's cached sessions
      applied=true;try{write([]);render();}finally{applied=false;}
    }
    return {start,refresh,flush,localWrite,importLegacy,signOutLocal,
      get owner(){return owner;},get applying(){return applied;},
      get pendingCount(){return Object.keys(pending).length;}};
  }
  return {delta,combine,create};
});
