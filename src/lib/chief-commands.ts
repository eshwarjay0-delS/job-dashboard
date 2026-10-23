// The words the Chief answers on WhatsApp: "brief", "never contact: …", "goal: …" (or "Chief, …"), "jobs", and the
// Yes / Edit of a jobs card.
//
// The mistakes it prevents: a brief or a goal pasted on WhatsApp taken for a job description (anything of 60 characters
// or more went to the resume tailor), and a goal turned into jobs without the owner's yes. Owner, 23 Oct 2026: "Chief,
// watch my submissions tonight" — "I give the goal, the Chief does the steps, I only make the calls — and nothing moves
// without my yes."
import { readBrief, writeBrief, parseBriefText, screenBrief, mergeBrief, briefShowText, contactList } from "@/lib/chief-brief"
import { proposeJobs, saveApprovedJobs, listJobsText, planCardText, type JobsPlan, type JobDay, type Ask } from "@/lib/chief-goal"
import { createApprovalCard, deliverApprovalCard, saveApprovalCard, type ApprovalCard } from "@/lib/chief-approvals"
import { blob } from "@/lib/storage"

/** A first word the webhook hands here before it treats a long message as a job description. */
export const CHIEF_WORDS = /^(?:my\s+|new\s+)?(?:brief|goal|jobs|never[\s-]+contact|chief\s*[,:])/i

const NOT_LINKED = "Link this number to your MarketFit account first (Connections, then WhatsApp), so your brief and your jobs are kept with you and nobody else."

type Input = { from: string; text: string; userId: string; account: boolean; now?: number; ask?: Ask }

/** The reply to send, "" when a card was sent instead, or null when the message is not one of these (it goes on as before). */
export async function chiefCommand(input: Input): Promise<string | null> {
  const text = input.text.trim()
  const now = input.now ?? Date.now()

  if (/^(?:my\s+)?brief\s*\??$/i.test(text)) {
    if (!input.account) return NOT_LINKED
    return briefShowText(await readBrief(input.userId))
  }
  if (/^(?:my\s+)?brief\b/i.test(text)) {
    if (!input.account) return NOT_LINKED
    const { patch, unread } = parseBriefText(text.replace(/^(?:my\s+)?brief\s*:?/i, ""))
    if (!Object.keys(patch).length) {
      // "Brief description: …" opening a job post is the post, not a brief: it goes on to the tailor.
      if (text.length >= 60) return null
      return ["I could not read that as your brief. Put each line after its label, for example:", "_brief_", "_Me: C2C cybersecurity contractor, Houston_", "_My candidates: my two profiles, never mixed_", "_My voice: Hello, following up on our call. Thank you._", "_Never: commit to a start date_", "_Never contact: example-staffing.com_"].join("\n")
    }
    const why = screenBrief(patch)
    if (why) return `${why} Nothing was saved.`
    const saved = await writeBrief(input.userId, mergeBrief(await readBrief(input.userId), patch, now))
    return [`Saved.${unread.length ? ` (I could not place: ${unread.slice(0, 3).join(" / ")})` : ""}`, "", briefShowText(saved)].join("\n")
  }
  const never = /^never[\s-]+contact\b\s*[:\-–]?\s*([\s\S]*)$/i.exec(text)
  if (never) {
    if (!input.account) return NOT_LINKED
    const brief = await readBrief(input.userId)
    const add = contactList(never[1])
    if (!add.length) return brief.neverContact.length
      ? `Never contact: ${brief.neverContact.join(", ")}. No draft or card is ever made for them. To add, send _never contact: name or domain_.`
      : "Nobody is on your never-contact list. Send _never contact:_ and the names or domains, for example _never contact: example-staffing.com, Example Firm_."
    const screened = screenBrief({ neverContact: add })
    if (screened) return `${screened} Nothing was saved.`
    const saved = await writeBrief(input.userId, mergeBrief(brief, { neverContact: [...brief.neverContact, ...add] }, now))
    return `Saved. Never contact: ${saved.neverContact.join(", ")}. No draft or card is ever made for them.`
  }
  if (/^(?:my\s+)?jobs\s*\??$/i.test(text)) {
    if (!input.account) return NOT_LINKED
    return listJobsText(input.userId)
  }
  const goal = /^(?:new\s+)?goal\s*[:\-–]\s*([\s\S]+)$/i.exec(text)?.[1] || /^chief\s*[,:]\s*([\s\S]{6,})$/i.exec(text)?.[1]
  if (goal !== undefined) {
    if (!input.account) return NOT_LINKED
    const said = goal.trim()
    if (said.length < 6) return "Tell me the goal in a few words, for example _goal: watch my submissions tonight_."
    const plan = await proposeJobs({ goal: said, brief: await readBrief(input.userId), ask: input.ask })
    return sendPlan(input.from, input.userId, plan, now)
  }
  return null
}

