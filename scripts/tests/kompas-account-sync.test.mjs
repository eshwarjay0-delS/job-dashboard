import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {delta,combine,create} = require("../../public/kompas/account-sync.js");
const server = fs.readFileSync("src/app/api/kompas/account-sessions/route.ts","utf8");
const handoff = fs.readFileSync("src/app/api/kompas/desktop-handoff/route.ts","utf8");
const app = fs.readFileSync("public/kompas/app.js","utf8");
const html = fs.readFileSync("public/kompas/index.html","utf8");
const sql = fs.readFileSync("supabase/migrations/20261030222000_kompas_session_large_payload.sql","utf8");

test("separate devices change different fields without resending stale full snapshots",()=>{
  const base=[{id:"s1",role:"Security Engineer",company:"Old",instructions:"Long rules"}];
  assert.deepEqual(delta(base,[{...base[0],role:"Cybersecurity Engineer"}]),[{id:"s1",patch:{role:"Cybersecurity Engineer",id:"s1"},deleted:false}]);
  assert.deepEqual(delta(base,[{...base[0],company:"Citi"}]),[{id:"s1",patch:{company:"Citi",id:"s1"},deleted:false}]);
});
test("cloud returns sessions created by a different device",()=>{
  const merged=combine([
    {id:"remote",session:{id:"remote",role:"Endpoint Analyst",createdAt:20}},
    {id:"local",session:{id:"local",role:"Security Engineer",createdAt:10}}],
    [{id:"local",role:"Old",createdAt:10}],{});
  assert.deepEqual(merged.map(x=>x.id),["remote","local"]);
  assert.equal(merged[1].role,"Security Engineer");
});
test("deletions are final; old offline devices cannot resurrect a tombstone",()=>{
  const r=combine([{id:"s1",deleted:true,session:null}],[{id:"s1",role:"Stale"}],{s1:{id:"s1",patch:{role:"Stale"},deleted:false}});
  assert.deepEqual(r,[]);
});
test("pending offline changes overlay a remote row without dropping other fields",()=>{
  const merged=combine([{id:"s1",session:{id:"s1",role:"Architect",instructions:"Original"}}],
    [{id:"s1",role:"Old",instructions:"Personal"}],
    {s1:{id:"s1",patch:{instructions:"Personal"},deleted:false}});
  assert.equal(merged[0].role,"Architect");
  assert.equal(merged[0].instructions,"Personal");
});
test("account isolation requires verified server ownership; unknown local lists are not auto-uploaded",async()=>{
  let data=new Map([["perfact.sessions",JSON.stringify([{id:"legacy",role:"Old device"}])]]);
  const store={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  let current=JSON.parse(store.getItem("perfact.sessions"));
  let posts=[];
  const sync=create({storage:store,read:()=>current,write:rows=>{current=rows;store.setItem("perfact.sessions",JSON.stringify(rows));},
    render:()=>{},notify:()=>{},fetcher:async(_url,opts)=>{
      if(opts.method==="GET")return{ok:true,json:async()=>({ok:true,userId:"verified-account",records:[]})};
      posts.push(JSON.parse(opts.body));return{ok:true,json:async()=>({ok:true,userId:"verified-account",records:[]})};
    }});
  await sync.refresh();
  assert.deepEqual(current,[]);
  assert.equal(posts.length,0);
  assert.equal(JSON.parse(store.getItem("perfact.cloud.legacy"))[0].id,"legacy");
  assert.equal(sync.importLegacy(),true);
  assert.equal(current[0].id,"legacy");
  assert.equal(posts.length,1);
});
test("switching authenticated account never displays previous account's local sessions",async()=>{
  let account="one";const storage=new Map();
  const store={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  let current=[];
  const sync=create({storage:store,read:()=>current,write:r=>{current=r;store.setItem("perfact.sessions",JSON.stringify(r));},render:()=>{},notify:()=>{},
    fetcher:async(_url,opts)=>({ok:true,json:async()=>({ok:true,userId:account,records:account==="one"?[{id:"s1",session:{id:"s1",role:"Role One"}}]:[{id:"s2",session:{id:"s2",role:"Role Two"}}]})})});
  await sync.refresh();assert.deepEqual(current.map(x=>x.id),["s1"]);
  account="two";await sync.refresh();assert.deepEqual(current.map(x=>x.id),["s2"]);
});
test("long AI instructions are sent verbatim rather than trimmed",()=>{
  const long="A".repeat(650000)+"  \n";
  assert.ok(long.length>20000);
  assert.match(app,/instructions: \$\("instructions"\)\.value,/);
  assert.match(handoff,/LARGE_TEXT_FIELDS/);
  assert.match(handoff,/const MAX_BYTES = 4_000_000/);
  assert.match(sql,/octet_length\(v_patch::text\) > 4000000/);
  assert.ok(!app.includes('try { write(slimForStore(k, v)); }'));
  assert.match(html,/account-sync\.js/);
});
test("cloud read and write authenticate the account; no global unsecured session list",()=>{
  assert.match(server,/authenticatedUser\(req\)/);
  assert.match(server,/\.eq\("user_id", user\.id\)/);
  assert.match(server,/createServiceClient\(\)/);
  assert.match(server,/merge_kompas_account_session/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on public\.kompas_account_sessions from public, anon, authenticated/);
});
test("account sync accepts the same large payload envelope as the desktop handoff",()=>{
  assert.match(server,/Number\(req\.headers\.get\("content-length"\) \|\| 0\) > 4_000_000/);
  assert.match(server,/Buffer\.byteLength\(raw,\s*"utf8"\) > 4_000_000/);
  assert.ok(!server.includes('Buffer.byteLength(raw,"utf8") > 650_000'),"No hidden 650 kB rejection");
});
test("returns to Sessions, focus, visibility and desktop handoffs re-read the cloud",()=>{
  assert.match(app,/if \(accountSessionSync\) void accountSessionSync\.refresh\(\)/);
  assert.match(app,/async function openHandedSession\(s\)/);
  const lib=fs.readFileSync("public/kompas/account-sync.js","utf8");
  assert.match(lib,/addEventListener\("focus"/);
  assert.match(lib,/visibilitychange/);
  assert.match(lib,/setInterval\(/);
});


test("same verified owner restores newer browser sessions when cloud shadow cache is missing",async()=>{
  const old=[{id:"saved-bny",role:"Security Engineer",instructions:"original"}];
  const newer=[{...old[0],instructions:"revised long rules",jd:"private JD"}];
  const db=new Map([
    ["perfact.cloud.owner","verified-account"],
    ["perfact.sessions",JSON.stringify(newer)],
  ]);
  const storage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,String(v)),removeItem:k=>db.delete(k)};
  let current=newer, posts=[],serverRows=[];
  const sync=create({storage,read:()=>current,write:rows=>{current=rows;db.set("perfact.sessions",JSON.stringify(rows))},
    render:()=>{},notify:()=>{},fetcher:async(_url,opts)=>{
      if(opts.method==="GET")return{ok:true,json:async()=>({ok:true,userId:"verified-account",records:serverRows})};
      const request=JSON.parse(opts.body);
      posts.push(request);
      for(const op of request.operations) {
        const row={id:op.id,session:op.deleted?null:op.patch,deleted:op.deleted};
        serverRows=[...serverRows.filter(r=>r.id!==op.id),row];
      }
      return{ok:true,json:async()=>({ok:true,userId:"verified-account",records:serverRows})};
    }});
  await sync.refresh();
  assert.equal(current.length,1,"account reconnect must not erase its own session");
  assert.equal(current[0].id,"saved-bny");
  assert.equal(current[0].jd,"private JD");
  assert.equal(current[0].instructions,"revised long rules");
  assert.ok(posts.some(p=>p.operations.some(x=>x.id==="saved-bny")),"recovered changes must be queued for server persistence");
});

test("different verified owner never adopts previous account's unscoped sessions",async()=>{
  const db=new Map([
    ["perfact.cloud.owner","old-account"],
    ["perfact.sessions",JSON.stringify([{id:"old-bny",role:"Security Engineer"}])],
  ]);
  const storage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,String(v)),removeItem:k=>db.delete(k)};
  let current=JSON.parse(db.get("perfact.sessions")),posts=[];
  const sync=create({storage,read:()=>current,write:r=>{current=r;db.set("perfact.sessions",JSON.stringify(r))},
    render:()=>{},notify:()=>{},fetcher:async(_url,opts)=>{
      if(opts.method==="GET")return{ok:true,json:async()=>({ok:true,userId:"new-account",records:[]})};
      posts.push(JSON.parse(opts.body));return{ok:true,json:async()=>({ok:true,userId:"new-account",records:[]})};
    }});
  await sync.refresh();
  assert.deepEqual(current,[],"a new account must not display or upload the previous owner's sessions");
  assert.deepEqual(posts,[]);
  assert.equal(JSON.parse(db.get("perfact.cloud.cache.old-account"))[0].id,"old-bny",
    "old account's local data remains privately recoverable");
});


