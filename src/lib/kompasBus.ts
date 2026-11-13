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

type Handler = (event: KompasEvent) => void

export function createBus() {
  const listeners = new Map<string, Handler[]>()
  return {
    publish(event: KompasEvent) {
      const list = listeners.get(event.type)
      if (!list || !list.length) return
      for (const fn of list.slice()) fn(event)
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
