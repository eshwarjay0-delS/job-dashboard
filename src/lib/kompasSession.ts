// Kompas live-session identity. One UUID per session; every audio chunk sent
// with x-session-id is archived (mic + computer audio) for maturation and
// accuracy training. The session starts when the user starts listening and
// ends when they stop.

const KEY = "mf_kompas_session"

export function currentSessionId(): string {
  try {
    let id = sessionStorage.getItem(KEY)
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      sessionStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

export function endSession(): void {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}

/** Headers that tag a chunk as part of the live session archive. */
export function sessionHeaders(source: "mic" | "system" = "mic"): Record<string, string> {
  return {
    "x-session-id": currentSessionId(),
    "x-audio-source": source,
  }
}
