// Prevents a finished interview answer from opening on praise, stacking pauses,
// or walking off into a second topic. The words stay the model's. This only
// shapes how they are spoken, the way the reference interviews move.

export const BLEND_MOVES: readonly string[] = [
  "Open on the answer in one plain sentence. Never open on Great question, Certainly, Absolutely, or Of course.",
  "The next layer uses a spoken link — so, and then, however, unlike that, that means, from there — and does not start a new pile of facts.",
  "A concept goes meaning, then parts in working order, then the neighbour it is confused with, then what you do with it.",
  "A comparison holds both sides to the same axes: what it is, where it wins, where it costs.",
  "An investigation starts at the suspected source, then independent evidence, then the pattern, then containment, then the lasting fix.",
  "Name the tool, the log, the field, or the port only after its plain meaning is already in the sentence.",
  "Keep a real number, a version, and a protocol name exactly as they are. Never trade them for several or a handful.",
  "Sixty percent of the answer is the person reasoning. Forty percent is the mechanism, said once, inside that reasoning.",
  "Put [breath] between ideas so the listener can catch up. Never open on it, and never stack two pauses.",
  "Put [beat] once or twice, immediately before the sentence the listener has to remember. A third beat is only a breath.",
  "After a technical name, one clause says what it does in this answer.",
  "The last sentence returns to the question. It does not repeat the opening sentence, and it does not open another topic.",
  "Say use, fix, and check. Do not say utilize, leverage, stakeholders, or great question.",
  "Do not add right?, you know, or basically.",
  "Where practice varies, say it depends on the setup, then say what you actually do.",
  "Where knowledge ends, mark that edge in one breath instead of inventing the rest.",
  "A short self-correction is fine. Losing the thread is not.",
  "One thread. The second mechanism waits until the first one has landed.",
  // Owner, 23 Oct 2026: "No one would read commands, signs, symbols, math or calculations or code, integration code
  // logics". Replaces "A code sample stays untouched" for every spoken answer.
  "Show no code, command, file path, formula or symbol. Say what the code or command does, in words, in the order it runs, and give a calculation as its result. A tool, function or protocol name stays as a word.",
  "Say it the way a person continues out loud in a technical interview, not the way a document lists bullets.",
  // Owner, 23 Oct 2026: "Format things in a readable ways as if you're introducing it to 5 yr old to read", while
  // "still fulfilling the technical jargon level as promised".
  "Short sentences, one idea each, about fifteen words. Say what a thing does in plain words first, then its exact technical name, so a first-time reader follows and an expert still hears the right term.",
]

export function blendPrompt(): string {
  return "OTTER BLEND (how the spoken answer moves, on top of the craft rules):\n" +
    BLEND_MOVES.map((move, i) => `${i + 1}. ${move}`).join("\n")
}

function capital(word: string, replacement: string): string {
  return word[0] === word[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement
}

function swap(word: string): string {
  const lower = word.toLowerCase()
  const table: Record<string, string> = {
    utilize: "use", utilizes: "uses", utilized: "used", utilizing: "using",
    leverage: "use", leverages: "uses", leveraged: "used", leveraging: "using",
  }
  return table[lower] ? capital(word, table[lower]) : word
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z[])/).map((s) => s.trim()).filter(Boolean)
}

function normSentence(s: string): string {
  return s.toLowerCase().replace(/\[(?:beat|breath)\]/gi, "").replace(/[^a-z0-9]+/g, " ").trim()
}

