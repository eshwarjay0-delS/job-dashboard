/**
 * Stutter / mid-ask rephrase: the final constraint wins.
 *
 * Example: "how would you handle... well actually, what if the user is a VP
 * and refuses MFA?" resolves to the VP-refuses-MFA constraint, and a mid-sentence
 * "how would you handle" is not complete enough to fire generation.
 */

const REPHRASE_MARK = /(?:^|\s)(?:well actually|actually[,:]|no[, ]+(?:wait|sorry|i mean)|sorry[, ]+(?:i mean|actually)|i mean[,]+|let me rephrase|what i meant(?: to say)?(?: is)?|or rather[,:]?|rather[,:]+)\s+/i

const DANGLING_END = /\b(?:a|an|the|to|of|for|with|and|or|but|nor|about|on|in|into|onto|from|by|at|as|your|my|our|their|if|whether|because|since|how|what|why|when|where|which|who|would|could|should|can|will|handle|deal)\s*[,;:\u2014\u2013.…-]*$/i

export type StutterResult = {
  text: string
  rephrased: boolean
  incomplete: boolean
  finalConstraint: string
}

export function isIncompleteAsk(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t) return true
  if (/[?]$/.test(t) && t.split(/\s+/).length >= 6 && !DANGLING_END.test(t.replace(/[?]+$/, "").trim())) return false
  if (DANGLING_END.test(t) && !/[?]$/.test(t)) return true
  const words = t.split(/\s+/).filter(Boolean)
  // Short WH/explain asks with a topical object ("Explain OAuth", "What is SAML") are complete.
  // Still incomplete when there is no object yet ("what is", "explain how", "how would you").
  if (/^(?:how|what|why|when|where|which|who|can|could|would|will|do|does|did|have|has|are|is|tell|walk|describe|explain|give|define)\b/i.test(t) && words.length <= 5 && !/[?]$/.test(t)) {
    if (words.length <= 1) return true
    return /^(?:i|me|my|you|your|we|us|our|he|she|they|them|their|it|this|that|these|those|how|what|why|when|where|which|who|would|could|should|can|will|do|does|did|have|has|had|are|is|was|were|be|been|being|am|the|a|an|to|of|for|with|and|or|but|about|on|in|into|onto|from|by|at|as|if|whether|because|since|through|over|up|down|out|off|across|handle|deal)$/i.test(words[words.length - 1])
  }
  return false
}

/** Keep the clause after the last rephrase marker; fall back to the original text. */
export function resolveStutterRephrase(text: string): StutterResult {
  const raw = String(text || "").replace(/\s+/g, " ").trim()
  if (!raw) return { text: "", rephrased: false, incomplete: true, finalConstraint: "" }

  let last = 0
  const re = new RegExp(REPHRASE_MARK.source, "gi")
  let m: RegExpExecArray | null
  const cuts: number[] = []
  while ((m = re.exec(raw))) {
    const at = m.index + m[0].length
    if (at > last && at < raw.length) { cuts.push(m.index); last = at }
  }
  if (!cuts.length) {
    return { text: raw, rephrased: false, incomplete: isIncompleteAsk(raw), finalConstraint: raw }
  }

  const startOfFinal = (() => {
    const lastCut = cuts[cuts.length - 1]
    re.lastIndex = 0
    const found = new RegExp(REPHRASE_MARK.source, "i").exec(raw.slice(lastCut))
    return lastCut + (found ? found[0].length : 0)
  })()
  const final = raw.slice(startOfFinal).replace(/^[,.\s]+/, "").trim()
  if (!final) {
    return { text: raw, rephrased: true, incomplete: true, finalConstraint: "" }
  }
  // A fragment like "what if the user is a VP and refuses MFA?" is already a full ask.
  const incomplete = isIncompleteAsk(final)
  const textOut = final.charAt(0).toUpperCase() + final.slice(1)
  return { text: textOut, rephrased: true, incomplete, finalConstraint: textOut }
}
