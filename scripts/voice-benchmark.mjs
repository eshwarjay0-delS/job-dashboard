/**
 * Offline Kompas speech benchmark. Never uploads audio or logs transcripts.
 * Supply consented, de-identified JSON samples locally; only aggregate metrics
 * are emitted. Synthetic fixtures are NOT evidence of real-world STT quality.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function words(text) {
  return String(text || '').toLocaleLowerCase('en').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []
}

/** Levenshtein alignment with separate substitution/deletion/insertion counts. */
export function editCounts(reference, hypothesis) {
  const a = words(reference), b = words(hypothesis)
  // Align per utterance, not an entire hour-long recording in one quadratic matrix.
  if (a.length > 2000 || b.length > 2000) throw new RangeError('Split long transcripts into utterances of at most 2000 words')
  const dp = Array.from({length:a.length+1},()=>Array(b.length+1))
  dp[0][0]={s:0,d:0,i:0}
  for(let j=1;j<=b.length;j++)dp[0][j]={s:0,d:0,i:j}
  for(let i=1;i<=a.length;i++)dp[i][0]={s:0,d:i,i:0}
  const cost=x=>x.s+x.d+x.i
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    const choices=[]
    const prior=dp[i-1][j-1]
    choices.push({s:prior.s+(a[i-1]===b[j-1]?0:1),d:prior.d,i:prior.i})
    choices.push({...dp[i-1][j],d:dp[i-1][j].d+1})
    choices.push({...dp[i][j-1],i:dp[i][j-1].i+1})
    dp[i][j]=choices.reduce((best,option)=>cost(option)<cost(best)?option:best)
  }
  return {...dp[a.length][b.length],referenceWords:a.length,hypothesisWords:b.length}
}
function occurrences(tokens, phrase) {
  const term=words(phrase)
  if(!term.length)return 0
  let count=0
  for(let i=0;i<=tokens.length-term.length;i++)if(term.every((word,j)=>tokens[i+j]===word))count++
  return count
}
function percentile(values, fraction) {
  if(!values.length)return null
  const sorted=[...values].sort((a,b)=>a-b)
  return sorted[Math.max(0,Math.ceil(fraction*sorted.length)-1)]
}
export function evaluate(samples) {
  if(!Array.isArray(samples))throw new TypeError('Expected an array of benchmark samples')
  const totals={s:0,d:0,i:0,referenceWords:0,termFound:0,termExpected:0,speakerCorrect:0,speakerTotal:0,zeroEdit:0}
  const latencies=[]
  for(const sample of samples){
    if(typeof sample.reference!=='string'||typeof sample.hypothesis!=='string')throw new TypeError('Each sample needs reference and hypothesis strings')
    const e=editCounts(sample.reference,sample.hypothesis)
    for(const k of ['s','d','i','referenceWords'])totals[k]+=e[k]
    if(e.s+e.d+e.i===0)totals.zeroEdit++
    const refTokens=words(sample.reference),hypTokens=words(sample.hypothesis)
    for(const term of sample.technicalTerms||[]){
      const expected=occurrences(refTokens,term)
      totals.termExpected+=expected
      totals.termFound+=Math.min(expected,occurrences(hypTokens,term))
    }
    if(sample.speakerReference!==undefined||sample.speakerHypothesis!==undefined){
      if(!Array.isArray(sample.speakerReference)||!Array.isArray(sample.speakerHypothesis))throw new TypeError('Speaker labels must be arrays')
      for(let j=0;j<sample.speakerReference.length;j++){
        totals.speakerTotal++
        if(sample.speakerReference[j]===sample.speakerHypothesis[j])totals.speakerCorrect++
      }
    }
    if(sample.latencyMs!==undefined){
      if(typeof sample.latencyMs!=='number'||!Number.isFinite(sample.latencyMs)||sample.latencyMs<0)throw new RangeError('Latency must be a nonnegative finite number')
      latencies.push(sample.latencyMs)
    }
  }
  return {
    samples:samples.length,
    referenceWords:totals.referenceWords,
    substitutions:totals.s, deletions:totals.d, insertions:totals.i,
    wer:totals.referenceWords?(totals.s+totals.d+totals.i)/totals.referenceWords:null,
    deletionRate:totals.referenceWords?totals.d/totals.referenceWords:null,
    technicalTermRecall:totals.termExpected?totals.termFound/totals.termExpected:null,
    technicalTermsEvaluated:totals.termExpected,
    zeroEditRate:samples.length?totals.zeroEdit/samples.length:null,
    speakerAttributionAccuracy:totals.speakerTotal?totals.speakerCorrect/totals.speakerTotal:null,
    speakerTurnsEvaluated:totals.speakerTotal,
    latencySamples:latencies.length,
    p50LatencyMs:percentile(latencies,0.5),
    p95LatencyMs:percentile(latencies,0.95),
  }
}
export function compareSamples(baseline, candidate) {
  if(!Array.isArray(baseline)||!Array.isArray(candidate))throw new TypeError('Expected sample arrays')
  const byId = new Map()
  for(const row of baseline){
    if(typeof row.id!=='string'||!row.id.trim()||byId.has(row.id))throw new Error('Baseline requires unique nonempty IDs')
    byId.set(row.id,row)
  }
  const seen=new Set()
  for(const row of candidate){
    if(typeof row.id!=='string'||!byId.has(row.id)||seen.has(row.id))throw new Error('Candidate IDs must match baseline exactly')
    seen.add(row.id)
  }
  if(seen.size!==byId.size)throw new Error('Candidate is missing baseline samples')
  const before=evaluate(baseline), after=evaluate(candidate)
  const delta={}
  for(const key of ['wer','deletionRate','technicalTermRecall','zeroEditRate','speakerAttributionAccuracy','p50LatencyMs','p95LatencyMs']){
    delta[key]=before[key]===null||after[key]===null?null:after[key]-before[key]
  }
  return {baseline:before,candidate:after,delta}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const file=process.argv[2]
  if(!file){console.error('Usage: node scripts/voice-benchmark.mjs candidate.json [baseline.json]');process.exitCode=2}
  else {
    try {
      const payload=JSON.parse(readFileSync(file,'utf8'))
      if(payload.kind!=='synthetic'&&payload.kind!=='consented-deidentified')throw new Error('Dataset kind must be synthetic or consented-deidentified')
      const baselineFile=process.argv[3]
      if(baselineFile){
        const base=JSON.parse(readFileSync(baselineFile,'utf8'))
        if(base.kind!==payload.kind)throw new Error('Baseline and candidate dataset kinds differ')
        console.log(JSON.stringify({kind:payload.kind,...compareSamples(base.samples,payload.samples)},null,2))
      }else console.log(JSON.stringify({kind:payload.kind,metrics:evaluate(payload.samples)},null,2))
    } catch(error){console.error('Benchmark failed:',error.message);process.exitCode=1}
  }
}
