// Run consent-gated, aggregate-only Kompas voice metrics on local JSON fixtures.
// Never send audio or text to a provider; never print sample transcripts.
import {readFileSync} from "node:fs";
import {evaluate} from "./kompas-voice-metrics-report.mjs";
const [candidateFile,baselineFile]=process.argv.slice(2);
if(!candidateFile){
  console.error("Usage: node scripts/kompas-voice-metrics-cli.mjs candidate.json [baseline-aggregate.json]");
  process.exitCode=2;
}else{
  try{
    const candidate=JSON.parse(readFileSync(candidateFile,"utf8"));
    const baseline=baselineFile?JSON.parse(readFileSync(baselineFile,"utf8")):null;
    console.log(JSON.stringify(evaluate(candidate,baseline),null,2));
  }catch{
    // Deliberately do not print exception details: a malformed private fixture
    // or filesystem error could include sensitive local paths or text.
    console.error("Benchmark failed: check consent, sample IDs, fixture format and baseline fingerprint.");
    process.exitCode=1;
  }
}
