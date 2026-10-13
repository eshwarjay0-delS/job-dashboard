// Who the WhatsApp bot answers: the rules only (no storage, no network).
//
// Asked on 13 Oct 2026: "we'll take the mobile number, we'll have to also verify the mobile number with OTP, and once
// we have verified ... they can WhatsApp that number, and they will get the response ... the other numbers which
// haven't registered with our databases, even if they message to our business account number ... they wouldn't get
// any replies at all. And for the ones who were not registered ... they should receive an automated message: go to
// this website."
//
// So: a number is answered only when it is registered. One that is not gets ONE automated message a day that says
// where to register, and nothing else: no help text, no resume, no second message.
//
// Until this day a number nobody had registered was answered anyway, as a default user every such number shared.
// That is now off unless the deployment says WHATSAPP_IDENTITY_BINDING_REQUIRED=0.

/** How a number came to be registered: it sent a link code, the owner named it in settings, or its mobile code was confirmed. */
export type RegisteredBy = "code" | "owner" | "verified"
export type Notice = "unregistered" | "unchecked" | "link_limit"

/** Is the bot open to numbers nobody registered? Only when the deployment says so in these exact words. */
export const openToAll = (setting: string | undefined): boolean => String(setting || "").trim() === "0"

export const NOTICE_EVERY_MS: Record<Notice, number> = {
  // "Go to this website": once a day is a reminder; more is a bot arguing with a stranger.
  unregistered: 24 * 60 * 60 * 1000,
  // "I could not check your number": the check failed on our side, so it is worth saying again sooner.
  unchecked: 10 * 60 * 1000,
  // "That is five codes in an hour": said once for the hour it holds, not once for every code sent after it.
  link_limit: 60 * 60 * 1000,
}

/** Is it time to send this notice to a number? `last` is when each kind was last sent to it. */
export function noticeDue(last: Partial<Record<Notice, number>> | null | undefined, kind: Notice, now: number): boolean {
  const at = Number(last?.[kind]) || 0
  return !at || now - at >= NOTICE_EVERY_MS[kind] || at > now
}

/** An address a person can open: https, a real host, no path. "" when the setting is not one. */
export function siteOf(...candidates: (string | undefined | null)[]): string {
  for (const value of candidates) {
    const text = String(value || "").trim()
    if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(text)) continue
    try { return new URL(text).origin } catch { /* not an address */ }
  }
  return ""
}

/**
 * The one automated message a number that is not registered receives. It names a way to register that works NOW:
 * the code we text to the mobile number, or, while text codes cannot be sent (found on the live site on 13 Oct 2026:
 * the text-message service was refusing our account), the code the WhatsApp page of the site shows.
 */
export function notRegisteredMessage(site: string, textCodes = true): string {
  const where = site ? site.replace(/^https:\/\//, "") : "MarketFit"
  const head = ["This number is not registered with MarketFit, so I cannot answer it here.", "", `1. Open ${where} and sign in.`]
  return (textCodes
    ? [...head, "2. Add this mobile number and type the code we text you.", "", "Then message me again and I will answer."]
    : [...head, "2. Open *WhatsApp* there and press *Link this number*.", "3. Send me the code it shows, like this: link ABCD-1234", "", "After that I answer every message from this number."]
  ).join("\n")
}

/** Said when the check itself failed: the person is not told they are unregistered when that is not known. */
export const NOT_CHECKED_MESSAGE = "I could not check your number just now. This is on our side, not yours. Please send your message again in a few minutes."
