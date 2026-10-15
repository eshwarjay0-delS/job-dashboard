export function shouldArchiveSession(sessionId, consentHeader) {
  return Boolean(sessionId) && consentHeader === "granted"
}
