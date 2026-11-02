import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const client = readFileSync(new URL("../../public/kompas/caption-once.js", import.meta.url), "utf8");
const focusSource = readFileSync(new URL("../../public/kompas/caption-focus.js", import.meta.url), "utf8");
const focusContext = {};
runInNewContext(focusSource, focusContext);
const captionFocus = focusContext.KompasCaptionFocus.pick;
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../../legacy/perfact/desktop/main.js", import.meta.url), "utf8");
const preload = readFileSync(new URL("../../legacy/perfact/desktop/preload.js", import.meta.url), "utf8");
const screen = readFileSync(new URL("../../src/app/api/kompas/screen/route.ts", import.meta.url), "utf8");
const stages = [];
const phraseBegin = app.indexOf("const PHRASE_FIXES = [");
const phraseEnd = app.indexOf("function fixTerms(", phraseBegin);
assert.ok(phraseBegin >= 0 && phraseEnd > phraseBegin, "canonical technical phrase dictionary exists");
const phraseContext = {};
runInNewContext(app.slice(phraseBegin, phraseEnd) + "\nthis.correct=fixPhrases;", phraseContext);
const phrase = phraseContext.correct;

function harness({ question="How does SIEM alert correlation work?", native=true,
                   payload, fail=false, switched=false, deferred=false } = {}) {
  const log={ captures:0, fetches:0, answers:[], status:[], shortcuts:0, event:0, windowEvents:0, releases:0 };
  const input={ value:"" };
  const button={ disabled:false, onclick:null };
  const doc = {
    getElementById(id) {
      if (id === "screenCaptureAnswerBtn") return button;
      if (id === "manualInput") return input;
      if (id === "view-copilot") return { classList: { contains:()=>false }};
      return null;
    },
    addEventListener(name,fn,capture) { if (name==="keydown" && capture) log.keyHandler=fn; },
  };
  let resolveFrame;
  const capture=() => { log.captures++;
    if (deferred) return new Promise(resolve => { resolveFrame=resolve; });
    return Promise.resolve({image:"data:image/jpeg;base64,Zml4dHVyZQ==",source:"window"});
  };
  const context = {
    window:{kompasDesktop:native?{captureCaptionOnce:capture}:null,KompasCaptionFocus:{pick:captionFocus}},
    document:doc,
    status:(text,type)=>log.status.push({text,type}),
    fixTerms:x=>x, fixPhrases:phrase,
    setChat:()=>{log.windowEvents++;},
    aiAnswer:async(...args)=>{log.answers.push(args);},
    aiBusy:false, current:{id:"session-a"},
    AbortSignal:{timeout:()=>({})},
    performance:{now:()=>1250},
    fetch:async(_url,init)=>{
      log.fetches++;
      log.request=JSON.parse(init.body);
      if (switched) context.current.id="session-b";
      return {
        ok:!fail,
        json:async()=> fail?{error:"429 rate limited"}:payload??{needsAnswer:true,question},
      };
    },
  };
  runInNewContext(client,context);
  const key=()=>{let stopped=0,prevented=0;log.keyHandler({
    ctrlKey:true,shiftKey:true,altKey:false,metaKey:false,key:"S",
    preventDefault:()=>{prevented++;},stopImmediatePropagation:()=>{stopped++;}
  });return{stopped,prevented};};
  return { log, context, button, input, key, release:()=>resolveFrame?.({image:"data:image/jpeg;base64,Zml4dHVyZQ==",source:"window"}) };
}

const dedupeCases=[
["","What is SIEM?","What is SIEM?"],
["What is SIEM?","","What is SIEM?"],
["What is SIEM?","what is siem","What is SIEM?"],
["How do you","How do you secure IAM?","How do you secure IAM?"],
["How do you secure IAM?","secure IAM","How do you secure IAM?"],
["What is SIEM?","Compare SOAR","What is SIEM?\nCompare SOAR"],
["Explain OAuth","Explain SAML","Explain OAuth\nExplain SAML"],
["SOC","SOC analyst","SOC analyst"],
["SOAR runbook","SOAR runbook","SOAR runbook"],
["Investigate a false positive","false positive","Investigate a false positive"],
["Which audit log","Which audit logs?","Which audit log\nWhich audit logs?"],
["Hello","Hello","Hello"],
["Explain TLS","How does mTLS work?","Explain TLS\nHow does mTLS work?"],
["What is PKI?","What is PKI?!","What is PKI?"],
["Cloud","cloud security","cloud security"],
["IAM and PAM","IAM","IAM and PAM"],
["Can you","Can you describe SAML?","Can you describe SAML?"],
["One","Two","One\nTwo"],
["a","ab","a\nab"],
["Act","Action","Act\nAction"],
];
for(const [prior,captured,expected] of dedupeCases) test("caption merge: "+JSON.stringify([prior,captured]),()=>{
  const h=harness();
  assert.equal(h.context.window.KompasCaptionOnce.combine(prior,captured),expected);
});

