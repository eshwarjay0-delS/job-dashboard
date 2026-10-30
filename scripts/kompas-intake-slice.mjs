// Loads the shipped desktop intake code out of public/kompas/app.js so tests and the stress harness run the real code.
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadIntake() {
  const src = readFileSync(new URL("../public/kompas/app.js", import.meta.url), "utf8");
  const cut = (start, end, optional = false) => {
    const a = src.indexOf(start), b = a < 0 ? -1 : src.indexOf(end, a);
    if (a < 0 || b < 0) { if (optional) return ""; throw new Error(start + " must exist in app.js"); }
    return src.slice(a, b);
  };
  const qcue = src.slice(src.indexOf("const Q_CUE ="), src.indexOf(";", src.indexOf("const Q_CUE =")) + 1);
  const code = [
    qcue,
    cut("const PHRASE_FIXES", "function fixTerms"),
    cut("// ── Question intake", "// ── end question intake"),
    cut("function shortFollowUp(", "const armsAuto"),
    cut("// ── Source-aware intake", "// ── end source-aware intake", true),
    "this.api = { fixPhrases, intakeWords, echoShare, isNoiseLine, typedStandsAlone, shortFollowUp,",
    "  micBleed: typeof micBleed === 'function' ? micBleed : null,",
    "  roleOfSource: typeof roleOfSource === 'function' ? roleOfSource : null,",
    "  typedFollowUpQuestion: typeof typedFollowUpQuestion === 'function' ? typedFollowUpQuestion : null,",
    "  askSource: typeof askSource === 'function' ? askSource : null,",
    "  spokenWallTime: typeof spokenWallTime === 'function' ? spokenWallTime : null,",
    "  turnGate: typeof turnGate === 'function' ? turnGate : null,",
    "  decisionEvent: typeof decisionEvent === 'function' ? decisionEvent : null,",
    "  answerAnywayLines: typeof answerAnywayLines === 'function' ? answerAnywayLines : null,",
    "  gateNoAnswerNeeded: typeof gateNoAnswerNeeded === 'function' ? gateNoAnswerNeeded : null,",
    "  repeatsPriorQuestion: typeof repeatsPriorQuestion === 'function' ? repeatsPriorQuestion : null,",
    "  splitDistinctAsks: typeof splitDistinctAsks === 'function' ? splitDistinctAsks : null };",
  ].join("\n");
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { api: ctx.api, src };
}
