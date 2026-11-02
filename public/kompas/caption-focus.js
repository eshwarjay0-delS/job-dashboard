// Local, source-agnostic interview-question selection. No extra model round trip.
(function(root){
"use strict";
const clean=v=>String(v||"").replace(/[\u0000-\u001f]+/g," ").replace(/\s+/g," ").trim();
const question=/\b(?:what|how|why|when|where|which|who|can you|could you|would you|will you|do you|did you|have you|tell me|tell us|walk me through|walk us through|describe|explain|compare|outline|give me an example|share an example)\b/i;
const filler=/^(?:yeah|yes|no|okay|ok|right|sure|good|thanks|thank you|umm?|uhh?|well|so|hmm|all right)[.!?,\s]*$/i;
const social=/^(?:hello|hi|good (?:morning|afternoon|evening)|thank you|thanks|nice meeting|hold on|one moment|moving on|next question)\b/i;
const narrative=/^(?:i(?:'m| am) going to|i (?:need|want|have|haven't|didn't)|let'?s (?:get|go|move|start)|thanks? (?:for|and)|good (?:morning|afternoon|evening))\b/i;
const rejected=/^(?:previous question|next question|i need help|i want a moment|i need a moment)[.!?]*$/i;
const intro=/^(?:okay|alright|all right|so|well|now|let's say|for example|suppose|imagine|assume|consider|if)\b/i;
const technical=/\b(?:dns|dhcp|ip|http|https|endpoint|windows|linux|azure|aws|security|authentication|active directory|admin|privilege|cyberark|zscaler|crowdstrike|defender|routing|network|firewall|api|database|kubernetes|8\.8\.8\.8|hostname|host|browser|browse|ping|troubleshoot|incident|policy|exception|rollback)\b/i;
function segments(raw){
  // A dotted IP address is not a sentence boundary.
  return clean(raw.replace(/(\d)\.(\d)/g,"$1§$2")).split(/(?<=[?!])\s+|(?<=[.])\s+(?=[A-Z])/).map(s=>s.replace(/§/g,".").trim()).filter(Boolean);
}
function score(s){
  if(filler.test(s)||social.test(s)&&!question.test(s))return -10;
  let v=question.test(s)?4:0;
  if(technical.test(s))v+=2;
  if(/\?/.test(s))v+=1;
  if(/\b(?:you|your|we)\b/i.test(s))v+=1;
  if(/\b(?:right|correct|okay|good|ready)\?$/i.test(s)&&s.split(/\s+/).length<12)v-=7;
  if(narrative.test(s)&&!question.test(s))v-=3;
  return v;
}
function pick(value){
  const raw=clean(value).replace(/^(?:Them|Interviewer|You)\s*:\s*/i,"");
  if(!raw||filler.test(raw)||rejected.test(raw)||social.test(raw)&&raw.split(/\s+/).length<7)return "";
  const items=segments(raw);
  if(!items.length)return "";
  const scores=items.map(score);
  let anchor=-1;
  for(let i=0;i<items.length;i++)if(question.test(items[i])&&scores[i]>=4)anchor=i;
  if(anchor<0){
    const words=raw.split(/\s+/);
    return words.length<=5&&!social.test(raw)&&!filler.test(raw)&&/^[\w+#.\s-]+$/i.test(raw)?raw:"";
  }
  let start=anchor;
  // Include a compact setup immediately preceding the question, not old unrelated dialogue.
  for(let i=anchor-1;i>=Math.max(0,anchor-3);i--){
    const s=items[i];
    if(scores[i]<0||question.test(s)&&!/^\s*(?:and|also|what about|how about)/i.test(items[i+1]))break;
    if(technical.test(s)||intro.test(s)||/\b(?:you|your|we|it|that|this|but|however)\b/i.test(s)||/^\s*(?:and|also|so)\b/i.test(items[i+1]))start=i;
    else break;
  }
  let end=anchor;
  for(let i=anchor+1;i<Math.min(items.length,anchor+4);i++){
    const s=items[i];
    if(scores[i]<0)break;
    if(question.test(s)&&(/^(?:and|also|so|what about|how about)\b/i.test(s)||technical.test(s)))end=i;
    else break;
  }
  const selected=items.slice(start,end+1).join(" ").trim();
  return selected.length<=3500?selected:selected.slice(-3500);
}
root.KompasCaptionFocus={pick,segments};
if(typeof module!=="undefined"&&module.exports)module.exports={pick,segments};
})(typeof window!=="undefined"?window:globalThis);
