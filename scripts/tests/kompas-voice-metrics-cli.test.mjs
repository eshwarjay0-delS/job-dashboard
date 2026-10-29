import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {evaluate} from "../kompas-voice-metrics-report.mjs";
const cli=fileURLToPath(new URL("../kompas-voice-metrics-cli.mjs",import.meta.url));
function fixture(sample){
  const dir=mkdtempSync(join(tmpdir(),"kompas-voice-metrics-"));
  const candidate=join(dir,"candidate.json");
  const data={datasetId:"synthetic",revision:"v1",samples:[{id:"case-1",consent:true,reference:"secret-utterance",hypothesis:"secret-utterance",...sample}]};
  writeFileSync(candidate,JSON.stringify(data));
  return {dir,candidate,data};
}
test("CLI emits only aggregate metrics and never raw transcript",()=>{
  const f=fixture({});
  try{
    const p=spawnSync(process.execPath,[cli,f.candidate],{encoding:"utf8"});
    assert.equal(p.status,0,p.stderr);
    assert.equal(JSON.parse(p.stdout).metrics.wer,0);
    assert.ok(!p.stdout.includes("secret-utterance"));
  }finally{rmSync(f.dir,{recursive:true,force:true})}
});
test("CLI rejects unconsented samples without echoing their text",()=>{
  const f=fixture({consent:false});
  try{
    const p=spawnSync(process.execPath,[cli,f.candidate],{encoding:"utf8"});
    assert.equal(p.status,1);
    assert.ok(!p.stderr.includes("secret-utterance"));
    assert.ok(!p.stdout.includes("secret-utterance"));
  }finally{rmSync(f.dir,{recursive:true,force:true})}
});
test("CLI compares only fingerprint-matched baseline aggregates",()=>{
  const f=fixture({});
  try{
    const baseline=join(f.dir,"baseline.json");
    writeFileSync(baseline,JSON.stringify(evaluate(f.data)));
    const ok=spawnSync(process.execPath,[cli,f.candidate,baseline],{encoding:"utf8"});
    assert.equal(ok.status,0,ok.stderr);
    assert.equal(JSON.parse(ok.stdout).deltaFromBaseline.wer,0);
    const bad=JSON.parse(JSON.stringify(evaluate(f.data)));
    bad.referenceSetSha256="0".repeat(64);
    writeFileSync(baseline,JSON.stringify(bad));
    const rejected=spawnSync(process.execPath,[cli,f.candidate,baseline],{encoding:"utf8"});
    assert.equal(rejected.status,1);
  }finally{rmSync(f.dir,{recursive:true,force:true})}
});
