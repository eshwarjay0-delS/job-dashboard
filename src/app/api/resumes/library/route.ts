// What the resumes made for jobs have taught, for the signed-in person.
//
//   GET /api/resumes/library
//   -> { ok, commonAt, saved, kinds: [{ email, category, jobs, files, common: [{ word, jobs }], recent: [word], points: [{ text, jobs, words }] }] }
//
// `common` is what `commonAt` or more jobs of that kind asked for; `recent` is what one or two asked for, newest first;
// `points` are the lines that were written for `commonAt` or more of them. Nothing here calls a model: it is read from
// the record kept beside the files (src/lib/resume-library.ts). Kompas prep can ask this for the words to prepare on.
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { readLibraryChecked } from "@/lib/resume-library-store"
import { COMMON_AT, learnedAll } from "@/lib/resume-library"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  const library = await readLibraryChecked(path.join(USER_RESUMES_DIR, userId))
  // A kind of job is listed while a resume made for it is in Files.
  const kinds = learnedAll(library).filter(k => k.files > 0)
  return NextResponse.json({ ok: true, commonAt: COMMON_AT, saved: library.files.length, kinds }, { headers: { "Cache-Control": "private, no-store" } })
}
