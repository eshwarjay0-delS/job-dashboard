import { readFile, writeFile, mkdir } from "fs/promises"
import path from "path"
import { FEEDBACK_FILE as FILE } from "@/lib/paths"

interface Entry { cat: string; text: string }

// Normalise the JD category ("Thakkuva / Thakkuva / AI_Marketing") to its top folder.
export function topCategory(category: string): string {
  return (category || "").split("/")[0].trim()
}

async function readAll(): Promise<Entry[]> {
  try {
    const raw = await readFile(FILE, "utf8")
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    // Back-compat: older entries were plain strings (no category) → treat as global.
    return arr.map((e: unknown) =>
      typeof e === "string" ? { cat: "", text: e } : (e as Entry)
    ).filter(e => e && typeof e.text === "string")
  } catch {
    return []
  }
}

export async function addFeedback(items: string[], category = ""): Promise<void> {
  // Cap each entry at 200 chars — long pastes (reviews, essays) are noise, not actionable feedback.
  const cat = topCategory(category)
  const cleaned = items.map(s => (s || "").trim()).filter(s => s && s.length <= 200)
  if (!cleaned.length) return
  const next = [...(await readAll()), ...cleaned.map(text => ({ cat, text }))].slice(-300)
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(next))
}

// Recent feedback that applies to THIS resume: entries left on the same top-level
// folder (plus any legacy/global entries). Cross-folder feedback is excluded.
export async function recentFeedback(category = "", limit = 6): Promise<string[]> {
  const cat = topCategory(category)
  const all = await readAll()
  const out: string[] = []
  for (let i = all.length - 1; i >= 0 && out.length < limit; i--) {
    const e = all[i]
    const text = e.text.trim()
    if (!text) continue
    // Apply only same-folder feedback; legacy uncategorised entries (cat === "") are
    // applied only when we don't know the target folder.
    const applies = cat ? e.cat === cat : true
    if (!applies) continue
    if (!out.some(x => x.toLowerCase() === text.toLowerCase())) out.push(text)
  }
  return out
}
