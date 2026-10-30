// Speech-to-text provider switch (29 Oct 2026).
//
// Whisper stays the default. Parakeet is used only when KOMPAS_STT_PROVIDER=parakeet AND KOMPAS_PARAKEET_URL points at
// a Parakeet server the owner runs himself. Any Parakeet failure, timeout or empty result falls back to Whisper for that
// clip, so a person never loses a line because the new path failed. With the flag off, the Whisper result is returned
// exactly as before. No paid or outside service is added here.

export type SttProvider = "whisper" | "parakeet"

type Env = Record<string, string | undefined>

export function sttProvider(env: Env = process.env): SttProvider {
  const on = String(env.KOMPAS_STT_PROVIDER || "").trim().toLowerCase() === "parakeet"
  const url = String(env.KOMPAS_PARAKEET_URL || "").trim()
  return on && /^https?:\/\/\S+$/i.test(url) ? "parakeet" : "whisper"
}

export type SttInput = { audio: Uint8Array; mime: string; hint?: string; language?: string; purpose: "flow" | "transcribe"; sessionId?: string; userHash?: string }
export type SttResult = { text: string; seconds: number | null; language: string | null; model: string; segments: Array<{ start: number; end: number; text: string }>; words: Array<{ start: number; end: number; word: string }>; deLooped: boolean }

/** How long one Parakeet clip may take before Whisper takes over (29 Oct 2026: was 15 s, which left a person waiting). */
export const PARAKEET_TIMEOUT_MS = 4_000

/** Send one clip to the owner's own Parakeet server. Expects JSON with a text field. */
export async function parakeetTranscribe(input: SttInput, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<SttResult> {
  const url = String(env.KOMPAS_PARAKEET_URL || "").trim()
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("parakeet url not set")
  const res = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": input.mime, ...(input.language ? { "X-Speech-Lang": input.language } : {}) },
    body: input.audio as unknown as BodyInit,
    signal: AbortSignal.timeout(PARAKEET_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error("parakeet http " + res.status)
  const data = (await res.json()) as { text?: unknown; language?: unknown; seconds?: unknown }
  const text = typeof data.text === "string" ? data.text.trim() : ""
  if (!text) throw new Error("parakeet empty")
  return {
    text,
    seconds: typeof data.seconds === "number" ? data.seconds : null,
    language: typeof data.language === "string" ? data.language : null,
    model: "parakeet",
    segments: [],
    words: [],
    deLooped: false,
  }
}

/** Whisper unless the Parakeet flag is on; a failed Parakeet clip is sent to Whisper instead. */
export async function transcribeWithFallback<T>(
  input: SttInput,
  providers: { whisper: (input: SttInput) => Promise<T>; parakeet?: (input: SttInput) => Promise<T> },
  env: Env = process.env,
): Promise<T> {
  if (sttProvider(env) !== "parakeet" || !providers.parakeet) return providers.whisper(input)
  try {
    return await providers.parakeet(input)
  } catch {
    return providers.whisper(input)
  }
}
