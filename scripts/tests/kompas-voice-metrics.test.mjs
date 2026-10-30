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

test("baseline rejects a shifted latency subset with the same sample count",()=>{
  const base=evaluate(set([row("a","yes","yes",{latencyMs:900}),row("b","yes","yes")]));
  assert.throws(()=>evaluate(set([row("a","yes","yes"),row("b","yes","yes",{latencyMs:100})]),base),/Baseline mismatch/);
});
test("baseline rejects moved edit labels even when edit-label totals match",()=>{
  const base=evaluate(set([row("a","yes","yes",{editCount:0}),row("b","yes","yes")]));
  assert.throws(()=>evaluate(set([row("a","yes","yes"),row("b","yes","yes",{editCount:0})]),base),/Baseline mismatch/);
});
test("baseline accepts moved predictions with the same reference speaker cohort",()=>{
  const base=evaluate(set([row("a","yes","yes",{referenceSpeaker:"one",predictedSpeaker:"one"}),row("b","yes","yes",{referenceSpeaker:"two"})]));
  const next=evaluate(set([row("a","yes","yes",{referenceSpeaker:"one"}),row("b","yes","yes",{referenceSpeaker:"two",predictedSpeaker:"two"})]),base);
  assert.equal(base.coverage.speakerLabels,2);
  assert.equal(next.coverage.speakerLabels,2);
  assert.equal(base.metrics.speakerAttribution,.5);
  assert.equal(base.metrics.speakerPredictionRate,.5);
  assert.equal(next.metrics.speakerAttribution,.5);
  assert.equal(next.metrics.speakerPredictionRate,.5);
  assert.equal(next.deltaFromBaseline.speakerAttribution,0);
  assert.equal(next.deltaFromBaseline.speakerPredictionRate,0);
  assert.equal(next.measurementSetSha256,base.measurementSetSha256);
});
test("baseline accepts same measurement-label cohort with changed predictions",()=>{
  const base=evaluate(set([row("a","yes","yes",{editCount:0,latencyMs:900,referenceSpeaker:"one",predictedSpeaker:"one"})]));
  const next=evaluate(set([row("a","yes","no",{editCount:1,latencyMs:100,referenceSpeaker:"one",predictedSpeaker:"two"})]),base);
  assert.equal(next.deltaFromBaseline.wer,1);
  assert.equal(next.deltaFromBaseline.p50LatencyMs,-800);
  assert.equal(next.deltaFromBaseline.zeroEditRate,-1);
  assert.equal(next.deltaFromBaseline.speakerAttribution,-1);
});
test("baseline rejects missing measurement fingerprint or modified coverage",()=>{
  const base=evaluate(set([row("a","yes","yes",{latencyMs:100})]));
  assert.match(base.measurementSetSha256,/^[a-f0-9]{64}$/);
  assert.throws(()=>evaluate(set([row("a","yes","yes",{latencyMs:100})]),{...base,measurementSetSha256:undefined}),/Baseline mismatch/);
  assert.throws(()=>evaluate(set([row("a","yes","yes",{latencyMs:100})]),{...base,coverage:{...base.coverage,latencySamples:0}}),/Baseline mismatch/);
});
test("baseline rejects nonfinite or malformed aggregate metrics",()=>{
  const base=evaluate(set([row("a","yes","yes")]));
  assert.throws(()=>evaluate(set([row("a","yes","yes")]),{...base,metrics:{...base.metrics,wer:Infinity}}),/Baseline mismatch/);
  assert.throws(()=>evaluate(set([row("a","yes","yes")]),{...base,metrics:{...base.metrics,wer:"0"}}),/Baseline mismatch/);
});

test("missing speaker prediction is counted as wrong rather than omitted",()=>{
  const r=evaluate(set([row("a","hello","hello",{referenceSpeaker:"A"}),row("b","hello","hello",{referenceSpeaker:"B",predictedSpeaker:"B"})]));
  assert.equal(r.coverage.speakerLabels,2);
  assert.equal(r.metrics.speakerAttribution,.5);
  assert.equal(r.metrics.speakerPredictionRate,.5);
});
test("all missing predictions produce zero accuracy rather than undefined accuracy",()=>{
  const r=evaluate(set([row("a","hello","hello",{referenceSpeaker:"A"})]));
  assert.equal(r.metrics.speakerAttribution,0);
  assert.equal(r.metrics.speakerPredictionRate,0);
});
test("speaker abstention and later prediction are comparable for identical reference cohort",()=>{
  const base=evaluate(set([row("a","hello","hello",{referenceSpeaker:"A"})]));
  const candidate=evaluate(set([row("a","hello","hello",{referenceSpeaker:"A",predictedSpeaker:"A"})]),base);
  assert.equal(candidate.deltaFromBaseline.speakerAttribution,1);
  assert.equal(candidate.deltaFromBaseline.speakerPredictionRate,1);
  assert.equal(candidate.measurementSetSha256,base.measurementSetSha256);
});
test("legacy speaker benchmark schema is rejected, never silently compared",()=>{
  const base=evaluate(set([row("a","hello","hello",{referenceSpeaker:"A"})]));
  assert.equal(base.schemaVersion,2);
  assert.throws(()=>evaluate(set([row("a","hello","hello",{referenceSpeaker:"A"})]),{...base,schemaVersion:1}),/Baseline mismatch/);
});
test("speaker reference cohort cannot be changed to game attribution denominator",()=>{
  const base=evaluate(set([row("a","hello","hello",{referenceSpeaker:"A"}),row("b","hello","hello")]));
  assert.throws(()=>evaluate(set([row("a","hello","hello"),row("b","hello","hello",{referenceSpeaker:"A"})]),base),/Baseline mismatch/);
});
test("speaker prediction without reference is not scored as a verified attribution",()=>{
  const r=evaluate(set([row("a","hello","hello",{predictedSpeaker:"A"})]));
  assert.equal(r.coverage.speakerLabels,0);
  assert.equal(r.metrics.speakerAttribution,null);
  assert.equal(r.metrics.speakerPredictionRate,null);
});
