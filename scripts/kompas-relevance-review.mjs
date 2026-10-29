/**
 * Reproducible, privacy-conscious comparison of two actual response exports.
 * This reports objective signals ONLY, never a false "semantic accuracy" score.
 * Usage: node scripts/kompas-relevance-review.mjs /path/to/pairs.json
 * input: [{"question":"...", "reference":"...", "kompas":"..."}]
 * The source resume and session never have to be committed to this repository.
 */
import {readFileSync} from 'node:fs'
import { pathToFileURL } from 'node:url'
import {questionParts,missingQuestionParts,spokenQualityFlags} from '../src/lib/kompasInterviewPrecision.ts'
import {focusPlan,tangentSignals} from '../src/lib/kompasRelevance.ts'
function words(text){return String(text||'').trim().split(/\s+/).filter(Boolean).length}
export function assessAnswer(question,answer){
 const q=String(question||''),a=String(answer||'')
 const p=focusPlan(q,2,'director')
 const missing=missingQuestionParts(q,a)
 const terms=tangentSignals(q,a)
 const flags=spokenQualityFlags(q,a)
 const count=words(a)
 const unaskedPadding=count>Math.max(p.maxWords+30,Math.ceil(p.maxWords*1.4))
 return {intent:p.intent,words:count,softCeiling:p.maxWords,knownTopics:questionParts(q).map(x=>x.label),
         missingKnownTopics:missing,unaskedJargon:terms,flags,
         overlyLong:unaskedPadding,
         diagnosticIssues:missing.length+terms.length+flags.filter(f=>!f.startsWith('missing:')).length+(unaskedPadding?1:0)}
}
export function comparePair(pair){
 const q=String(pair.question||'')
 const reference=assessAnswer(q,pair.reference)
 const kompas=assessAnswer(q,pair.kompas)
 return {question:q,reference,kompas,deltaDiagnostics:kompas.diagnosticIssues-reference.diagnosticIssues,
   note:'Diagnostics are not proof of factuality, intent understanding or human preference; a person must review both original texts.'}
}
export function compareExport(pairs){
 if(!Array.isArray(pairs))throw Error('Expected array of {question,reference,kompas}')
 const comparisons=pairs.map(comparePair)
 return {total:comparisons.length,withBoth:comparisons.filter(x=>x.reference.words&&x.kompas.words).length,
  comparisons,
  summary:{referenceDiagnosticIssues:comparisons.reduce((n,x)=>n+x.reference.diagnosticIssues,0),
    kompasDiagnosticIssues:comparisons.reduce((n,x)=>n+x.kompas.diagnosticIssues,0),
    missingOrUnrecognizedOriginals:comparisons.filter(x=>!x.reference.words||!x.kompas.words).length},
  caveat:'This report measures only static completeness, jargon and formatting signals. It cannot judge source truth or spoken relevance without listening to actual model responses.'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2]){console.error('Provide a local JSON export with both answers.');process.exitCode=2}
 else{
  const data=JSON.parse(readFileSync(process.argv[2],'utf8'))
  console.log(JSON.stringify(compareExport(data),null,2))
 }
}
