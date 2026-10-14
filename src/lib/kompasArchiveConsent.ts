/** Require an explicit user opt-in and a server-side retention switch. */
export function archiveConsentGranted(sessionId: string, consentHeader: string | null, enabledFlag: string | undefined): boolean {
  return sessionId.length > 0 && consentHeader === "1" && enabledFlag === "1"
}
