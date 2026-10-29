/** Private editable review template; intentionally no invented scores or claims. */
import { readFile,writeFile,mkdir } from "node:fs/promises"
import { dirname,resolve,sep } from "node:path"
import { fileURLToPath } from "node:url"
import { REVIEW_AXES } from "./kompas-score-review.mjs"
export function createReviewTemplate(paired) {
 if(paired?.quality!=="unverified"||paired?.count!==50||paired?.pairs?.length!==50)throw Error("Expected all fifty original unverified pairs")
 const ids=new Set()
 const cases=paired.pairs.map(p=>{
  if(typeof p.id!=="string"||!p.id||ids.has(p.id)||!p.question?.trim())throw Error("Duplicate, missing or invalid paired case")
  ids.add(p.id)
  const blank=()=>Object.fromEntries(REVIEW_AXES.map(key=>[key,{score:null,reason:"",quote:""}]))
  return {id:p.id,question:p.question,domain:"",hardFailures:[],kompas:blank(),reference:blank()}
 })
 return {
  reviewerId:"",reviewedAt:"",signedOff:false,sourceSha256:paired.sourceSha256,
  fixtureSha256:paired.fixtureSha256,
  instructions:"Enter all 8 scores (0-4) and concrete rationale per original answer on each of 50 cases, inspect factual sources, and document explicit hard failures. Then sign off. This template contains no grades.",
  cases
 }
}
export async function runCli(args) {
 if(args.length!==2)throw Error("Usage: node scripts/kompas-review-template.mjs PRIVATE_PAIRED.json PRIVATE_REVIEW_TEMPLATE.json")
 const [source,destination]=args,root=resolve(fileURLToPath(new URL("../",import.meta.url))),target=resolve(destination)
 if(target===root||target.startsWith(root+sep))throw Error("Private review template must stay outside repository")
 const paired=JSON.parse(await readFile(source,"utf8")),template=createReviewTemplate(paired)
 await mkdir(dirname(target),{recursive:true,mode:0o700})
 await writeFile(target,JSON.stringify(template,null,2)+"\n",{flag:"wx",mode:0o600})
 return {saved:target,cases:template.cases.length,scoresEntered:0}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 runCli(process.argv.slice(2)).then(x=>console.log(JSON.stringify(x)))
  .catch(e=>{console.error(e.message);process.exitCode=1})
