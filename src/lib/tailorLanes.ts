/**
 * How the parts of a resume draft are handed to the models that can write them.
 *
 * A LANE is one (provider, model) pair. It matters because a provider counts its limits per model: on Groq's free tier each
 * model has its own 8,000 tokens a minute, and one part of a draft (prompt plus reply) takes about 5,000 of them, so a model
 * gives ONE part a minute. Every other model the same key reaches is a further lane with an allowance of its own.
 *
 * Why (2026-10-05): with Gemini and Claude out of credit and the OpenRouter model withdrawn, every part of a draft went to the
 * one model left, was refused, was retried one after another on each provider's single model, and then the whole draft was
 * started again on the next provider: 43 calls in 20 seconds for a two-part draft, none usable. Earlier the same day a person
 * was sent their own resume back as "tailored, 28% -> 28%".
 *
 * The rule here: the draft is a list of parts in order of importance. Each lane, in the ladder's order, takes parts nobody has
 * taken: a wide lane (a provider with real capacity) all of them at once, a narrow lane (a free allowance) one at a time. A
 * part a lane could not do goes back on the list for the lanes that have not tried it. A lane that turned out dead or out of
 * allowance takes no more. So a healthy first provider still writes the whole draft by itself in one burst, and when it is
 * down the parts spread over whatever answers, the most important part to the strongest lane that is left.
 */
import type { ProviderPref } from "./llm"

export type Lane = { pref: ProviderPref; model?: string; label: string; exact?: boolean }
/** What a lane's refusal says about asking it again during THIS tailor. */
export type LaneOut = Map<Lane, "dead" | "busy">

/** Sort a refusal: "dead" will not clear (no credit, a rejected key, a model that is gone), "busy" is a spent per-minute
 *  allowance. Anything else (a timeout, a reply that would not parse) leaves the lane open for other parts. */
export function judgeLane(out: LaneOut, lane: Lane, err: unknown): void {
  const m = String((err as Error)?.message || err)
  if (/API (400|401|402|403|404)\b/.test(m)) out.set(lane, "dead")
  else if (/API (413|429)\b/.test(m)) out.set(lane, "busy")
}

/** A provider with real capacity answers every part of a draft at once; a free allowance takes one part at a time. */
export const wideLane = (lane: Lane): boolean => lane.pref === "openai" || lane.pref === "anthropic" || lane.pref === "gemini" || lane.pref === "auto"

/** The extra models of a provider, from a comma-separated setting (an empty setting means none). */
export function extraModels(setting: string | undefined, standard: string): string[] {
  return (setting ?? standard).split(",").map(s => s.trim()).filter(Boolean)
}

export type Worked<P, E> = { part: P; e: E | null; via: string; err: unknown }

/**
 * Work through `parts` on `lanes`. Resolves when every part is settled or at `assembleBy`, whichever is first; calls still
 * running then are left behind and their parts come back without a result.
 *
 * `says(part, e)` tells a reply with content from a well-formed reply that changes nothing ({"bullets":[]}). From a wide lane
 * an empty reply is taken as its answer (an old role may honestly need no change). From a narrow lane it is more often the
 * model giving up (measured 2026-10-05: gpt-oss-20b spent 1,853 of 1,884 output tokens reasoning and returned no edits, and
 * that empty draft went out as "tailored, 50% -> 50%"), so the part is offered to up to two more lanes, and only if they also
 * change nothing is the empty reply the result.
 */
