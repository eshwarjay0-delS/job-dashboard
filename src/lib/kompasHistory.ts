/** Prior generated answers are conversation context, not verified candidate evidence. */
export const HISTORY_MAX_CHARS = 24_000
const OMITTED = '\n[Middle omitted from prior turn]\n'
const OLDER_OMITTED = '[Older interview context omitted]\n'

function excerpt(value: unknown, limit: number): string {
 if (typeof value !== 'string') return ''
 const text = value.trim()
 if (text.length <= limit) return text
 const available = limit - OMITTED.length
 const head = Math.ceil(available / 2)
 return text.slice(0, head) + OMITTED + text.slice(-(available - head))
}

export function formatInterviewHistory(value: unknown): string {
 if (!Array.isArray(value)) return ''
 const blocks: string[] = []
 let size = 0
 let omitted = value.length > 4
 // Bound work to the last four received turns and reserve room for the omission notice.
 for (const item of value.slice(-4).reverse()) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) continue
  const q = excerpt(item.q ?? item.question, 2000)
  const a = excerpt(item.a ?? item.answer ?? item.text, 6000)
  if (!q && !a) continue
  const block = `Q: ${q}\nA: ${a}`
  const cost = block.length + (blocks.length ? 2 : 0)
  if (size + cost > HISTORY_MAX_CHARS - OLDER_OMITTED.length) { omitted = true; break }
  blocks.unshift(block)
  size += cost
 }
 if (!blocks.length) return ''
 return (omitted ? OLDER_OMITTED : '') + blocks.join('\n\n')
}