const extractionCases=[
[{needsAnswer:true,question:"What is SIEM?"},"What is SIEM?"],
[{needsAnswer:true,question:"  Compare   SIEM and SOAR  "},"Compare SIEM and SOAR"],
[{needsAnswer:true,question:"How do you configure\nOAuth?"},"How do you configure OAuth?"],
[{needsReview:true,tasks:[{question:"First?"},{question:"Second?"}]},"First?\nSecond?"],
[{needsReview:true,tasks:[{question:"Explain AD"}]},"Explain AD"],
[{needsReview:true,tasks:[]},""],
[{needsAnswer:false,question:"Ignored"},""],
[{needsAnswer:true,question:42},""],
[null,""],
[{}, ""],
];
for(const [payload,expected] of extractionCases) test("caption OCR response shape: "+JSON.stringify(payload),()=>{
  const h=harness();
  assert.equal(h.context.window.KompasCaptionOnce.extractedText(payload),expected);
});

const phraseCases=[
["seem tool","SIEM tool"],
["seam system","SIEM system"],
["sim logs","SIEM logs"],
["cyber arc","CyberArk"],
["crowd strike","CrowdStrike"],
["oh auth","OAuth"],
["kerberose","Kerberos"],
["miter attack","MITRE ATT&CK"],
["micro soft sentinel","Microsoft Sentinel"],
["power shell","PowerShell"],
["rest api","REST API"],
["base 64","Base64"],
["active directory","Active Directory"],
["luna hsm","Luna HSM"],
["My shoulder is sore","My shoulder is sore"],
];
for(const [raw,expected] of phraseCases) test("live-caption technical vocabulary: "+raw,()=>{
  assert.equal(phrase(raw),expected);
});

test("single deliberate window capture triggers exactly one corrected AI Answer",async()=>{
  const h=harness({question:"How do you configure seem tool?"});
  assert.equal(await h.context.window.KompasCaptionOnce.capture(),true);
  assert.equal(h.log.captures,1);
  assert.equal(h.log.fetches,1);
  assert.equal(h.log.request.mode,"caption-window");
  assert.equal(h.input.value,"How do you configure SIEM tool?");
  assert.equal(h.log.answers.length,1);
  assert.equal(h.log.answers[0][1].captionOnce,true);
  assert.equal(h.button.disabled,false);
});
test("old desktop cannot capture, reports the missing native update",async()=>{
  const h=harness({native:false});
  assert.equal(await h.context.window.KompasCaptionOnce.capture(),false);
  assert.equal(h.log.fetches,0);
  assert.equal(h.log.answers.length,0);
  assert.match(h.log.status.at(-1).text,/updated Kompas Windows app/);
});
test("caption OCR without text never invents a question or answer",async()=>{
  const h=harness({payload:{needsAnswer:true,question:""}});
  assert.equal(await h.context.window.KompasCaptionOnce.capture(),false);
  assert.equal(h.log.answers.length,0);
});
test("late response from a changed session is rejected",async()=>{
  const h=harness({switched:true});
  assert.equal(await h.context.window.KompasCaptionOnce.capture(),false);
  assert.equal(h.log.answers.length,0);
  assert.equal(h.input.value,"");
});
test("shortcut is intercepted exactly once and concurrent clicks never double capture",async()=>{
  const h=harness({deferred:true});
  const first=h.context.window.KompasCaptionOnce.capture();
  const second=await h.context.window.KompasCaptionOnce.capture();
  assert.equal(second,false);
  assert.equal(h.log.captures,1);
  h.release();
  assert.equal(await first,true);
  assert.equal(h.log.answers.length,1);
  const shortcut=h.key();
  assert.equal(shortcut.stopped,1);
  assert.equal(shortcut.prevented,1);
});

