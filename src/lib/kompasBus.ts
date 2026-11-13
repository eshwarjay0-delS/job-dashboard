// In-process event bus. Synchronous, in memory, no timers and no network.

export type EarSource = "mic" | "computer"

export type KompasEvent =
  | { type: "ear.transcript"; who: "You" | "Them"; source: EarSource; text: string }
  | { type: "ear.question"; text: string; partial: boolean }
  | { type: "answer.ready"; question: string; text: string }
  | { type: "answer.scored"; question: string; relevance: number; hardFlags: number }
  | { type: "lens.note"; text: string }
  | { type: "dossier.note"; text: string }
  | { type: "clarify.action"; action: string; shown: string; ms: number }
  | { type: "context.attach"; resume: string; jd: string; dossier: string }
  | { type: "brain.state"; question: string; topics: string[]; claims: number }
  | { type: "known-terms"; profile: string; known: string[]; unknown: string[]; ms: number }
  | { type: "session.prime"; known: string[]; jdTerms: string[]; topics: string[] }
  | { type: "topic.track"; topics: string[]; line: string }
  | { type: "interviewer.model"; role: string; tone: string; pace: string; mode: string }
  | { type: "answer.feedback"; overlap: number; opener: string; used: boolean }
  | { type: "repetition.guard"; blocked: boolean; line: string }
  | { type: "time.pace"; nudge: string; elapsedMs: number }
  | { type: "confidence.flag"; low: boolean; say: string; ask: string }
  | { type: "session.debrief"; prep: string; gaps: number; candidates: string[] }
  | { type: "health.check"; ok: boolean; slow: boolean; ms: number; detail: string }
  | { type: "debug.span"; count: number }

type Handler = (event: KompasEvent) => void

export function createBus(hooks?: { onError?: (type: string) => void; onEvent?: (type: string, ms: number) => void }) {
  const listeners = new Map<string, Handler[]>()
  return {
    publish(event: KompasEvent) {
      const started = performance.now()
      const list = listeners.get(event.type)
      if (list && list.length) {
        for (const fn of list.slice()) {
          try { fn(event) }
          catch (err) { if (hooks?.onError) hooks.onError(event.type); else throw err }
        }
      }
      hooks?.onEvent?.(event.type, performance.now() - started)
    },
    subscribe(type: KompasEvent["type"], fn: Handler) {
      const list = listeners.get(type) || []
      list.push(fn)
      listeners.set(type, list)
      return () => {
        const next = (listeners.get(type) || []).filter((item) => item !== fn)
        listeners.set(type, next)
      }
    },
  }
}

export type KompasBus = ReturnType<typeof createBus>
