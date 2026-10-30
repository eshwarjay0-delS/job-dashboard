import { checkRoundTrip } from "@/lib/resume-round-trip-guard"
import { jdTermsGateOn } from "@/lib/jd-terms-gate"

/** Compare every email, not just the first address parsed from a resume. With the job-post terms gate on
 *  (JD_TERMS_ALWAYS_ON_SKILLS, default on), also the round-trip guard: name, phones, links and dates unchanged. */
export function sameResumeIdentity(source: string, output: string): boolean {
  const emails = (text: string) => [...new Set((text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(s => s.toLowerCase()))].sort().join("\n")
  if (emails(source) !== emails(output)) return false
  if (!jdTermsGateOn()) return true
  const rt = checkRoundTrip(source, output)
  if (!rt.ok) console.error("[resume] round-trip guard stopped delivery", { problems: rt.problems.length })
  return rt.ok
}