test("wiring and privacy: one-shot only, no screen loop, native window selected explicitly",()=>{
  assert.equal(dedupeCases.length+extractionCases.length+phraseCases.length+5,50);
  assert.match(html,/caption-once\.js/);
  assert.match(html,/>▣ Caption Capture<\/button>/);
  assert.match(preload,/captureCaptionOnce:.*kompas:caption-once/);
  assert.match(main,/desktopCapturer\.getSources\(\{ types: \["window"\]/);
  assert.match(main,/if \(matched\.length !== 1\)/);
  assert.match(main,/Windows Live Captions was not uniquely detected/);
  assert.doesNotMatch(main,/Choose the window to capture once/);
  assert.doesNotMatch(main,/setInterval\([^)]*captionSnapshotOnce/);
  assert.doesNotMatch(client,/setInterval|MediaRecorder|getDisplayMedia/);
  assert.match(app,/const hasCompleteAsk = immediateAsk\.split/);
  assert.match(app,/if \(!hasCompleteAsk && \(\(running && captures\.length\) \|\| finals\.size\)\)/);
  assert.match(screen,/const captionMode =/);
  assert.match(screen,/max_tokens: captionMode \? 1200 : 4096/);
  assert.match(screen,/source: "caption-window"/);
});


const focusCases = [
  ["So this is CIA. Can you describe the high level architecture of a SIEM and what are the core components? I am going back to my thing.", /describe the high level architecture of a SIEM and what are the core components/i, /going back/i],
  ["Because I'm reviewing files, tell me about a time when you adapted your communication style to explain a security risk to stakeholders. This will be my first job. I need a few notes.", /tell me about a time when you adapted your communication style/i, /first job/i],
  ["Well, how would you build a detection pipeline? And how would you test false positives? I'm going to start the next video.", /how would you build a detection pipeline\? And how would you test false positives\?/i, /start the next video/i],
  ["Please describe your approach to removing local admin rights.", /describe your approach to removing local admin/i, /neverthis/i],
  ["Explain the difference between a SIEM and a SOAR platform.", /explain the difference between/i, /neverthis/i],
  ["Can you walk me through your incident response triage?", /walk me through your incident response/i, /neverthis/i],
  ["What are the components of a SIEM?", /what are the components/i, /neverthis/i],
  ["What is CyberArk EPM?", /what is CyberArk/i, /neverthis/i],
  ["How does SAML work?", /How does SAML work/i, /neverthis/i],
  ["Why would a service account need JIT elevation?", /Why would/i, /neverthis/i],
  ["Where do the log collectors forward telemetry?", /Where do/i, /neverthis/i],
  ["Which tool would you choose for EDR triage?", /Which tool/i, /neverthis/i],
  ["Describe zero trust segmentation without creating an outage.", /Describe zero trust/i, /neverthis/i],
  ["Share an example of a tough security audit.", /Share an example/i, /neverthis/i],
  ["Give me an example of an access review issue.", /Give me an example/i, /neverthis/i],
  ["Tell me about a conflict you resolved with a security stakeholder.", /Tell me about a conflict/i, /neverthis/i],
  ["Walk me through a typical vulnerability triage.", /Walk me through a typical/i, /neverthis/i],
  ["Can you explain Kerberos delegation?", /Can you explain/i, /neverthis/i],
  ["What happens when the cloud identity provider is unavailable?", /What happens when/i, /neverthis/i],
  ["How would you validate an alert suppression change?", /How would you validate/i, /neverthis/i],
  ["We use AWS and Azure. How do you keep identity policies consistent?", /How do you keep identity/i, /neverthis/i],
  ["What are the steps of responding to a phishing alert? And how do you prove containment?", /What are the steps.*And how do you prove/i, /neverthis/i],
  ["Can you describe the high-level architecture of a seem and the core components so. The core components are log collector layers.", /describe the high-level architecture/i, /core components are log collector layers/i],
  ["I'm going to do a quick test. I'm going to start with the first one. I'm going to take notes.", /^$/, /neverthis/i],
  ["Because this is my first cybersecurity job, I haven't done it in the wild yet.", /^$/, /neverthis/i],
  ["Good afternoon. Thanks for attending.", /^$/, /neverthis/i],
  ["SIEM", /^SIEM$/, /neverthis/i],
  ["CyberArk EPM", /^CyberArk EPM$/, /neverthis/i],
  ["Kubernetes", /^Kubernetes$/, /neverthis/i],
  ["OAuth", /^OAuth$/, /neverthis/i],
];
for (const [spoken, expected, absent] of focusCases) test("caption focus: "+spoken.slice(0,42),()=>{
  const q=captionFocus(spoken);
  assert.match(q,expected);
  if (absent.source!=="neverthis") assert.doesNotMatch(q,absent);
});
test("three-line caption presentation never deletes the question or transcript",()=>{
  const css=readFileSync(new URL("../../public/kompas/styles.css",import.meta.url),"utf8");
  assert.match(css,/-webkit-line-clamp:3/);
  assert.match(css,/max-height:calc\(3 \* 1\.45em\)/);
  assert.match(css,/#view-copilot \.card \.q\{max-height:4\.65em\}/);
  assert.match(app,/page\.heard = "Them \(Windows Live Captions\): " \+ frozen/);
  assert.match(app,/pinned: true, derived: frozen, source: "caption-window"/);
  assert.match(app,/const captionLines = pendingHeard\(\)\.filter\(t => t\.fromCaption/);
  assert.doesNotMatch(client,/setInterval|MediaRecorder|getDisplayMedia/);
});
test("caption press avoids pending 250–1500 ms audio flush and pins its own question",()=>{
  const section=app.slice(app.indexOf("async function aiAnswer(fromAuto"), app.indexOf("$(\"screenBtn\").onclick"));
  assert.ok(section.indexOf("if (options.captionOnce)") < section.indexOf("await flushHeard("));
  assert.match(section,/return await generateAnswer\(frozen, page, \{ pinned: true/);
});
