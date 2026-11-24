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

// A DOM id / URL fragment is visible in browser history, screenshots and diagnostics. Keep the receiving inbox
// identity stable for cross-page navigation without placing the Gmail address in that public-facing fragment.
// This is an opaque UI key only; it is not an authentication or authorization token.
const accountAnchorKey = (account: string): string => {
  const normalized = String(account || "").trim().toLowerCase()
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ (code + i), 0x85ebca6b)
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`
}

/** Board anchors use an opaque account key + provider thread ID; equal IDs in different inboxes stay distinct. */
export const interviewBoardAnchor = (account: string, threadId: string): string =>
  `interview-${accountAnchorKey(account)}:${String(threadId || "")}`

/** Link directly to the account-specific interview card without exposing the inbox address in the fragment. */
export const interviewBoardHref = (threadId: string, account: string): string =>
  `/dashboard/calendar#${interviewBoardAnchor(account, threadId)}`
