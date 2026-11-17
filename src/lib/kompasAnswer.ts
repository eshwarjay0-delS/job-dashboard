export { matchBank } from "./kompasPreparedQuestionBank.ts"
import { repairDictation } from "./kompasDictation.ts"
import { formQuestionFromHeard } from "./kompasQuestionIntake.ts"
import { latestInterviewerAsk } from "./kompasInterviewPrecision.ts"
import { interviewIntent } from "./kompasRelevance.ts"

// Kompas answer intelligence â€” ported from perfACT's interview engine
// (copilot/api/answer.js + _audiences.js), running on MarketFit's OpenRouter
// provider. perfACT's classification, length calibration, follow-up chaining
// and question-detection gates; MarketFit's provider, dossier grounding and
// [beat]/[breath] pause architecture.

export type Tier = 0 | 1 | 2 | 3 | 4

const IDENTITY =
  /\b(intro(duc(e|tion))?|about yourself|tell me about your (experience|background)(?! (with|in|of|on|using|at|as|around)\b)|tell me about you\b|walk me through your (background|resume|cv|career|experience|profile)|your background|who are you|describe yourself|elevator pitch|your story|summari[sz]e your (experience|background|career)|(all )?about your (career|background|journey)|how you got (to )?where you are)\b/i
const T1 =
  /\b(tell me about a time|walk me through|describe a (time|situation)|give me an example|tell me about (a|an|the|your)|have you (ever|personally)|share an (example|experience))\b/i
const NOT_T1 =
  /\bwalk me through (how (you|we|i) (would|'d|should|could)|how to|what (you|we) would)\b|\bhave you (ever )?(used|worked with|heard of|touched)\b/i
const T3 =
  /\b¶»§q«^