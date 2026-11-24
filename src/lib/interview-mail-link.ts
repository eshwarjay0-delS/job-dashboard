// The thread that proves an interview, and the card that follows it, linked both ways.
//
// The inbox holds threads; the interviews board holds one card per interview the mail proved. A thread and a card
// belong together when the interview names that thread. The mail page already receives the interview list, so the
// filter and the links below need no new fetch: they match on the account and the thread id, both lowercased on the
// account side, because the two lists spell the account the same way but not always in the same case.

export const interviewThreadKey = (account: string, threadId: string): string =>
  `${String(account || "").trim().toLowerCase()}:${String(threadId || "")}`

export function interviewThreadKeys(interviews: { account?: string; threadId?: string }[]): Set<string> {
  return new Set((interviews || []).filter(iv => iv.threadId).map(iv => interviewThreadKey(iv.account || "", iv.threadId || "")))
}

export const mailHasInterview = (keys: Set<string>, account: string, threadId: string): boolean =>
  keys.has(interviewThreadKey(account, threadId))

/** Board anchors are account + provider thread ID; identical thread IDs in different inboxes stay distinct. */
export const interviewBoardAnchor = (account: string, threadId: string): string =>
  `interview-${interviewThreadKey(account, threadId)}`

/** Link directly to the account-specific interview card. */
export const interviewBoardHref = (threadId: string, account: string): string =>
  `/dashboard/calendar#${interviewBoardAnchor(account, threadId)}`
