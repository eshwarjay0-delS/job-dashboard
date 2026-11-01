import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
const app=readFileSync("public/kompas/app.js","utf8")
const html=readFileSync("public/kompas/index.html","utf8")
const main=readFileSync("legacy/perfact/desktop/main.js","utf8")
const preload=readFileSync("legacy/perfact/desktop/preload.js","utf8")
const packageScript=readFileSync("legacy/perfact/desktop/scripts/package.mjs","utf8")
const sidecar=readFileSync("legacy/perfact/desktop/live-captions-uia.ps1","utf8")
const route=readFileSync("src/app/api/kompas/screen/route.ts","utf8")

function extract(name,next){
 const i=app.indexOf(name),j=app.indexOf(next,i)
 assert.ok(i>0 && j>i, name + " slice boundaries")
 return app.slice(i,j)
}
function vocabHarness(){
 const snippet=extract("function captionTechnicalCorrection(","function onTranscript(")
 const context={
   termVocab:()=>["SIEM","SOAR","CyberArk","EPM","SAML","OAuth","PKI","EDR","XDR","SOC","SQL","Kerberos"],
   fixTerms:s=>s,fixPhrases:s=>s
 }
 runInNewContext(snippet+"\nthis.correct=captionTechnicalCorrection;",context)
 return s=>context.correct(s)
}
test("Caption title and native direct reader are available in installed Windows build",()=>{
 assert.match(html,/>▣ Caption Capture <b id="captionCaptureState">OFF<\/b>/)
 assert.match(html,/id="screenCaptureAnswerBtn"[^>]*aria-pressed="false"/)
 assert.match(preload,/monitorCaptions: \(enabled\) => ipcRenderer.invoke\("kompas:caption-monitor"/)
 assert.match(preload,/onCaptionText: \(fn\) =>/)
 assert.match(main,/ipcMain.handle\("kompas:caption-monitor"/)
 assert.match(main,/windows-live-captions-uia/)
 assert.match(main,/desktopCapturer.getSources\(\{ types: \["window"\]/)
 assert.match(main,/desktopCapturer.getSources\(\{\s*types: \["screen"\]/)
 assert.match(packageScript,/asarUnpack: \["live-captions-uia.ps1"\]/)
 assert.match(sidecar,/System.Windows.Automation.TextPattern/)
 assert.match(sidecar,/TreeScope\]::Children/)
 assert.doesNotMatch(sidecar,/Invoke-RestMethod|Invoke-WebRequest|Start-Transcript|Out-File/)
})
test("Caption Capture requires explicit consent each session before remote screen OCR",()=>{
 assert.match(app,/let captionCaptureEnabled = false;/)
 assert.match(app,/typeof window\.confirm !== "function"/)
 assert.match(app,/desktop display may be sent to the authenticated screen-analysis service/)
 assert.match(app,/function captionEnd\(\) \{\s*captionCaptureEnabled = false;/)
 assert.match(app,/if \(!running \|\| !captionCaptureEnabled \|\| captionCaptureBusy\) return;/)
 assert.match(html,/id="screenCaptureAnswerBtn"[^>]*aria-pressed="false"/)
})
test("Native direct caption route gets priority, with 200ms local quiet detector",()=>{
 assert.match(app,/captionDirectAt = Date.now\(\);\s*captionSeenAt = captionDirectAt/)
 assert.match(app,/captionQuietTimer = setInterval\(\(\) => captionCommitIfQuiet\(\), 200\)/)
 assert.match(app,/Date.now\(\) - captionDirectAt < 5500/)
 assert.match(app,/questionSource\(\) \{[\s\S]{0,290}captionSeenAt[\s\S]{0,85}return "Them"/)
 assert.match(app,/if \(!fromAuto && captionCaptureEnabled && running && captionDraft\)/)
 assert.match(app,/if \(captionCaptureTimer\) clearInterval\(captionCaptureTimer\)/)
 assert.match(app,/if \(window\.kompasDesktop\?\.monitorCaptions\) void window\.kompasDesktop\.monitorCaptions\(false\)/)
})
test("Caption OCR only reads a recognized Windows Live Captions region",()=>{
 assert.match(route,/const captionMode =/)
 assert.match(route,/Windows Live Captions floating or docked window/)
 assert.match(route,/captionCrop \? "Read only the live caption text/)
 assert.match(route,/return NextResponse\.json\(\{ visible: true, text, bounds \}/)
 assert.match(route,/checkRateLimit\(\`kompas-screen:\$\{user\.id\}\`/)
})
test("Technical jargon: SIEM, SOAR, CyberArk and common acronyms",()=>{
 const fix=vocabHarness()
 assert.equal(fix("How do you use seem for security log monitoring?"),"How do you use SIEM for security log monitoring?")
 assert.equal(fix("What is seem?"),"What is SIEM?")
 assert.equal(fix("What is sore?"),"What is SOAR?")
 assert.equal(fix("Can you explain cyber ark access policies?"),"Can you explain CyberArk access policies?")
 assert.equal(fix("How do you configure e d r endpoint detection?"),"How do you configure EDR endpoint detection?")
 assert.equal(fix("What does sam l authentication involve?"),"What does SAML authentication involve?")
 assert.equal(fix("Explain the PKI certificate chain and TLS trust."),"Explain the PKI certificate chain and TLS trust.")
})
test("Jargon corrections do not change everyday conversational uses",()=>{
 const fix=vocabHarness()
 assert.equal(fix("It would seem the security policy failed."),"It would seem the security policy failed.")
 assert.equal(fix("My shoulder is sore from work."),"My shoulder is sore from work.")
 assert.equal(fix("How does the eagle soar?"),"How does the eagle soar?")
})
test("Rolling captions append new words; identical frames never duplicate questions",()=>{
 const snippet=extract("function captionNormalized(","function captionQuestionLike(")
 const context={}
 runInNewContext(snippet+"\nthis.delta=captionDelta; this.normalized=captionNormalized;",context)
 assert.equal(context.delta("Could you explain","Could you explain SIEM alerts"),"SIEM alerts")
 assert.equal(context.delta("What is a SIEM","a SIEM and how do alerts work"),"and how do alerts work")
 assert.equal(context.delta("What is SIEM?","What is SIEM?"),"")
 assert.equal(context.delta("How are you","are you"),"")
})
test("Capture continuously updates the answer input, then uses normal Kompas question formation",()=>{
 assert.match(app,/box\.dataset\.captionDraft = "1"/)
 assert.match(app,/captionTechnicalCorrection\(captionDraft\)/)
 assert.match(app,/onTranscript\("Them", complete, false, Date\.now\(\), true\)/)
 assert.match(app,/void aiAnswer\(true\)/)
 assert.match(app,/let pending = turnWindow\(pendingHeard\(\), questionSource\(\)/)
 assert.match(app,/await generateAnswer\(/)
})