test("same-owner recovery does not resurrect a session removed from the current browser list",async()=>{
  const now=[{id:"active",role:"Security Engineer",instructions:"current"}];
  const db=new Map([
    ["perfact.cloud.owner","verified-account"],
    ["perfact.sessions",JSON.stringify(now)],
    ["perfact.cloud.cache.verified-account",JSON.stringify([{id:"stale",role:"Old session"}])],
  ]);
  const storage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,String(v)),removeItem:k=>db.delete(k)};
  let current=now,rows=[],posted=[];
  const sync=create({storage,read:()=>current,write:v=>{current=v;db.set("perfact.sessions",JSON.stringify(v))},
    render:()=>{},notify:()=>{},fetcher:async(_url,opts)=>{
      if(opts.method==="GET")return{ok:true,json:async()=>({ok:true,userId:"verified-account",records:rows})};
      const body=JSON.parse(opts.body); posted.push(...body.operations.map(v=>v.id));
      for(const op of body.operations)rows=[...rows.filter(r=>r.id!==op.id),{id:op.id,session:op.patch,deleted:op.deleted}];
      return{ok:true,json:async()=>({ok:true,userId:"verified-account",records:rows})};
    }});
  await sync.refresh();
  assert.deepEqual(current.map(s=>s.id),["active"]);
  assert.deepEqual(posted,["active"],"stale cached session must never be uploaded anew");
});