/** Turn symbols and entity codes into words a person can say. */
export function speakableWords(input: string): string {
  return String(input || "")
    // Inline code keeps its words and loses the marks; arrows, comparisons and shorthand become what is said.
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\s*(?:->|=>|\u2192)\s*(?:then\s+)?/gi, " then ")
    .replace(/\s+!==?\s+/g, " is not ")
    .replace(/\s+={2,3}\s+/g, " equals ")
    .replace(/\s+=\s+/g, " equals ")
    .replace(/(\d)\s*%/g, "$1 percent")
    .replace(/~\s*(\d)/g, "about $1")
    .replace(/\b(\d+)x\b/g, "$1 times")
    .replace(/\s+\+\s+/g, " plus ")
    .replace(/\s+\/\s+/g, " or ")
    .replace(/\be\.g\.,?/gi, "for example")
    .replace(/\bi\.e\.,?/gi, "that is")
    .replace(/\betc\.(,?)/gi, (_m, comma) => (comma ? "and so on," : "and so on."))
    .replace(/\bvs\.?(?=\s)/gi, "versus")
    .replace(/&amp;/gi, " and ")
    .replace(/\bx-amp\b/gi, "and")
    .replace(/&gt;=/gi, " at least ")
    .replace(/&lt;=/gi, " at most ")
    .replace(/&gt;/gi, " greater than ")
    .replace(/&lt;/gi, " less than ")
    .replace(/&quot;|&#39;|&apos;/gi, "")
    .replace(/&#(\d+);/g, (_m, n) => {
      const ch = String.fromCharCode(Number(n))
      if (ch === ">") return " greater than "
      if (ch === "<") return " less than "
      if (ch === "&") return " and "
      return " "
    })
    .replace(/>=\s*(\d+)/g, "at least $1")
    .replace(/<=\s*(\d+)/g, "at most $1")
    .replace(/>\s*(\d+)/g, "greater than $1")
    .replace(/<\s*(\d+)/g, "less than $1")
    .replace(/\s+&\s+/g, " and ")
    .replace(/[ \t]*;[ \t]*/g, " ")
    .replace(/\band\s+and\b/gi, "and")
    .replace(/[ \t]{2,}/g, " ")
}

/** A card someone reads aloud. Code, commands, and sums come out. One sentence a line. */
export function readAloud(input: string): string {
  let text = speakableWords(String(input || ""))
  text = text.replace(/```[\s\S]*?```/g, " ")
  const kept = text.split(/\n/).filter((line) => {
    const s = line.trim()
    if (!s) return false
    if (/^(?:\$ |npm |pnpm |yarn |curl |pip3? |python3? |node |import |from |const |let |var |function |class |if \(|for \(|while \(|SELECT |POST |GET |PUT )/i.test(s)) return false
    if (/[{}];?\s*$/.test(s) && /[=(){}]/.test(s)) return false
    return true
  })
  text = kept.join(" ").replace(/\s+/g, " ").trim()
  const parts = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 1)
  return parts.join("\n")
}

/** Shape a finished answer. Idempotent. Does not invent a fact or change a number. */
export function blendSpoken(input: string): string {
  const original = String(input || "")
  if (!original.trim()) return original
  // A code block is never read out (owner, 23 Oct 2026). The words around it already say what it does.
  let text = speakableWords(original.replace(/\r\n/g, "\n").replace(/\n?```[\s\S]*?```\n?/g, " "))
  text = text.replace(/^(?:(?:great question|that's a great question|that is a great question|certainly|absolutely|of course)[,.!]+\s+)+/i, "")
  text = text.replace(/\byou know\b[, ]*/gi, "")
  text = text.replace(/\bbasically\b[, ]*/gi, "")
  text = text.replace(/\bright\?/gi, "")
  text = text.replace(/\b(?:utiliz(?:e|es|ed|ing)|leverag(?:e|es|ed|ing))\b/gi, swap)
  text = text.replace(/(?:\[(?:beat|breath)\]\s*){2,}/gi, (stack) => (/\[beat\]/i.test(stack) ? "[beat] " : "[breath] "))
  let beats = 0
  text = text.replace(/\[beat\]/gi, () => (++beats <= 2 ? "[beat]" : "[breath]"))
  const opener = text.match(/^\s*(\[(?:beat|breath)\])\s*/i)
  if (opener) {
    text = text.slice(opener[0].length)
    const first = text.match(/^[\s\S]*?[.!?]/)
    text = first ? `${first[0]} ${opener[1]}${text.slice(first[0].length)}` : `${text} ${opener[1]}`
  }
  const parts = sentencesOf(text.replace(/[ \t]{2,}/g, " ").trim())
  if (parts.length >= 2 && normSentence(parts[0]) === normSentence(parts[parts.length - 1])) parts.pop()
  if (parts.length && /^(?:on a separate note|another thing|switching topics|in a different area)\b/i.test(parts[parts.length - 1])) parts.pop()
  if (parts.length >= 3 && !parts.some((p) => /\[breath\]/i.test(p))) {
    parts[0] = parts[0].replace(/([.!?])$/, "$1 [breath]")
  }
  if (parts.length >= 4 && !parts.some((p) => /\[beat\]/i.test(p))) {
    parts[parts.length - 1] = "[beat] " + parts[parts.length - 1]
  }
  text = parts.join(" ").replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim()
  text = text.replace(/^([a-z])/, (ch) => ch.toUpperCase())
  return text || original.trim()
}
