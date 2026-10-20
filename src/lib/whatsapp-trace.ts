// What was said on WhatsApp, kept per number so the conversation can be read back.
//
// Owner, 19 Oct 2026: "Connect to the mfit WhatsApp service it wasn't real time or make any sense from what I've sent",
// then, asked how the bot should behave: "see chats". Meta keeps no message history a server can read, and the bot kept
// nothing either, so nobody could see what it had been sent and what it answered. Now every message in and every reply
// out is written here (the newest MOST_KEPT per number, in the person's own storage) and one line per event goes to the
// server log (no message text in the log, only what kind of event it was), so a conversation can be followed live.

import { blob } from "@/lib/storage"

export type TraceEvent = {
  at: number
  dir: "in" | "out"
  kind: string            // "text", "document", "status", …
  text?: string           // what was written, cut to MOST_TEXT characters
  file?: string           // a document's file name
  note?: string           // what the bot decided ("asked which email", "started from Files", …)
}

const MOST_KEPT = 80
const MOST_TEXT = 600
const digits = (from: string) => String(from || "").replace(/\D/g, "")
const traceKey = (from: string) => `whatsapp/trace/${digits(from)}.json`

/** Write one event down. Never throws and never holds up the reply: a trace is for reading back, not for answering. */
export function trace(from: string, event: Omit<TraceEvent, "at">): void {
  const at = Date.now()
  const line = { wa: digits(from).slice(-4), dir: event.dir, kind: event.kind, len: event.text?.length ?? 0, ...(event.note ? { note: event.note } : {}) }
  console.log(`[wa] ${JSON.stringify(line)}`)
  void (async () => {
    try {
      const raw = await blob.getText(traceKey(from))
      const had = raw ? (JSON.parse(raw) as TraceEvent[]) : []
      const next: TraceEvent = { at, ...event, ...(event.text ? { text: event.text.slice(0, MOST_TEXT) } : {}) }
      await blob.put(traceKey(from), JSON.stringify([...(Array.isArray(had) ? had : []), next].slice(-MOST_KEPT)))
    } catch { /* the conversation still goes on */ }
  })()
}

/** The conversation with one number, oldest first. */
export async function readTrace(from: string): Promise<TraceEvent[]> {
  try {
    const raw = await blob.getText(traceKey(from))
    const all = raw ? (JSON.parse(raw) as TraceEvent[]) : []
    return Array.isArray(all) ? all : []
  } catch { return [] }
}