export async function workParts<P, E>(o: {
  parts: P[]
  lanes: Lane[]
  out: LaneOut
  ask: (part: P, lane: Lane) => Promise<E>
  says: (part: P, e: E) => boolean
  /** No call is started after this time (ms since epoch): it would not be back in time. */
  startBy: number
  assembleBy: number
  /** How long before `startBy` another lane must be given a part for it to have a fair chance (default 6 s). A call still
   *  unanswered at that moment is given up on while another lane could do its part. Found in review (2026-10-05): the lane
   *  that leads works alone until its whole burst has settled, so one provider that hung until the call timeout left every
   *  other lane no time, and the tailor failed with all of them idle. */
  fallbackMs?: number
  now?: () => number
}): Promise<Worked<P, E>[]> {
  const now = o.now || Date.now
  const fallbackMs = o.fallbackMs ?? 6000
  type Slot = { part: P; e: E | null; err: unknown; via: string; tried: Set<Lane>; busy: Promise<void> | null; hollow: E | null; hollowVia: string; asked: number }
  const slots: Slot[] = o.parts.map(part => ({ part, e: null, err: null, via: "", tried: new Set<Lane>(), busy: null, hollow: null, hollowVia: "", asked: 0 }))
  const wanted = (s: Slot, lane: Lane) => s.e === null && !s.tried.has(lane) && s.asked < 3

  const run = (s: Slot, lane: Lane): Promise<void> => {
    s.tried.add(lane)
    // Wait for this call only as long as that still leaves another lane room. The call itself is not cancelled (it has its
    // own timeout); its late answer is simply not used. With too little time left to be worth a limit, it runs unlimited.
    const elsewhere = o.lanes.some(l => l !== lane && !o.out.has(l) && !s.tried.has(l))
    const wait = o.startBy - fallbackMs - now()
    let limit: ReturnType<typeof setTimeout> | undefined
    const answer: Promise<E> = elsewhere && wait >= fallbackMs / 3
      ? Promise.race([o.ask(s.part, lane), new Promise<never>((_, reject) => {
          limit = setTimeout(() => reject(new Error("TimeoutError: no answer in the time that still leaves another model room for this part")), wait)
        })])
      : o.ask(s.part, lane)
    const going: Promise<void> = answer
      .then(e => {
        if (o.says(s.part, e) || wideLane(lane)) { s.e = e; s.via = lane.label }
        else { s.hollow = e; s.hollowVia = lane.label; s.asked++ }
      }, err => { s.err = err; judgeLane(o.out, lane, err) })
      .then(() => { if (limit) clearTimeout(limit); s.busy = null })
    s.busy = going
    return going
  }
  const work = async (lane: Lane): Promise<void> => {
    for (;;) {
      if (o.out.has(lane) || now() > o.startBy) return
      const open = slots.filter(s => wanted(s, lane) && !s.busy)
      if (open.length) { await Promise.all((wideLane(lane) ? open : open.slice(0, 1)).map(s => run(s, lane))); continue }
      // Nothing to take now. A part another lane is working on may still come back: wait for one of those, then look again.
      const pending = slots.filter(s => wanted(s, lane) && s.busy).map(s => s.busy as Promise<void>)
      if (!pending.length) return
      await Promise.race(pending)
    }
  }
  // The wide lanes that lead the ladder go first and alone, one after another: a healthy one writes everything and nothing
  // else is spent, and a dead one is found out in a fraction of a second. Then every lane works at once, which hands the
  // parts out in order: the first part to the strongest lane that is left, the second to the next.
  const everything = (async () => {
    for (const lane of o.lanes) {
      if (!wideLane(lane) || slots.every(s => s.e !== null)) break
      await work(lane)
    }
    await Promise.all(o.lanes.map(work))
  })()
  let clock: ReturnType<typeof setTimeout> | undefined
  await Promise.race([everything, new Promise<void>(resolve => { clock = setTimeout(resolve, Math.max(0, o.assembleBy - now())) })])
  if (clock) clearTimeout(clock)
  // An empty reply stands as the result only when a second lane also changed nothing, or when there was no other lane to
  // ask. One free model's empty reply that nobody could check (the others refused, or time ran out) is a part that was not
  // done: counted as done, the draft went out and was cached as whole with that part untouched (found in review).
  const stands = (s: Slot) => s.asked >= 2 || o.lanes.length < 2
  // Read once, now: a call that comes back after this moment changes nothing.
  return slots.map(s => s.e !== null ? { part: s.part, e: s.e, via: s.via, err: null }
    : s.hollow !== null && stands(s) ? { part: s.part, e: s.hollow, via: s.hollowVia, err: null }
    : { part: s.part, e: null, via: "", err: s.err ?? (s.hollow !== null ? new Error("The reply changed nothing and no other model could be asked to check it") : null) })
}
