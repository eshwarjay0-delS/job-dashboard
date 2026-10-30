// Lens r3 (29 Oct 2026): one cleaned reading of a heard question for the lens rules (depth, explain modes, opener category).
// Hostile hunt: dictation typos ("explian", "go deper", "whats"), filler that contains "you" ("you know"), markup and
// bracket junk, doubled spaces. The ORIGINAL question is still what the model and retrieval see; this only feeds the rules.
const TYPOS: Array<[RegExp, string]> = [
  [/\b(?:explian|expalin|explan|explane)\b/g, "explain"], [/\b(?:deper|deeepr|depper|deepr)\b/g, "deeper"], [/\bsimpley\b/g, "simply"],
  [/\b(?:englsh|engish)\b/g, "english"], [/\bwhats\b/g, "what's"], [/\b(?:wat|waht|wht) is\b/g, "what is"], [/\bdiff?rence\b/g, "difference"],
  [/\btel me\b/g, "tell me"], [/\bhav you\b/g, "have you"], [/\babot\b/g, "about"], [/\btim you\b/g, "time you"],
]
const MAX = 4000 // the rules read the head and the tail of a very long ramble; the ask is almost always at one end
export function normalizeAsk(question: string): string {
  let q = String(question || "")
  if (q.length > MAX) q = q.slice(0, MAX / 2) + " . " + q.slice(-MAX / 2)
  q = q.toLowerCase().replace(/<(script|style)\b[^>]{0,200}>[\s\S]{0,2000}?<\/\1>/g, " ").replace(/<[^>]{0,200}>/g, " ").replace(/\[[^\]]{0,200}\]/g, " ")
  q = q.replace(/\b(?:you know|ya know|y'know|you see)\b,?/g, " ")
  // Lens r4: voice fillers and stutters ("um so uh what is what is MFA") are not part of the ask
  q = q.replace(/(?:^|\s)(?:um+|uh+|hmm+|erm?|ah+)(?=[\s,.?!]|$),?/g, " ").replace(/\b(\w+(?: \w+)?)(?: \1\b)+/g, "$1")
  for (const [re, to] of TYPOS) q = q.replace(re, to)
  return q.replace(/\s+/g, " ").trim()
}
/** Sentences of the cleaned ask, for questions that carry two asks ("What is MFA? And have you built one?"). */
export function askSentences(question: string): string[] {
  return normalizeAsk(question).split(/(?<=[.?!])\s+|(?<=[?!])(?=[a-z])|;\s+/).map((s) => s.trim()).filter(Boolean)
}
