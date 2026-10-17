/**
 * Raw session audio and transcript retention is opt-in, not a side effect of
 * providing a session ID. Fail closed unless the user explicitly consented
 * AND an operator deliberately enabled the archive facility.
 *
 * The route authenticates the user and supplies the consent header. The writer
 * repeats this check so future callers cannot bypass the gate accidentally.
 */
export function shouldArchiveSession(sessionId, consentHeader, enabledFlag) {
  return typeof sessionId === "string" && sessionId.length > 0 &&
    consentHeader === "granted" && enabledFlag === "1"
}
