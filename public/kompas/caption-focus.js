// Fast, deterministic focus of REAL spoken captions, never a second AI
// request. A capture is frozen before this runs; scrolling cannot change it.
(function (root) {
  "use strict";
  const clean = value => String(value || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  const ASK = /\b(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:describe|explain|tell|show|walk|outline|share|give|compare|discuss|summari[sz]e)|tell\s+(?:me|us)\s+(?:about|a|an|how|what)|(?:walk|talk)\s+(?:me|us)\s+through|describe\b|explain\b|outline\b|compare\b|share\s+an?\s+example|give\s+(?:me|us)\s+(?:an?\s+)?example|what\s+(?:is|are|was|were|would|do|does|did|can|could|should|exactly|about|happens)|what\s+(?:[\w-]+\s+){1,3}(?:do|does|did|have|has|had|would|could|should|can|will)\s+(?:you|we|they|a\s+team)|how\s+(?:do|does|did|have|has|had|would|could|can|should|is|are|was|were|much|many|long|about)|(?:have|has|did|do)\s+you\s+(?:ever\s+)?|why\s+(?:is|are|did|do|does|would|could|should)|which\s+(?:of|one|approach|tool|framework|method|option)|when\s+(?:would|should|did|do|does|is)|where\s+(?:would|do|does|did|is)|who\s+(?:would|does|did|is))\b/gi;
  const NOISE = /^(?:(?:yeah|yes|no|okay|ok|right|sure|good|thanks|thank you|umm?|uhh?|well|so|like|you know|hmm|all right)[,.\s]*)+$/i;
  // Short captions can be conversational filler, not interview keywords.
  // Reject only complete, common discourse phrases; preserve technical and
  // non-security keyword fragments (including terms such as Next.js).
  const NONQUESTION_FRAGMENT = /^(?:hello(?:\s+(?:there|everyone))?|hi(?:\s+(?:there|everyone))?|good\s+(?:morning|afternoon|evening|night)(?:\s+(?:everyone|all))?|thanks?(?:\s+(?:for\s+(?:attending|joining|watching|listening)|everyone|all))?|thank\s+you(?:\s+(?:for\s+(?:attending|joining|watching|listening)|everyone|all))?|(?:next|previous)\s+question|moving\s+on|(?:please\s+)?(?:hold\s+on|one\s+moment)|i\s+(?:need|want)\s+(?:help|a\s+moment))\s*[.!]?$/i;
  const NONQUESTION_TAIL = /^(?:because\s+(?:this|that|it|i|we)|i(?:'m| am) going to\b|i (?:need|want|have|haven't|didn't)\b|let'?s (?:get|go|move|start)\b|good (?:afternoon|morning|evening)\b|thanks?\s+(?:for|and)\b|the (?:next|first) (?:one|thing|video|file)\b)/i;
  const RELATED = /^(?:and|also|so)\s+(?:what|how|why|which|where|when|can|could|would|do|does|did)\b/i;
  function pick(value) {
    const raw = clean(value).replace(/^(?:(?:Them|Interviewer|You)\s*:\s*)/i, "");
    if (!raw || NOISE.test(raw) || NONQUESTION_FRAGMENT.test(raw)) return "";
    const matches = [...raw.matchAll(ASK)];
    const asks = matches.filter(m => {
      const tail = raw.slice(m.index + m[0].length).trim();
      // An explicit imperative ("Describe IAM") needs a named subject, while
      // "what are..." must name at least one real concept after the verb.
      return tail.length >= 3 && tail.split(/\s+/).length >= 1;
    });
    if (!asks.length) {
      // Existing keyword-fragment behavior: still answer a short named term.
      return raw.split(/\s+/).length <= 4 && /^[a-z0-9][\w+#.\s-]*$/i.test(raw) ? raw : "";
    }
    // A single interviewer question can include "describe X and what Y".
    // Its first explicit ask is the anchor; related subquestions stay attached.
    // New independent asks following a question mark are later turns.
    let start = asks[0].index;
    for (let k = 1; k < asks.length; k++) {
      const between = raw.slice(start, asks[k].index);
      if (/[?!][\s]+/.test(between) && !/^(?:\s*(?:and|also|so)\b)/i.test(raw.slice(Math.max(0, asks[k].index - 9), asks[k].index))) {
        // Keep related adjacent asks but discard prior unrelated full turns.
        if (between.length > 170 || /\b(?:moving on|next question|let's move on)\b/i.test(between))
          start = asks[k].index;
      }
    }
    const tail = raw.slice(start);
    const parts = tail.split(/(?<=[.?!])\s+/);
    if (parts.length === 1) return tail.slice(0, 3500);
    let kept = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const next = parts[i].trim();
      if (!next || NONQUESTION_TAIL.test(next)) break;
      if (RELATED.test(next)) { kept += " " + next; continue; }
      // A second independent question is retained only when explicit and
      // closely adjacent, not unrelated video narration after the ask.
      if (ASK.test(next) && kept.length < 400 && next.split(/\s+/).length <= 35) {
        ASK.lastIndex = 0;
        kept += " " + next;
        continue;
      }
      ASK.lastIndex = 0;
      break;
    }
    return kept.trim().slice(0, 3500);
  }
  root.KompasCaptionFocus = { pick };
  if (typeof module !== "undefined" && module.exports) module.exports = { pick };
})(typeof window !== "undefined" ? window : globalThis);