/** The plan as one approval card, or, when none of it can run yet, said plainly with no card. */
async function sendPlan(to: string, userId: string, plan: JobsPlan, now: number, replacing?: ApprovalCard): Promise<string> {
  if (!plan.jobs.length) {
    return [`For "${plan.goal}" I have nothing I can schedule yet:`, ...plan.notBuilt.map(j => `• ${j.does} — not built yet`), "Nothing was saved."].join("\n")
  }
  const card = await createApprovalCard({ userId, to, kind: "jobs-plan", toEmail: "", subject: plan.goal, body: planCardText(plan, now), plan })
  if (replacing) {
    replacing.status = "skipped"; replacing.replacedBy = card.id; delete replacing.awaitingEdit
    await saveApprovalCard(replacing)
  }
  try {
    await deliverApprovalCard(card)
    return ""
  } catch {
    return "I worked out the jobs but could not send you the card to approve them, so nothing is scheduled. Send the goal again in a minute."
  }
}

/** Yes on a jobs card: the jobs are saved, once, however many times it is tapped. */
export async function approvePlan(card: ApprovalCard, opts: { now?: number; db?: NonNullable<Parameters<typeof saveApprovedJobs>[2]>["db"] } = {}): Promise<string> {
  if (!card.plan?.jobs.length) return "That card holds no job to schedule."
  const claim = `whatsapp/approvals/${card.id}.yes`
  if (!(await blob.putIfAbsent(claim, String(opts.now ?? Date.now())))) return "Those jobs are already scheduled. Send *jobs* to see them."
  const r = await saveApprovedJobs(card.userId, card.plan, { db: opts.db, now: opts.now })
  if (!r.ok) {
    await blob.delete(claim).catch(() => {})
    return `I could not schedule them: ${r.error}. Nothing was saved; the card stays open, so tap Yes again once that is fixed.`
  }
  card.status = "sent"; delete card.awaitingEdit
  await saveApprovalCard(card)
  return [`Yes received: ${r.saved} job${r.saved === 1 ? "" : "s"} scheduled. They only read your mail and report in MarketFit; nothing is sent.`, "Send *jobs* to see them."].join("\n")
}

const WEEKDAY: Record<string, JobDay> = { monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun" }

/** The owner's change to a plan, in plain words: "drop 2", "only Mondays", "every night", "tonight only". Null: not read. */
export function applyPlanEdit(plan: JobsPlan, change: string): JobsPlan | null {
  const t = change.toLowerCase()
  let jobs = [...plan.jobs]
  let read = false
  const drops = [...t.matchAll(/\b(?:drop|remove|skip|cut|no)\s+(?:jobs?\s+)?#?(\d(?:\s*(?:,|and)\s*\d)*)/g)].flatMap(m => m[1].split(/\s*(?:,|and)\s*/).map(Number))
  if (drops.length) { jobs = jobs.filter((_, i) => !drops.includes(i + 1)); read = true }
  const day = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/.exec(t)?.[1]
  const to: JobDay | null = day ? WEEKDAY[day]
    : /\b(?:tonight only|only tonight|just tonight|once)\b/.test(t) ? "once"
    : /\b(?:every (?:night|day)|nightly|daily)\b/.test(t) ? "daily" : null
  if (to) { jobs = jobs.map(j => ({ ...j, day: to })); read = true }
  return read ? { ...plan, jobs } : null
}

/** The owner's reply after Edit on a jobs card: the changed plan comes back as a new card; the old one is closed. */
export async function revisePlan(card: ApprovalCard, change: string, opts: { now?: number } = {}): Promise<string> {
  const now = opts.now ?? Date.now()
  if (!card.plan) return "That card holds no plan to change."
  const next = applyPlanEdit(card.plan, change)
  if (!next) {
    card.awaitingEdit = false
    await saveApprovalCard(card)
    return "I could not read that change. Say for example _drop 2_, _only Mondays_, _every night_ or _tonight only_, or send a new _goal:_. The card above is still open."
  }
  return sendPlan(card.to, card.userId, next, now, card)
}
