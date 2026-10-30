// r7 (29 Oct 2026, pending #28 "whitespace-safe intent"): the same ask must get the same intent whatever invisible
// characters a transcript, a paste or a screen capture put in it. "Wri<zero-width space>te a Python function" lost its
// coding intent, and a no-break space or a tab could split a phrase the intent rules look for.
// Pure and total: never throws, never drops a visible word. Failsafe: on any error the input comes back trimmed.
const INVISIBLE = /[\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g
const ODD_SPACE = /[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\t\r\n\f\v]+/g
export function normalizeAskText(input: unknown): string {
  const raw = typeof input === "string" ? input : input == null ? "" : String(input)
  try {
    return raw
      .replace(INVISIBLE, "")
      .replace(ODD_SPACE, " ")
      .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
      .replace(/[\u201c\u201d\u201f\u2033]/g, '"')
      .replace(/ {2,}/g, " ")
      .trim()
  } catch {
    return raw.trim()
  }
}
