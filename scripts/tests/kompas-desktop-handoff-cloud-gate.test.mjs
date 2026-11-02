import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync("public/kompas/app.js", "utf8");
const native = fs.readFileSync("legacy/perfact/desktop/main.js", "utf8");
const start = app.indexOf('let lastDesktopHandoff = { id: "", at: 0 };');
const end = app.indexOf("window.kompasDesktop?.takeSession?.()", start);
assert.ok(start > 0 && end > start);
const handoff = app.slice(start, end);

function setup({owner="owner-A", outcomes=[true], existing=[]}={}) {
  let stored=existing.map(x=>({...x})), refreshCalls=0, opened=[], started=0;
  const notices=[], tasks=[];
  const status={textContent:"",classList:{remove(){},add(){}}};
  const ctx={
    Date:{now:()=>100000},
    JSON, Map, Array, String, Number,
    window:{kompasDesktop:{version:"0.8.5"}},
    accountSessionSync:{
      get owner(){return owner},
      refresh:async()=>{
        refreshCalls++;
        const result=outcomes.length?outcomes.shift():true;
        return result;
      }
    },
    pendingDesktopHandoffs:new Map(),
    replayingDesktopHandoff:false,
    queueMicrotask:callback=>tasks.push(callback),
    LS:{get:()=>stored,set(_key,v){stored=v}},
    sessions:stored,
    launchCopilot:s=>opened.push(s),
    $:id=>id==="cloudSyncStatus"?status:{
      classList:{add(){},contains(){return false}},
      click(){started++}
    },
  };
  vm.runInNewContext(handoff+
    "\nthis.openHandoff=openHandedSession;this.resume=resumePendingDesktopHandoffs;",ctx);
  return {
    ctx,notices,tasks,status,
    get stored(){return stored},
    get opened(){return opened},
    get started(){return started},
    get refreshCalls(){return refreshCalls},
    setOwner:v=>owner=v,
    setOutcomes:v=>outcomes=v
  };
}

const handed=(owner="owner-A", id="s1")=>({
  id,site:"marketfit",role:"Cloud Security Engineer",resume:"source resume",jd:"source JD",
  __kompasVerifiedOwner:owner,createdAt:1234,token:"must-not-persist",refreshToken:"must-not-persist"
});

test("fold 1: 401 while taking a Windows handoff leaves all device and cloud sessions untouched",async()=>{
  const prior={id:"previous",role:"Previously saved"};
  const h=setup({existing:[prior],outcomes:[false]});
  await h.ctx.openHandoff(handed());
  assert.deepEqual(h.stored,[prior]);
  assert.equal(h.opened.length,0);
  assert.equal(h.started,0);
  assert.equal(h.ctx.pendingDesktopHandoffs.size,1);
  assert.match(h.status.textContent,/held safely/);
});

test("fold 2: matching cloud-account recovery replays a one-use handoff once, without tokens",async()=>{
  const h=setup({outcomes:[false,true,true]});
  await h.ctx.openHandoff(handed());
  assert.equal(await h.ctx.resume(),true);
  assert.equal(h.stored.length,1);
  assert.equal(h.opened.length,1);
  assert.equal(h.started,1);
  for(const k of ["token","refreshToken","tokenExp","__kompasVerifiedOwner","ownerId"])
    assert.equal(Object.hasOwn(h.stored[0],k),false,k);
  assert.equal(h.ctx.pendingDesktopHandoffs.size,0);
  assert.equal(await h.ctx.resume(),false);
  assert.equal(h.opened.length,1);
});

test("fold 3: a different signed-in account cannot import a held interview",async()=>{
  const h=setup({owner:"owner-B"});
  await h.ctx.openHandoff(handed("owner-A"));
  assert.equal(h.ctx.pendingDesktopHandoffs.size,1);
  assert.equal(h.opened.length,0);
  assert.equal(h.stored.length,0);
  assert.match(h.status.textContent,/could not be matched/);
  h.setOwner("owner-A");
  assert.equal(await h.ctx.resume(),true);
  assert.equal(h.opened.length,1);
  assert.equal(h.stored[0].id,"s1");
});

test("fold 4: old 0.8.4 native handoff is compatible only when the initial owner lookup succeeds",async()=>{
  const h=setup();
  const s=handed();delete s.__kompasVerifiedOwner;
  await h.ctx.openHandoff(s);
  assert.equal(h.opened.length,1);
});

test("fold 5: failed initial owner check from an unmarked old desktop never imports later under a different login",async()=>{
  const h=setup({owner:"",outcomes:[false,true,true]});
  const s=handed();delete s.__kompasVerifiedOwner;
  await h.ctx.openHandoff(s);
  h.setOwner("owner-B");
  assert.equal(await h.ctx.resume(),false);
  assert.equal(h.opened.length,0);
  assert.equal(h.ctx.pendingDesktopHandoffs.size,1);
  assert.match(h.status.textContent,/Update Kompas/);
});

test("fold 6: duplicate native delivery during pending auth is not started twice",async()=>{
  const h=setup({outcomes:[false,true]});
  const s=handed();
  await h.ctx.openHandoff(s);
  await h.ctx.openHandoff(s);
  assert.equal(h.ctx.pendingDesktopHandoffs.size,1);
  assert.equal(await h.ctx.resume(),true);
  assert.equal(h.opened.length,1);
  await h.ctx.openHandoff(s);
  assert.equal(h.opened.length,1);
});

test("fold 7: two distinct account-bound tickets both survive failure and recover independently",async()=>{
  const h=setup({outcomes:[false,false,true,true]});
  await h.ctx.openHandoff(handed("owner-A","s1"));
  await h.ctx.openHandoff(handed("owner-A","s2"));
  assert.equal(h.ctx.pendingDesktopHandoffs.size,2);
  assert.equal(h.stored.length,0);
  assert.equal(await h.ctx.resume(),true);
  assert.equal(await h.ctx.resume(),true);
  assert.deepEqual(h.stored.map(x=>x.id),["s2","s1"]);
  assert.equal(h.opened.length,2);
  assert.equal(h.ctx.pendingDesktopHandoffs.size,0);
});

test("fold 8: new native bridge attests the owner, but never exposes refresh credentials",()=>{
  assert.match(native,/verified\.__kompasVerifiedOwner = desktopAuth\.ownerId\(\)/);
  assert.match(native,/desktopAuth\.ownerId\(\) !== pendingSession\.ownerId/);
  assert.match(handoff,/if \(!accountSessionSync \|\| !await accountSessionSync\.refresh\(\) \|\| !accountSessionSync\.owner\)/);
  assert.match(handoff,/__kompasVerifiedOwner/);
  assert.match(handoff,/pendingDesktopHandoffs\.delete\(id\)/);
  assert.match(app,/lastHandoffSyncState !== "synced" \|\| lastHandoffSyncOwner !== state\.owner/);
});

test("fold 9: merging a reopened interview preserves transcript keys and local explicit-end state",async()=>{
  const h=setup({existing:[{id:"s1",resume:"old",transcripts:[{key:"tx1",at:1}],endedAt:150}]});
  const s=handed();s.resume="new";s.transcripts=[{key:"tx2",at:2}];
  await h.ctx.openHandoff(s);
  assert.equal(h.stored.length,1);
  assert.equal(h.stored[0].resume,"new");
  assert.equal(h.stored[0].endedAt,150);
  assert.deepEqual(Array.from(h.stored[0].transcripts,v=>v.key),["tx1","tx2"]);
});
