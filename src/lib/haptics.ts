// ── Haptics ───────────────────────────────────────────────────────────────
// Tiny vibration taps on Android (iOS Safari ignores it — harmless no-op).
// Used on send, approve, refresh, and other "felt" actions so the app feels
// physical, not flat.

export function buzz(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    /* never let haptics break the UI */
  }
}

/** Short tap for buttons and chips. */
export const tapBuzz = () => buzz(10)
/** Double-tap for send/approve — the action landed. */
export const sendBuzz = () => buzz([12, 40, 18])
/** Gentle nudge when something new arrives. */
export const arriveBuzz = () => buzz([8, 60, 8])
/** Strong triple-tap when an interview or deadline lands — impossible to miss. */
export const alertBuzz = () => buzz([30, 60, 30, 60, 60])
