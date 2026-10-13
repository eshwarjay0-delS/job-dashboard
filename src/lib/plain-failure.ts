// What a person is told when something could not be done: one plain sentence, never the machinery.
//
// Asked on 13 Oct 2026, after the chat printed a failure as it came off the wire ("The agent hit an error: Groq API 429:
// {"error":{"message":"Rate limit reached for model ... in organization org_..."): "We should not show any failpoints,
// at least give minimal of real info." So the real reason is kept, in a few words a person can act on, and the rest
// (which service, its status code, its own text, an organisation id) goes to the server log and nowhere else.

export type FailureKind = "busy" | "not_set_up" | "slow" | "unreachable" | "other"

const BUSY = /\b(?:429|503|529)\b|rate.?limit|quota|tokens? per|\bTP[DM]\b|\bRP[DM]\b|overloaded|capacity|exhausted|insufficient|too many requests|allowance/i
const NOT_SET_UP = /no api key configured|no ai (?:provider )?key|invalid.{0,20}key|incorrect api key|\b(?:401|403)\b|unauthori[sz]ed|permission denied|not enabled/i
const SLOW = /time.?out|timed out|abort|deadline|ETIMEDOUT|took too long/i
const UNREACHABLE = /ENOTFOUND|ECONNRESET|ECONNREFUSED|EAI_AGAIN|fetch failed|network|socket hang up/i

const textOf = (err: unknown): string => (err instanceof Error ? `${err.name} ${err.message}` : String(err ?? ""))

/** Which of the few reasons a person can act on this failure is. */
export function failureKind(err: unknown): FailureKind {
  const text = textOf(err)
  // "No key" is asked first: a service that refuses a key answers 401, and that is not "busy".
  if (NOT_SET_UP.test(text) && !/rate.?limit|quota/i.test(text)) return "not_set_up"
  if (BUSY.test(text)) return "busy"
  if (SLOW.test(text)) return "slow"
  if (UNREACHABLE.test(text)) return "unreachable"
  return "other"
}

/**
 * One plain sentence for the person. `could` finishes "I could not ...": "answer", "tailor your resume".
 * `changed` says whether anything was already done before the failure; when nothing was, the person is told so.
 */
export function plainFailure(err: unknown, could = "answer", changed = false): string {
  const kind = failureKind(err)
  const nothing = changed ? "" : " Nothing was changed."
  if (kind === "busy") return `I could not ${could} just now: the AI service is at its limit for the moment.${nothing} Try again in a few minutes.`
  if (kind === "not_set_up") return `I could not ${could}: no AI service is switched on for this yet. The owner of this site can switch one on from the Admin page.`
  if (kind === "slow") return `I could not ${could}: it took too long, so I stopped.${nothing} Try again, or ask for one thing at a time.`
  if (kind === "unreachable") return `I could not ${could}: the AI service could not be reached.${nothing} Try again in a moment.`
  return `I could not ${could} this time.${nothing} Try again in a moment.`
}
