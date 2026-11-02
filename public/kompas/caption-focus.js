// Single-pass caption question extraction. Never used by continuous voice dictation.
// Local string parsing only; no model, network request, polling or recording.
(function(root){
"use strict";
function pick(value) {
  const raw=String(value||"").replace(/[\u0000-\u001f]+/g," ").replace(/\s+/g," ").trim().replace(/^(?:(?:Them|Interviewer|You)\s*:\s*)/i,"");
  if(!raw) return "";
  if(/^(?:hi(?: there| everyone)?|hello(?: there| everyone)?|good (?:morning|afternoon|evening|night)(?: everyone| all)?|thanks?(?: for (?:attending|joining|watching|listening))?|thank you(?: for (?:attending|joining|watching|listening))?|next question|previous question|moving on|hold on|one moment|i need help|i want a moment)[.!]?\s*$/i.test(raw)) return "";
  const cue=/\b(?:what|how|why|which|when|where|who|have\s+you|has\s+your|did\s+you|do\s+you|does\s+your|can\s+you|could\s+you|would\s+you|will\s+you|tell\s+(?:me|us)|walk\s+(?:me|us)\s+through|describe|explain|compare|outline|share\s+(?:an?\s+)?example|give\s+(?:me|us)\s+(?:an?\s+)?example)\b/gi;
  const hits=[...raw.matchAll(cue)].filter(m=>raw.slice(m.index+m[0].length).trim().length>=3);
  if(!hits.length) return raw.split(/\s+/).length<=4 && /^[a-z0-9][\w+#.\s-]*$/i.test(raw)?raw:"";
  // A caption can contain leading setup and trailing unrelated narration:
  // the first explicit ask is an anchor. Keep adjacent linked subquestions.
  let tail=raw.slice(hits[0].index);
  tail=tail.split(/(?<=[.?!])\s+/);
  let keep=tail[0]||"";
  for(let i=1;i<tail.length;i++){
    const next=tail[i].trim();
    if(!next) continue;
    if(/^(?:and|also|so)\s+(?:what|how|why|which|when|where|who|can|could|would|did|do|does|have)\b/i.test(next)){keep+=" "+next;continue;}
    break;
  }
  keep=keep.replace(/\s+(?:because this will|because this is|i am going to|i'm going to|i haven't|let's get into|good afternoon|the next video)\b[\s\S]*$/i,"").trim();
  return keep.slice(0,3500);
}
root.KompasCaptionFocus={pick};
if(typeof module!=="undefined"&&module.exports)module.exports={pick};
})(typeof window!=="undefined"?window:globalThis);
