// Bringing the resumes the WhatsApp bot still holds for a number into a person's Files.
//
// Why this is its own file (13 Oct 2026, late): the bot moved them only when the number sent its next message, and only
// once the bot knew which account the number wrote as. The owner looked at Files after eighteen resumes had been made
// over WhatsApp that day and it was empty ("Still resumes"): no number was joined to his account, and nothing had made
// the bot look again. So the dashboard can now ask for them itself (POST /api/whatsapp/collect), and the bot uses the
// same code on a message.
//
// The newest thirty versions per number are held (whatsapp/gens/<digits>/_index.json). A resume and the changes made to
// it are one job: only its newest version is kept in Files. Safe to run again: what is already there is skipped.
import path from "path"
import { blob, readPath } from "@/lib/storage"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { saveTailored } from "@/lib/resume-library-store"

type HeldGen = { userId: string; jd: string; file: string; meta?: { role?: string; company?: string }; createdAt: number; saved?: string; depth?: number }
const under = (dir: string, file: string) => path.resolve(file).startsWith(path.resolve(dir) + path.sep)
const onlyDigits = (s: string) => String(s || "").replace(/\D/g, "")

/** How many versions the bot holds for a number (0 when none, or when it could not be read). */
export async function heldCount(number: string): Promise<number> {
  try { return (JSON.parse((await blob.getText(`whatsapp/gens/${onlyDigits(number)}/_index.json`)) || "[]") as unknown[]).length } catch { return 0 }
}

/** Every number the bot holds resumes for, with how many. For the owner of the site only: see /api/whatsapp/collect. */
export async function botNumbers(): Promise<{ digits: string; held: number }[]> {
  // No slash at the end: a storage key with an empty part is refused, and the refusal read as "nothing held"
  // (13 Oct 2026: the owner was offered no number although eighteen resumes were held).
  const keys = await blob.list("whatsapp/gens").catch(error => { console.error("[whatsapp/collect] the held resumes could not be listed", String(error).slice(0, 200)); return [] as string[] })
  const numbers = [...new Set(keys.map(k => (/whatsapp\/gens\/(\d{8,15})\//.exec(k) || [])[1]).filter((d): d is string => !!d))].slice(0, 50)
  const out: { digits: string; held: number }[] = []
  for (const digits of numbers) { const held = await heldCount(digits); if (held) out.push({ digits, held }) }
  return out
}

/** Move what the bot holds for this number into this account's Files. Returns how many were saved there now. */
export async function collectHeld(number: string, userId: string, until: number, again = false): Promise<number> {
  const digits = onlyDigits(number)
  if (digits.length < 8 || !userId) return 0
  const doneKey = `whatsapp/moved/${digits}-${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`
  const index = JSON.parse((await blob.getText(`whatsapp/gens/${digits}/_index.json`)) || "[]") as { key: string; file: string }[]
  // Done before, and nothing new has been made since: nothing to read.
  const done = JSON.parse((await blob.getText(doneKey).catch(() => null)) || "null") as { at?: number; held?: number } | null
  if (!again && done && done.held === index.length) return 0
  const userDir = path.join(USER_RESUMES_DIR, userId)
  const newest = new Map<string, string>()      // job description -> the copy in Files of its newest version so far
  let moved = 0, finished = true
  for (const item of index) {
    if (Date.now() > until) { finished = false; break }
    const raw = await blob.getText(item.key).catch(() => null)
    if (!raw) continue
    const gen = JSON.parse(raw) as HeldGen
    if (gen.saved && under(userDir, gen.saved)) { newest.set(gen.jd, gen.saved); continue }
    const bytes = await readPath(gen.file)
    if (!bytes) continue
    const saved = await saveTailored({ userDir, bytes, jd: gen.jd, role: gen.meta?.role, company: gen.meta?.company, depth: gen.depth === 2 ? 2 : 1, replaces: newest.get(gen.jd), now: gen.createdAt })
    newest.set(gen.jd, saved.abs)
    await blob.put(item.key, JSON.stringify({ ...gen, userId, saved: saved.abs }))
    moved++
  }
  if (finished) await blob.put(doneKey, JSON.stringify({ at: Date.now(), moved, held: index.length }))
  return moved
}
