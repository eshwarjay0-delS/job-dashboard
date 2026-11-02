"use strict";
// Five independent regression folds for the browser-cookie/native-Bearer split.
// Synthetic identity fixtures only; no user data, stored secrets or live calls.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { create } = require("../../public/kompas/account-sync.js");

function harness({ initial = [], records = [], owner = "signed-in-owner", fetcher, recoverAuth, previousOwner } = {}) {
  const data = new Map([["perfact.sessions", JSON.stringify(initial)]]);
  if (previousOwner) data.set("perfact.cloud.owner", previousOwner);
  let rows = initial, fetches = [], notices = [];
  const storage = {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
  const network = async (url, opts) => {
    fetches.push({ url, opts });
    if (fetcher) return fetcher(url, opts);
    return { ok:true, status:200, json:async()=>({ok:true,userId:owner,records}) };
  };
  const sync = create({
    storage, fetcher:network,
    read:()=>rows,
    write:next=>{rows=next;storage.setItem("perfact.sessions",JSON.stringify(next));},
    render:()=>{}, notify:state=>notices.push(state), recoverAuth
  });
  return { sync, data, notices, fetches, get rows(){return rows;} };
}
const OK = (records, userId="signed-in-owner") =>
  ({ ok:true, status:200, json:async()=>({ok:true,userId,records}) });
const UNAUTHORIZED = { ok:false, status:401 };
const roles = ["BNYMellon","LPL Financial","HCL tech"].map((company,i)=>({
  id:"s"+(i+1),session:{id:"s"+(i+1),company,role:["Security Analyst III","Security Engineer","Senior CyberArk Engineer"][i],createdAt:i+1}
}));

test("FOLD 1: signed-in browser loads all cloud interviews without injecting stale Authorization",async()=>{
  const h=harness({ records:roles });
  assert.equal(await h.sync.refresh(),true);
  assert.equal(h.rows.length,3);
  assert.deepEqual(h.rows.map(s=>s.company),["HCL tech","LPL Financial","BNYMellon"]);
  assert.equal(h.fetches.length,1);
  const request=h.fetches[0].opts;
  assert.equal(request.credentials,"same-origin");
  assert.equal(Object.keys(request.headers).some(k=>k.toLowerCase()==="authorization"),false);
  assert.equal(h.sync.owner,"signed-in-owner");
});

test("FOLD 2: a 401 triggers one bounded auth recovery and successfully retries cloud catalog",async()=>{
  let requests=0,recoveries=0;
  const h=harness({fetcher:async()=>{
    requests++;
    return requests===1?UNAUTHORIZED:OK(roles);
  },recoverAuth:async()=>{recoveries++;return true;}});
  assert.equal(await h.sync.refresh(),true);
  assert.equal(requests,2);
  assert.equal(recoveries,1);
  assert.equal(h.rows.length,3);
  assert.equal(h.fetches.every(r=>r.opts.headers.Authorization===undefined),true);
});

test("FOLD 3: 401 with failed renewal preserves every preexisting local session and owner",async()=>{
  let recovery=0;
  const original=[{id:"local-private",role:"Endpoint Security Analyst",resume:"Private source unchanged"}];
  const h=harness({initial:original,previousOwner:"signed-in-owner",
    fetcher:async()=>UNAUTHORIZED,recoverAuth:async()=>{recovery++;return false;}});
  assert.equal(await h.sync.refresh(),false);
  assert.equal(recovery,1);
  assert.deepEqual(h.rows,original);
  assert.deepEqual(JSON.parse(h.data.get("perfact.sessions")),original);
  assert.equal(h.sync.owner,"");
  assert.equal(h.notices.at(-1).state,"offline");
  assert.match(h.notices.at(-1).message,/\(401\)/);
});

test("FOLD 4: 503 outage does not try auth refresh or erase saved sessions",async()=>{
  let recovery=0;
  const original=[{id:"offline",role:"Cloud Security Consultant",instructions:"Keep all notes"}];
  const h=harness({initial:original,previousOwner:"signed-in-owner",
    fetcher:async()=>({ok:false,status:503}),recoverAuth:async()=>{recovery++;return true;}});
  assert.equal(await h.sync.refresh(),false);
  assert.equal(recovery,0);
  assert.deepEqual(h.rows,original);
  assert.equal(h.fetches.length,1);
});

test("FOLD 5: account switching is isolated; 401 never falls back to a different owner",async()=>{
  let user="owner-A",failure=false;
  const h=harness({
    fetcher:async()=>{
      if(failure)return UNAUTHORIZED;
      return OK([{id:"s-"+user,session:{id:"s-"+user,role:user}}],user);
    },
    recoverAuth:async()=>false
  });
  assert.equal(await h.sync.refresh(),true);
  assert.deepEqual(h.rows.map(s=>s.id),["s-owner-A"]);
  failure=true;
  assert.equal(await h.sync.refresh(),false);
  assert.deepEqual(h.rows.map(s=>s.id),["s-owner-A"]);
  user="owner-B";failure=false;
  assert.equal(await h.sync.refresh(),true);
  assert.deepEqual(h.rows.map(s=>s.id),["s-owner-B"]);
  assert.equal(JSON.parse(h.data.get("perfact.cloud.cache.owner-A"))[0].id,"s-owner-A");
});

test("FOLD 6: simultaneous refresh calls do not run repeated cloud auth recovery",async()=>{
  let requestCount=0,recoveryCount=0;
  const h=harness({fetcher:async()=>{
    requestCount++;
    return requestCount===1?UNAUTHORIZED:OK(roles);
  },recoverAuth:async()=>{recoveryCount++;return true;}});
  const [a,b,c]=await Promise.all([h.sync.refresh(),h.sync.refresh(),h.sync.refresh()]);
  assert.deepEqual([a,b,c],[true,true,true]);
  assert.equal(recoveryCount,1);
  assert.equal(requestCount,2);
});

test("FOLD 7: the desktop callback refreshes account sessions immediately after verified auth",()=>{
  const app=fs.readFileSync("public/kompas/app.js","utf8");
  assert.match(app,/window\.kompasDesktop\.onAuthReady\(\(\) => \{\s*void accountSessionSync\?\.refresh\(\)/);
  assert.doesNotMatch(fs.readFileSync("public/kompas/account-sync.js","utf8"),/Authorization:"Bearer "/);
  assert.match(app,/recoverAuth: async \(\) => \{/);
});
