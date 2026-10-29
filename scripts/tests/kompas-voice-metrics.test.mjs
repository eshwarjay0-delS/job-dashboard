import test from "node:test";
import assert from "node:assert/strict";
import {edits,termCounts,percentile} from "../kompas-voice-metrics-core.mjs";
import {evaluate} from "../kompas-voice-metrics-report.mjs";
const row=(id,reference,hypothesis,extra={})=>({id,reference,hypothesis,consent:true,...extra});
const set=samples=>({datasetId:"synthetic",revision:"v1",samples});
test("WER distinguishes substitutions, deletions and insertions",()=>{
  assert.deepEqual(edits("one two three four five six","one new three five six extra"),{referenceWords:6,substitutions:1,deletions:1,insertions:1});
});
test("WER is corpus weighted and deletions stay visible",()=>{
  const r=evaluate(set([row("a","one",""),row("b","one two three four","one two three four")]));
  assert.equal(r.metrics.wer,.2);assert.equal(r.metrics.deletionRate,.2);
});
test("repeated technical terms and Unicode are preserved",()=>{
  assert.deepEqual(termCounts("Azure Sentinel and Azure Sentinel","Azure Sentinel",["Azure Sentinel"]),{expected:2,recognized:1});
  assert.deepEqual(termCounts("C++ AS-REP నా పని","C++ AS-REP నా పని",["C++","AS-REP","నా పని"]),{expected:3,recognized:3});
});
test("missing edit and speaker labels are not invented",()=>{
  const r=evaluate(set([row("a","yes","yes"),row("b","yes","yes",{editCount:0,referenceSpeaker:"s1",predictedSpeaker:"s1",latencyMs:180})]));
  assert.equal(r.metrics.zeroEditRate,1);assert.equal(r.metrics.speakerAttribution,1);
  assert.equal(r.metrics.p50LatencyMs,180);assert.equal(r.metrics.p95LatencyMs,180);
  assert.equal(r.coverage.editLabels,1);assert.equal(r.coverage.speakerLabels,1);
});
test("silence hallucinations are tracked outside undefined WER",()=>{
  const r=evaluate(set([row("s","","invented words")]));
  assert.equal(r.metrics.wer,null);assert.equal(r.metrics.silenceHallucinationRate,1);
});
test("nearest rank latency and empty coverage",()=>{
  assert.equal(percentile([100,400,200,300],.5),200);
  assert.equal(percentile([100,400,200,300],.95),400);
  assert.equal(percentile([],.95),null);
});
test("consent and baseline comparability are mandatory",()=>{
  assert.throws(()=>evaluate(set([{id:"x",reference:"private",hypothesis:"private"}])),/consent/);
  const base=evaluate(set([row("a","yes","yes")]));
  assert.equal(evaluate(set([row("a","yes","no")]),base).deltaFromBaseline.wer,1);
  assert.throws(()=>evaluate({...set([row("a","yes","yes")]),revision:"v2"},base),/Baseline mismatch/);
});
test("no raw transcript or speaker identity in aggregate output",()=>{
  const out=JSON.stringify(evaluate(set([row("a","sensitivephrase","sensitivephrase",{referenceSpeaker:"person",predictedSpeaker:"person"})])));
  assert.ok(!out.includes("sensitivephrase"));assert.ok(!out.includes('"person"'));
});

test("baseline comparison refuses a changed sample cohort even with matching count",()=>{
 const a=evaluate(set([row("one","yes","yes")]));
 assert.throws(()=>evaluate(set([row("two","yes","yes")]),a),/Baseline mismatch/);
 assert.match(a.sampleSetSha256,/^[0-9a-f]{64}$/);
});

test("baseline fingerprint refuses changed reference words under same IDs",()=>{
  const baseline=evaluate(set([row("one","Azure Sentinel","Azure Sentinel")]));
  assert.match(baseline.referenceSetSha256,/^[0-9a-f]{64}$/);
  assert.throws(()=>evaluate(set([row("one","Azure Defender","Azure Sentinel")]),baseline),/Baseline mismatch/);
});
test("baseline fingerprint refuses changed technical terms under same IDs",()=>{
  const baseline=evaluate(set([row("one","Azure Sentinel","Azure Sentinel",{technicalTerms:["Azure Sentinel"]})]));
  assert.throws(()=>evaluate(set([row("one","Azure Sentinel","Azure Sentinel",{technicalTerms:["Sentinel"]})]),baseline),/Baseline mismatch/);
});
test("baseline fingerprint refuses changed reference speaker under same IDs",()=>{
  const baseline=evaluate(set([row("one","yes","yes",{referenceSpeaker:"speaker-1",predictedSpeaker:"speaker-1"})]));
  assert.throws(()=>evaluate(set([row("one","yes","yes",{referenceSpeaker:"speaker-2",predictedSpeaker:"speaker-1"})]),baseline),/Baseline mismatch/);
});
test("legacy baseline without reference fingerprint cannot claim comparable improvement",()=>{
  const baseline=evaluate(set([row("one","yes","yes")]));
  delete baseline.referenceSetSha256;
  assert.throws(()=>evaluate(set([row("one","yes","yes")]),baseline),/Baseline mismatch/);
});
