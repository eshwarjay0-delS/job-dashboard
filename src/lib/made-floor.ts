// A resume made earlier for a job is offered again instead of being made again (one job, one file), but only when it
// still meets the floor. Owner, 26 Oct 2026: "the baseline is serve at least 90% match". Resumes made between 22 and
// 26 Oct came back at 28-52% for want of the floor; sent again as they were, the same job would keep getting them.
import { readPath } from "./storage"
import { extractText } from "./docx"
import { extractJdKeywords, coveredJdKeywords } from "./keywords"
import { targetKeywords } from "./keyword-targets"

export const MADE_FLOOR = 0.9

/** The share (0-1) of the job post's own keywords a resume's text shows, certifications and generic words left out. */
export function floorShare(text: string, jd: string): number {
  const targets = targetKeywords(extractJdKeywords(jd), [])
  if (!targets.length) return 1
  return coveredJdKeywords(text, targets).size / targets.length
}

/** Does the resume at `abs` still show 90% of the job's keywords? Unreadable is no: it is made again. */
export async function madeMeetsFloor(abs: string, jd: string): Promise<boolean> {
  try {
    const bytes = await readPath(abs)
    return !!bytes && floorShare(await extractText(bytes), jd) >= MADE_FLOOR
  } catch {
    return false
  }
}
