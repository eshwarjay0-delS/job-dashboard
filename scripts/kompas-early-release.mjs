// Early release of a partial question (slice 5c, 29 Oct 2026): DESIGN REFERENCE ONLY. Nothing in the page or the
// server imports this file, and EARLY_RELEASE_DEFAULT is false. It is the pure decision the page would call; see
// /workspace/slice5/slice5c-early-release-design.md for the hooks, risks and metrics.
//
//   canReleaseEarly(partialText, undefined, { pauseMs })  -> { release, reason }        while the interviewer talks
//   canReleaseEarly(partialText, finalText)               -> { keep, reason }           once the final text is in
//
// Release: a question opener plus an object noun phrase, a short pause, nothing dangling at the end.
// Keep: the final text is the partial plus nothing that changes the question. Anything else cancels the early work.
// Every fault answers { release: false } / { keep: false }: the normal path then runs as today (fail-open).
export const EARLY_RELEASE_DEFAULT = false;
export const EARLY_PAUSE_MS = 350;

const OPENER = /^(?:tell me about|walk me through|talk me through|what is|what are|what's|how do you|how did you|how would you|explain|describe|have you (?:ever )?(?:used|worked with|deployed|implemented|managed|led))\s+/i;
const LEAD = /^(?:(?:um+|uh+|so|okay|ok|and|alright|right|well|now)[,]?\s+)+/i;
const DANGLING = /\b(?:and|or|but|so|the|a|an|of|with|to|for|your|our|their|how|about|between|which|when|where|if|that|like|um+|uh+|in|on|at|from|versus|vs|compared|both|either|whether|why|what|also|then|specifically|particularly|especially|including)\s*$/i;
const POINTER_ONLY = /^(?:that|this|it|those|these|them|more|again|the same|yourself|a time)\b/i;   // "tell me about a time..." needs the story cue
const FILLER_TAIL = new Set("please um uh okay ok so yeah right again briefly quickly now then exactly in detail a bit more little".split(" "));
const STOP = new Set("the a an of to in on for with your our my and is are was were do does did you me us it this that".split(" "));
const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9+#' ]+/g, " ").trim().split(/\s+/).filter(Boolean);

export function canReleaseEarly(partialText, finalText, opts = {}) {
  try {
    const enabled = opts.enabled ?? EARLY_RELEASE_DEFAULT;
    const partial = String(partialText || "").replace(/\s+/g, " ").trim();
    if (finalText === undefined) {
      if (!enabled) return { release: false, reason: "flag-off" };
      const bare = partial.replace(LEAD, "").replace(/[.?!,]+$/, "").trim();
      const m = bare.match(OPENER);
      if (!m) return { release: false, reason: "no-opener" };
      const object = bare.slice(m[0].length).trim();
      const content = words(object).filter((w) => !STOP.has(w));
      if (!content.length || POINTER_ONLY.test(object)) return { release: false, reason: "no-object" };
      if (DANGLING.test(bare)) return { release: false, reason: "dangling" };
      if (!(Number(opts.pauseMs) >= EARLY_PAUSE_MS)) return { release: false, reason: "no-pause" };
      if (words(bare).length < 3) return { release: false, reason: "too-short" };
      return { release: true, reason: "opener+object+pause" };
    }
    const p = words(partial), f = words(finalText);
    if (!p.length || !f.length) return { keep: false, reason: "empty" };
    for (let i = 0; i < p.length; i++) if (p[i] !== f[i]) return { keep: false, reason: "rewritten" };   // the transcriber changed the start
    const tail = f.slice(p.length);
    if (tail.every((w) => FILLER_TAIL.has(w))) return { keep: true, reason: tail.length ? "filler-tail" : "same" };
    return { keep: false, reason: "changed" };   // new subject, a second part, a constraint ("in Azure", "and the Venafi integration")
  } catch {
    return finalText === undefined ? { release: false, reason: "fault" } : { keep: false, reason: "fault" };
  }
}
