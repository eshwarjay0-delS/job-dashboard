/** The open work the Chief owns. Gathered first, then assigned. */
import { PLAN_JOURNAL } from "./plan-vision-journal.ts"
import { REA_SESSIONS } from "./rea-register.ts"

export const CHIEF_WORKER_CAP = 100

export type DeskItem = {
  id: string
  source: "chat" | "plan" | "rea"
  area: string
  title: string
  state: string
  next: string
}

/** This chat, 23 Oct 2026, handed to the Chief. Product orders only. */
export const THIS_CHAT: DeskItem[] = [
  { id: "chat-kompas-levels", source: "chat", area: "kompas", state: "handed over", title: "Three asking levels. The question sets the depth. A switch changes the answer at once.", next: "On the session branch. Not on the live desktop until he says to merge. Then quit Kompas and open it again." },
  { id: "chat-kompas-spoken", source: "chat", area: "kompas", state: "handed over", title: "The desktop card is spoken. A code block is not drawn.", next: "On the session branch as kompas-20261023-say. Not on the live page yet." },
  { id: "chat-resume-confirmed", source: "chat", area: "resume", state: "handed over", title: "Related words go in only for skills he confirmed.", next: "Unit test: the eight confirmed Salesforce terms are in the resume text. NetSuite was in the job post and stayed out. No live Word file." },
  { id: "chat-chief-only", source: "chat", area: "all", state: "handed over", title: "He speaks only to the Chief. The Chief assigns the work and keeps the overview.", next: "Gather the desk first. Up to 100 workers. Nothing sends without his yes. The money in the article was a metaphor." },
]

const OPEN = new Set(["in progress", "planned", "blocked"])

function clip(s: string): string {
  const t = s.replace(/\s+/g, " ").trim()
  return t.length > 220 ? t.slice(0, 217) + "..." : t
}

/** Open Plan & Vision items, unfinished REA sessions, and this chat. Kompas comes first. */
export function chiefDesk(area?: string): DeskItem[] {
  const plan: DeskItem[] = PLAN_JOURNAL
    .filter(e => e.approval === "approved" && OPEN.has(e.delivery))
    .map(e => ({ id: e.id, source: "plan", area: e.area, title: e.title, state: e.delivery, next: clip(e.next) }))
  const rea: DeskItem[] = REA_SESSIONS
    .filter(s => s.state !== "Deployed, verification pending")
    .map(s => ({ id: s.id, source: "rea", area: s.area === "platform" ? "all" : s.area, title: s.title, state: s.state, next: clip(s.next) }))
  let items = [...THIS_CHAT, ...plan, ...rea]
  if (area && area !== "all") items = items.filter(i => i.area === area)
  const rank = (a: string) => (a === "kompas" ? 0 : 1)
  items.sort((a, b) => rank(a.area) - rank(b.area) || (a.source === "chat" ? -1 : 1))
  return items
}

export function chiefDeskSummary(area?: string): { workerCap: number; count: number; kompas: number; items: DeskItem[] } {
  const items = chiefDesk(area)
  return { workerCap: CHIEF_WORKER_CAP, count: items.length, kompas: items.filter(i => i.area === "kompas").length, items }
}
