/**
 * Capture policy for Kompas live sessions (2026-11-10).
 *
 * Computer / tab audio is the interviewer. Browser processing that helps a
 * microphone (echo cancellation, noise suppression, auto-gain) punches holes
 * in a shared meeting tab and is a common reason those questions are missed.
 * The picker prefers a browser tab so Chrome can offer "Also share tab audio".
 * Mid-question pauses on that track wait longer than a mic breath before the
 * segment ends. Written for Kompas; not a copy of any third-party client.
 */

export const SYS_AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
} as const

/** Microphone end-of-speech wait, in milliseconds. */
export const MIC_SILENCE_MS = 1100

/**
 * Call-audio end-of-speech wait. Longer than a mid-question breath, short
 * enough that the existing peak-dip detector still ends between sentences
 * before the 28 s segment cap.
 */
export const THEM_SILENCE_MS = 1400

export function sysShareConstraints(desktop: boolean): Record<string, unknown> {
  if (desktop) return { video: true, audio: true }
  return {
    video: { displaySurface: "browser", width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 15 } },
    audio: { ...SYS_AUDIO_CONSTRAINTS },
    systemAudio: "include",
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    preferCurrentTab: false,
  }
}

export function sysShareFallbackConstraints(desktop: boolean): Record<string, unknown>[] {
  if (desktop) return [{ video: true, audio: true }]
  return [
    { video: true, audio: { ...SYS_AUDIO_CONSTRAINTS }, systemAudio: "include", selfBrowserSurface: "exclude" },
    { video: true, audio: true, systemAudio: "include", selfBrowserSurface: "exclude" },
  ]
}

export function silenceMsFor(who: string): number {
  return who === "Them" ? THEM_SILENCE_MS : MIC_SILENCE_MS
}

/** Whether a mid-utterance pause of `gapMs` should end a Them segment. */
export function themPauseEndsSegment(gapMs: number): boolean {
  return gapMs > THEM_SILENCE_MS
}
