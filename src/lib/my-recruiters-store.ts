// Where a person's recruiter list is kept: one small file per person on the server (not in the sign-in cookie).
// The rules of the list are in my-recruiters.ts.
import { blob } from "@/lib/storage"
import { validRecruiters, type RecruiterRule } from "@/lib/my-recruiters"

const keyOf = (userId: string): string => `mail/recruiters/${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`

export async function readRecruiters(userId: string): Promise<RecruiterRule[]> {
  try { return validRecruiters(JSON.parse((await blob.getText(keyOf(userId))) || "[]")) } catch { return [] }
}
export async function writeRecruiters(userId: string, rules: RecruiterRule[]): Promise<void> {
  await blob.put(keyOf(userId), JSON.stringify(validRecruiters(rules)))
}
