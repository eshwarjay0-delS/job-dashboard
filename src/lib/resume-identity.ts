import { checkRoundTrip } from "@/lib/resume-round-trip-guard"

/**
 * Always verify the complete resume identity round-trip, independently of the
 * JD keyword/coverage switch. Every email occurrence, name, phone, URL and date
 * must survive export unchanged; the switch must never disable this safety check.
 */
export function sameResumeIdentity(source: string, output: string): boolean {
  const rt = checkRoundTrip(source, output)
  if (!rt.ok) {
    // Log categories and counts only; never emit resume text or personal values.
    const categories = [...new Set(rt.problems.map(problem =>
      problem.startsWith("name changed") || problem.startsWith("source has no name")
        ? "name"
        : problem.split(" ")[0],
    ))]
    console.error("[resume] round-trip guard stopped delivery", {
      problems: rt.problems.length,
      categories,
    })
  }
  return rt.ok
}
