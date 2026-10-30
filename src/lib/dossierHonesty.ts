// Honesty rule for dossier items (hand-off kit README section 2, AQ). Mirrored verbatim from the r12 slot gate in
// kompasSourceRetrieval.ts (jd-grounding-r12, 2172d70; flag OFF on the shipped line, not on master). Not imported:
// it is unmerged live-retrieval code, and this module must not touch retrieval. Rule: if the question asks for a kind
// of value (person, title, number, money, date, result, named tool) and the sources do not state that kind of value
// near a word of the question, the answer is "not in your sources". scripts/tests/kompas-dossier-handoff.test.mjs
// keeps the patterns identical to the fixture copy.

const STOP = new Set(("the and for with that this from your you have has was were are what how why when where which who did does " +
  "about tell time work experience describe example handle give walk through would could should can will into used use using " +
  "ever been them they their there then than also just like some more most very each every other").split(" "))
const stem = (t: string) => t.length > 4 && /[^s]s$/.test(t) ? t.slice(0, -1) : t
function tokens(text: string): string[] {
  const raw = String(text || "").toLowerCase().replace(/[^a-z0-9+#%-]+/g, " ").split(/\s+/).map((t) => t.replace(/^-+|-+$/g, ""))
  const joined = raw.slice(1).map((t, i) => raw[i] + t).filter((t) => t.length >= 8)
  const unhyphen = raw.filter((t) => t.includes("-")).map((t) => t.replace(/-/g, ""))
  return [...raw, ...joined, ...unhyphen].filter((t) => t.length >= 3 && !STOP.has(t)).map(stem)
}
const ASK_GENERIC = new Set(("done do doing did make made making keep kept keeps many much more most mention mentioned prepare prepar meet meeting met use used using usage "
  + "handle handl speed fast quick quickly approach work worked working get got give gave take took run ran running go went going come came "
  + "think thought feel felt know knew want wanted need needed like liked help helped start started stop stopped tell told talk talked walk "
  + "describe explain example examples time times thing things something anything everything someone people person kind sort type part parts "
  + "best better good great hard hardest easy easier biggest big small large lot lots way ways really actually just also still ever never "
  + "usually typically generally exactly specifically overall today recently currently first last next previous past future year years month "
  + "months week weeks day days ensure make sure deal dealt manage managed apply applied build built create created set setup set-up "
  + "improve improved reduce reduced increase increased change changed look looked find found decide decided choose chose pick picked "
  + "role roles job jobs task tasks project projects process processes team teams company companies area areas field level levels").split(/\s+/))

export type AskSlot = "person" | "title" | "count" | "money" | "date" | "outcome" | "tech"
export const SLOT_ASK: [AskSlot, RegExp][] = [
  ["money", /\b(?:salary|salaries|budget|compensation|pay(?:ed|id)?|earn(?:ed)?|bonus)\b|\bhow much\b[^?]*\b(?:cost|spend|spent|price)|\b(?:cost|price)\b[^?]*\b(?:per|a) (?:year|month|seat)/i],
  ["person", /\bwho (?:was|is|were|did|managed|hired|led|ran)\b|\bname of (?:your|the) |\b(?:manager|boss|supervisor)'s name\b/i],
  ["title", /\b(?:job|exact|official|your) title\b|\bwhat (?:was|is) your title\b/i],
  ["date", /\bwhen did\b|\b(?:what|which|in what) (?:year|month|date)\b|\bstart date\b/i],
  ["outcome", /\b(?:percentage|percent)\b|\bhow did [^?]*\bcome out\b|\b(?:final|exact) (?:result|outcome|score)\b/i],
  ["tech", /\bwhat (?:siem|edr|xdr|soar|stack|tech stack|language|database|cloud|scanner|firewall|vendor)\b[^?]*\b(?:did|does|at|run|use)\b/i],
  ["count", /\bhow many\b|\bwhat (?:number|count) of\b|\b(?:team|headcount) size\b/i],
]
export function askedSlot(q: string): AskSlot | null {
  try { for (const [slot, re] of SLOT_ASK) if (re.test(q)) return slot } catch { /* failsafe */ }
  return null
}
export const SLOT_VALUE: Record<AskSlot, RegExp> = {
  person: /\b(?:[Mm]anager|[Bb]oss|[Ss]upervisor|[Rr]eport(?:ed|s)? (?:directly )?to|CISO|CIO|CTO|VP|[Dd]irector|[Ll]ed by|[Hh]ired by)\b[^.\n()?]{0,40}?\b(?![A-Z][a-z]+ (?:Bank|Health|Group|Financial|Energy|Inc|Corp|Services|Security|Management|Can|What|How)\b)[A-Z][a-z]+ [A-Z][a-z]+|\b[A-Z][a-z]+ [A-Z][a-z]+, (?:the|my|our) (?:CISO|CIO|CTO|VP|[Dd]irector|[Mm]anager)/,
  title: /\b(?:[Tt]itle|[Pp]osition) (?:was|is|of)\b|\b(?:Senior|Lead|Principal|Staff|Junior|Chief|Head) [A-Z][a-z]+/,
  // a count, but not a duration or a share ("seven years", "30 days", "64%")
  count: /(?:\b\d[\d,.]*|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|hundred|thousand))\b(?!\+?\s*(?:-\s*)?(?:years?|months?|weeks?|days?|hours?|minutes?|%|percent|am|pm)\b)(?!%)/i,
  money: /[$£€]\s?\d|\b\d[\d,.]*\s?(?:k|K|million|billion|thousand|USD|dollars)\b/,
  date: /\b(?:19|20)\d\d\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\bQ[1-4]\b/,
  outcome: /\d\s?%|\bpercent\b|\b(?:passed|failed|reduced|cut|dropped|increased|improved|zero|no findings)\b[^.\n]{0,40}\d/i,
  tech: /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b|\b[A-Z]{3,}\b|\b(?:Splunk|Sentinel|QRadar|Chronicle|Elastic|ArcSight|LogRhythm|CrowdStrike|Defender|Tenable|Qualys|Okta|Python|Java|Go|AWS|Azure|GCP)\b/,
}
// "when did you start / join" needs the date beside a start word, not any year near the employer name
const START_ASK = /\b(?:start|started|join|joined|hired|begin|began)\b/i
const START_WORD = /\b(?:start(?:ed|ing)?|join(?:ed|ing)?|hired|beg[ai]n|since|onboarded)\b/i
// "how many people / how big a team" needs a head count ("a team of six", "12 engineers"), not any number near the employer
const TEAM_ASK = /\bhow many (?:people|engineers|analysts|staff|direct reports|reports|members|persons?)\b|\b(?:team|headcount) size\b|\bhow (?:big|large) (?:was|is) (?:your|the) team\b/i
const TEAM_COUNT = /\bteam of (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a dozen)\b|(?:\b\d[\d,]*|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen))[- ](?:\w+ )?(?:people|engineers|analysts|staff|direct reports|reports|members|person|FTEs?|contractors)\b/i
// the cue word of an ask ("title", "manager", "salary") is not the shared topic: the value must sit by another topic word
const SLOT_CUE = /^(?:title|job|exact|official|manag|manager|boss|supervisor|report|salar|salary|budget|compensat|pay|paid|earn|cost|price|percent|percentag|result|outcome|final|start|year|month|date|name|number|count|team|size|siem|edr|stack|tech|tool)/
export function slotFilled(slot: AskSlot, text: string, topic: string[], startAsk = false, teamAsk = false): boolean {
  const want = new Set(topic)
  return text.split(/(?<=[.!?;])\s+|\n+/).some((s) => SLOT_VALUE[slot].test(s) && (!startAsk || slot !== "date" || START_WORD.test(s)) && (!teamAsk || slot !== "count" || TEAM_COUNT.test(s)) && (!want.size || tokens(s).some((t) => want.has(t))))
}

export const SLOT_LABEL: Record<AskSlot, string> = { person: "name", title: "title", count: "number", money: "figure", date: "date", outcome: "result", tech: "tool" }

/** The asked slot and whether any source states a value of that kind beside a question word. */
export function honestyCheck(item: { q: string }, sources: Array<string | undefined>): { slot: AskSlot | null; filled: boolean } {
  try {
    const q = String(item?.q || "")
    const slot = askedSlot(q)
    if (!slot) return { slot: null, filled: true }
    const words = tokens(q).filter((t) => t.length >= 3 && !ASK_GENERIC.has(t) && !SLOT_CUE.test(t))
    const filled = sources.some((s) => slotFilled(slot, String(s || ""), words, START_ASK.test(q), TEAM_ASK.test(q)))
    return { slot, filled }
  } catch { return { slot: null, filled: true } }
}

/** Each sentence that states a value of the slot's kind becomes a marked hole. */
export function holeSlot(slot: AskSlot, text: string): string {
  return String(text || "").split(/(?<=[.!?;])\s+/).map((s) => SLOT_VALUE[slot].test(s) ? `[ ___ confirm: your actual ${SLOT_LABEL[slot]} ]` : s).join(" ")
}
