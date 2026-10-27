// A resume made earlier for a job is offered again instead of being made again (one job, one file), but only when it
// still meets the floor. Owner, 26 Oct 2026: "the baseline is serve at least 90% match". Resumes made between 22 and
// 26 Oct came back at 28-52% for want of the floor; sent again as they were, the same job would keep getting them.
// A file made once the floor was in place is not made again on that account: the floor already did what it could for
// its source, and remaking it on every paste would pay for the same resume again and again.
import { readPath } from "./storage"
import { extractText } from "./docx"
import { extractJdKeywords, coveredJdKeywords } from "./keywords"
import { targetKeywords, floorTerms } from "./keyword-targets"

export const MADE_FLOOR = 0.9
/** By when the floor is live (26 Oct 2026, 17:00 Central; it shipped earlier that afternoon). Files saved after this went through it. */
export const FLOOR_SINCE = Date.parse("2026-10-26T22:00:00Z")

/** The share (0-1) of the job post's own skill terms a resume's text shows: the set the tailor scores and the floor fills. */
export function floorShare(text: string, jd: string): number {
  const targets = floorTerms(jd, targetKeywords(extractJdKeywords(jd), [], jd))
  if (!targets.length) return 1
  return coveredJdKeywords(text, targets).size / targets.length
}

/** Should the resume at `abs`, saved at `at`, be offered again? Made after the floor, or still at 90%: yes. Unreadable: no. */
export async function madeMeetsFloor(abs: string, jd: string, at = 0): Promise<boolean> {
  if (at >= FLOOR_SINCE) return true
  try {
    const bytes = await readPath(abs)
    return !!bytes && floorShare(await extractText(bytes), jd) >= MADE_FLOOR
  } catch {
    return false
  }
}
