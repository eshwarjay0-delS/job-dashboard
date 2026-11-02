import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const client = readFileSync(new URL("../../public/kompas/caption-once.js", import.meta.url), "utf8");
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
    window:{kompasDesktop:native?{captureCaptionOnce:capture}:null},
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
  assert.match(main,/let target = matched\.length === 1 \? matched\[0\] : null/);
  assert.match(main,/Only the selected window will be sent/);
  assert.doesNotMatch(main,/setInterval\([^)]*captionSnapshotOnce/);
  assert.doesNotMatch(client,/setInterval|MediaRecorder|getDisplayMedia/);
  assert.match(app,/flushHeard\(options\.captionOnce \? 250 : 1500\)/);
  assert.match(screen,/const captionMode =/);
  assert.match(screen,/max_tokens: captionMode \? 1200 : 4096/);
  assert.match(screen,/source: "caption-window"/);
});
