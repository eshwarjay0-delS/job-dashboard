// Aggregate-only evaluation. Input is held in memory; no audio or transcript is saved.
import {createHash} from "node:crypto";
import {edits,termCounts,percentile} from "./kompas-voice-metrics-core.mjs";
const rate=(a,b)=>b?a/b:null;
export function evaluate(dataset,baseline=null){
  if(!dataset||!dataset.datasetId||!dataset.revision||!Array.isArray(dataset.samples)||!dataset.samples.length)
    throw Error("Dataset ID, revision and nonempty samples required");
  const ids=new Set(),sum={referenceWords:0,substitutions:0,deletions:0,insertions:0,expected:0,recognized:0,zero:0,edited:0,speakers:0,correct:0,silent:0,hallucinated:0},times=[];
  for(const [i,row] of dataset.samples.entries()){
    if(!row||row.consent!==true)throw Error("Sample "+(i+1)+": explicit evaluation consent required");
    if(typeof row.id!=="string"||!row.id||ids.has(row.id))throw Error("Sample "+(i+1)+": invalid or duplicate ID");
    ids.add(row.id);
    if(typeof row.reference!=="string"||typeof row.hypothesis!=="string")throw Error("Sample "+(i+1)+": text required");
    if(row.technicalTerms!==undefined&&(!Array.isArray(row.technicalTerms)||row.technicalTerms.some(t=>typeof t!=="string")))throw Error("Invalid terminology labels");
    if(row.editCount!==undefined&&(!Number.isSafeInteger(row.editCount)||row.editCount<0))throw Error("Invalid edit count");
    if(row.latencyMs!==undefined&&(!Number.isFinite(row.latencyMs)||row.latencyMs<0))throw Error("Invalid latency");
    const e=edits(row.reference,row.hypothesis),t=termCounts(row.reference,row.hypothesis,row.technicalTerms??[]);
    for(const k of ["referenceWords","substitutions","deletions","insertions"])sum[k]+=e[k];
    sum.expected+=t.expected;sum.recognized+=t.recognized;
    if(row.editCount!==undefined){sum.edited++;if(row.editCount===0)sum.zero++}
    if(typeof row.referenceSpeaker==="string"&&typeof row.predictedSpeaker==="string"){sum.speakers++;if(row.referenceSpeaker===row.predictedSpeaker)sum.correct++}
    if(row.latencyMs!==undefined)times.push(row.latencyMs);
    if(e.referenceWords===0){sum.silent++;if(e.insertions)sum.hallucinated++}
  }
  const sampleSetSha256=createHash("sha256").update(JSON.stringify([...ids].sort())).digest("hex");
  // IDs alone cannot prove a comparable reference: the same IDs could be
  // silently paired with different words, terminology or speaker labels.
  const referenceSetSha256=createHash("sha256").update(JSON.stringify(
    dataset.samples.map(row=>({
      id:row.id,reference:row.reference.normalize("NFC"),
      terms:[...(row.technicalTerms??[])].map(t=>t.normalize("NFC")).sort(),
      speaker:typeof row.referenceSpeaker==="string"?row.referenceSpeaker:null,
    })).sort((a,b)=>a.id.localeCompare(b.id))
  )).digest("hex");
  // Bind measurement-label availability to each sample, not just total counts.
  // Otherwise a candidate can drop slow clips' latency or move edit/speaker
  // labels between clips and report a misleading improvement.
  // This fingerprint contains only IDs and label-presence booleans.
  const measurementSetSha256=createHash("sha256").update(JSON.stringify(
    dataset.samples.map(row=>({
      id:row.id,
      hasEditLabel:row.editCount!==undefined,
      hasSpeakerLabel:typeof row.referenceSpeaker==="string"&&typeof row.predictedSpeaker==="string",
      hasLatency:row.latencyMs!==undefined,
    })).sort((a,b)=>a.id.localeCompare(b.id))
  )).digest("hex");
  const metrics={wer:rate(sum.substitutions+sum.deletions+sum.insertions,sum.referenceWords),
    deletionRate:rate(sum.deletions,sum.referenceWords),substitutionRate:rate(sum.substitutions,sum.referenceWords),
    insertionRate:rate(sum.insertions,sum.referenceWords),technicalTermRecall:rate(sum.recognized,sum.expected),
    zeroEditRate:rate(sum.zero,sum.edited),speakerAttribution:rate(sum.correct,sum.speakers),
    p50LatencyMs:percentile(times,.5),p95LatencyMs:percentile(times,.95),
    silenceHallucinationRate:rate(sum.hallucinated,sum.silent)};
  const out={schemaVersion:1,datasetId:dataset.datasetId,revision:dataset.revision,sampleCount:dataset.samples.length,sampleSetSha256,referenceSetSha256,measurementSetSha256,
    coverage:{referenceWords:sum.referenceWords,technicalOccurrences:sum.expected,editLabels:sum.edited,speakerLabels:sum.speakers,latencySamples:times.length,silentClips:sum.silent},metrics};
  if(baseline){
    if(baseline.schemaVersion!==1||baseline.datasetId!==out.datasetId||baseline.revision!==out.revision||baseline.sampleCount!==out.sampleCount||baseline.sampleSetSha256!==sampleSetSha256||baseline.referenceSetSha256!==referenceSetSha256||baseline.measurementSetSha256!==measurementSetSha256)
      throw Error("Baseline mismatch: dataset, revision or sample count");
    if(!baseline.coverage||Object.entries(out.coverage).some(([key,count])=>baseline.coverage[key]!==count)||
      !baseline.metrics||Object.keys(metrics).some(key=>
        !(baseline.metrics[key]===null||(typeof baseline.metrics[key]==="number"&&Number.isFinite(baseline.metrics[key])))))
      throw Error("Baseline mismatch: measurement coverage or metric validity");
    out.deltaFromBaseline=Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,v===null||typeof baseline.metrics?.[k]!=="number"?null:v-baseline.metrics[k]]));
  }
  return out;
}
