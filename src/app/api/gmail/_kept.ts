// The copy of a person's job mail this app already keeps, read as it stands: no call to Gmail.
//
// The inbox list goes through fetchClassifiedThreads, which first asks Gmail what is new. That is right for a list and
// wrong for something asked many times in a row: a search is typed a letter at a time, and working out what a person
// keeps doing must not cost a Gmail sync each time the Follow-ups page opens. Both read the kept copy.

import { classifyEmail } from "@/lib/email-classifier"
import { fetchClassifiedThreads, TRACKING_DAYS, type AuthContext, type ClassifiedThread } from "./_lib"

// The same repair the list makes when the classifier has learned something since a thread was kept, here in memory only.
function reclassified(t: ClassifiedThread): ClassifiedThread {
  let changed = false
  const messages = t.messages.map(m => {
    const c = classifyEmail({ subject: m.subject, snippet: m.snippet, from: m.from })
    if (c.category === m.category) return m
    changed = true
    return { ...m, category: c.category, confidence: c.confidence, jobTitle: c.jobTitle, rate: c.rate, vendor: c.vendor, vendorDomain: c.vendorDomain }
  })
  return changed ? { ...t, messages } : t
}

/**
 * Kept conversations of the last `days`, newest first, from the connected and enabled inboxes only.
 * `kept: false` says there was no kept copy to read. With `fetchWhenEmpty` the ordinary fetch is then made once
 * (it also fills the copy); without it the answer is simply empty and the caller says what it could not look at.
 */
export async function keptThreads(ctx: AuthContext, days = TRACKING_DAYS, opts: { fetchWhenEmpty?: boolean } = {}): Promise<{ threads: ClassifiedThread[]; kept: boolean }> {
  const enabled = new Set(ctx.accounts.filter(a => a.gmail_enabled).map(a => a.google_email.toLowerCase()))
  if (!enabled.size) return { threads: [], kept: true }
  const span = Math.min(Math.max(Number(days) || TRACKING_DAYS, 1), TRACKING_DAYS)
  const cutoff = Date.now() - span * 86_400_000
  try {
    const rows: Array<{ data: unknown }> = []
    for (let offset = 0; offset < 3000; offset += 500) {
      const page = await ctx.supabase
        .from("mfit_gmail_threads")
        .select("data")
        .eq("user_id", ctx.userId)
        .gt("latest_ts", cutoff)
        .order("latest_ts", { ascending: false })
        .order("account_id").order("thread_id")
        .range(offset, offset + 499)
      if (page.error) throw page.error
      rows.push(...(page.data || []))
      if ((page.data || []).length < 500) break
    }
    const threads = rows
      .map(r => r.data as ClassifiedThread)
      .filter(t => Array.isArray(t?.messages) && t.messages.length > 0 && enabled.has(String(t.accountEmail || "").toLowerCase()))
      .map(reclassified)
    if (threads.length) return { threads, kept: true }
  } catch { /* the tables are not there, or could not be read: said below */ }
  if (!opts.fetchWhenEmpty) return { threads: [], kept: false }
  const { threads } = await fetchClassifiedThreads(ctx.userId, { days: Math.min(span, 30), max: 50 })
  return { threads, kept: false }
}
