// The resume a job starts from, chosen inside one email's library: the same decision for WhatsApp and for Apply on the
// website (owner, 20 Oct 2026: "Just like how WhatsApp resume apply is working ... the resume will be automatically selected
// ... by automatically grabbing the JD from the job postings"). Step one is the kind of role (every resume titled for the job,
// or the one the person named), step two the niche inside it (keywords, the AI agent), and the file is opened and its email
// read once more before it is used. Nothing here sends or tailors anything; the caller says what happened.
import { readPath } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { resolveKeys, keysFor } from "@/lib/llm"
import { extractKeywords } from "@/lib/keywords"
import { resumeEmails } from "@/lib/resumeOrganization"
import { jobKeyOf, type Uses } from "@/lib/resume-library"
import { readShelf, relOf } from "@/lib/resume-library-store"
import { libraryOf, candidatesFor } from "@/lib/library-pick-store"
import { rankFor, type Ranked } from "@/lib/library-pick"
import { agentPick, logPick, type AgentPick } from "@/lib/library-agent"
import { roleOfJob, narrowByRole, matchHint, titlesOf, roleFitOf } from "@/lib/role-match"

/** What the person asked for beyond the job: a resume by name, or "not the one it started from last time". */
export type Prefer = { hint?: string; avoid?: string }

export type Choice =
  | { kind: "none" }                                           // the email holds no resume to start from
  | { kind: "unnamed"; hint: string; have: string[] }          // the resume named is not there; what is
  | { kind: "unreadable" }                                     // none of them could be opened with this email in it
  | { kind: "ok"; picked: Ranked; rel: string; why: string; role: string; titled: number; pool: Ranked[]; all: Ranked[]; ai: AgentPick | null }

/** How often each resume of these folders was picked, from the folders' records. */
async function usesOf(userDir: string, email: string, ranked: Ranked[]): Promise<Uses> {
  const folders = [...new Set(ranked.map(r => r.candidate.folder).filter(f => f && !f.includes(" / ")))]
  const all: Uses = {}
  await Promise.all(folders.map(async folder => Object.assign(all, (await readShelf(userDir, email, folder).catch(() => null))?.uses || {})))
  return all
}

/**
 * Choose the resume of `email` for the job `jd`. `redo` starts from what the person wrote, never from the resume made for
 * this same job (a copy of a copy). The pick is logged (library/picks/<user>.json) unless `log` is false.
 */
export async function chooseResume(opts: { userDir: string; userId: string; email: string; jd: string; redo?: boolean; prefer?: Prefer; log?: boolean }): Promise<Choice> {
  const { userDir, userId, email, jd, prefer = {} } = opts
  const { index } = await libraryOf(userDir)
  const candidates = (await candidatesFor(userDir, email, index)).filter(c => !opts.redo || c.job !== jobKeyOf(jd))
  const { ranked: all } = rankFor(candidates, email, extractKeywords(jd))
  if (!all.length) return { kind: "none" }
  const relOfAbs = (abs: string) => relOf(userDir, abs)

  // Step one is the kind of role: every resume whose own title is the job's role (or the one the person named), all of
  // them. Step two, inside them, is the niche: the closest by keywords and the AI agent's pick. Until 20 Oct 2026 the pick
  // looked only at keywords and at the folder a resume had been sorted into (owner: "always start by picking that all").
  const role = roleOfJob(jd)
  let pool = all, why = "", titled = 0
  if (prefer.hint) {
    const named = matchHint(all, prefer.hint)
    if (!named.length) return { kind: "unnamed", hint: prefer.hint, have: titlesOf(all) }
    pool = named
    why = "because you asked for it"
  } else {
    const n = narrowByRole(all, role)
    pool = n.pool
    if (n.fit >= 4) { why = `because its title is the job's: ${role}`; titled = n.pool.length }
    // "Make another one": not the resume the last go started from, when there is any other.
    if (prefer.avoid) {
      const rest = pool.filter(r => relOfAbs(r.candidate.path) !== prefer.avoid)
      const other = all.filter(r => relOfAbs(r.candidate.path) !== prefer.avoid)
      if (rest.length) pool = rest
      else if (other.length) { pool = other; why = "as another one, because you asked for a different resume" }
    }
  }

  // The AI agent picks from the pool, the code's ranking stands beside it, and the agent's pick is used when it names a
  // real resume of this email (owner: "I was expecting agent always working internally with that WhatsApp chat").
  const keys = await keysFor("resume-keywords", () => resolveKeys({}))
  const ai = await agentPick({ keys, jd, ranked: pool, uses: await usesOf(userDir, email, pool), relOf: relOfAbs, role, titled: !!titled || !!prefer.hint }).catch(() => null)
  const first = ai ? [pool[ai.index], ...pool.filter((_, i) => i !== ai.index)] : pool
  const order = [...first, ...all.filter(r => !pool.includes(r))]
  let picked: Ranked | null = null
  for (const one of order.slice(0, 8)) {
    const bytes = await readPath(one.candidate.path).catch(() => null)
    if (!bytes) continue
    const emails = resumeEmails(await extractText(bytes).catch(() => ""))
    if (emails.length === 1 && emails[0] === email) { picked = one; break }
  }
  if (!picked) return { kind: "unreadable" }
  if (!pool.includes(picked)) why = ""

  const choice: Extract<Choice, { kind: "ok" }> = { kind: "ok", picked, rel: relOfAbs(picked.candidate.path), why, role, titled, pool, all, ai }
  if (opts.log !== false) await logChoice({ userDir, userId, email, jd, choice, ...(prefer.hint ? { hint: prefer.hint } : {}) })
  return choice
}

/** Write a choice in the pick log: the resume used, the agent's pick beside the code's, the role and what was named. */
export async function logChoice(o: { userDir: string; userId: string; email: string; jd: string; choice: Extract<Choice, { kind: "ok" }>; hint?: string }): Promise<void> {
  const { userDir, choice, hint } = o
  const rel = (r: Ranked) => relOf(userDir, r.candidate.path)
  await logPick(o.userId, { at: Date.now(), job: jobKeyOf(o.jd), email: o.email, agent: choice.ai ? rel(choice.pool[choice.ai.index]) : null,
    code: rel(choice.pool[0]), used: choice.rel, agree: choice.ai ? choice.ai.index === 0 : null, ...(choice.ai?.why ? { why: choice.ai.why } : {}), ...(choice.ai?.by ? { by: choice.ai.by } : {}),
    ...(choice.role ? { role: choice.role } : {}), titled: choice.titled, ...(hint ? { hint } : {}) })
}

/**
 * Which email a job is for when the person did not say, on the website (WhatsApp asks and remembers instead): the email
 * with a resume titled for the job's role, else the one that already shows most of what the job asks for.
 */
export async function bestEmailFor(userDir: string, emails: string[], jd: string): Promise<string> {
  if (emails.length <= 1) return emails[0] || ""
  const { index } = await libraryOf(userDir)
  const role = roleOfJob(jd), want = extractKeywords(jd)
  let best = "", score = -1
  for (const email of emails) {
    const { ranked } = rankFor(await candidatesFor(userDir, email, index), email, want)
    if (!ranked.length) continue
    const s = roleFitOf(ranked, role) * 1000 + (ranked[0]?.shows || 0)
    if (s > score) { score = s; best = email }
  }
  return best || emails[0]
}
