import { NextRequest, NextResponse } from "next/server"
import path from "node:path"
import { createHash } from "node:crypto"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { USER_RESUMES_DIR, DATA_DIR } from "@/lib/paths"
import { listFiles, readPath, writePath, deletePath } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { CATEGORY_FOLDERS, organizeResumes } from "@/lib/resumeOrganization"
import { isTailoredName } from "@/lib/resume-library"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  const root = path.join(USER_RESUMES_DIR, userId)
  try {
    // A resume made for one job ("... (tailored)") is left where it is. This tidy-up keeps the strongest two resumes per
    // kind of work and removes the rest; run over the tailored ones it would delete all but two of them (13 Oct 2026:
    // "store every other file that a user had ever updated into ... a big library").
    const paths = (await listFiles(root)).filter(p => p.toLowerCase().endsWith(".docx") && !isTailoredName(path.basename(p)))
    if (paths.length > 1000) return NextResponse.json({ error: "Organize at most 1,000 source resumes per run." }, { status: 413 })
    const inputs = []
    let totalBytes = 0
    for (const filepath of paths) {
      const relative = path.relative(root, filepath)
      if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid source path")
      const bytes = await readPath(filepath)
      if (!bytes) throw new Error("A source resume is unavailable. No files were removed.")
      totalBytes += bytes.length
      if (totalBytes > 50 * 1024 * 1024) return NextResponse.json({ error: "Organize at most 50 MB of source resumes per run." }, { status: 413 })
      inputs.push({ id: filepath, filename: path.basename(filepath), text: await extractText(bytes), bytes })
    }
    const plan = organizeResumes(inputs)
    if (!inputs.length) return NextResponse.json({ error: "Upload your resume ZIP first, then organize by email." }, { status: 400 })
    const backup = path.join(DATA_DIR, "resume-backups", userId, new Date().toISOString().replace(/[:.]/g, "-"))
    // Back up every source before moving or removing anything. Backups live outside
    // the active library and are never indexed as extra resumes.
    for (const input of inputs) await writePath(path.join(backup, path.relative(root, input.id)), input.bytes)
    const destinations = new Set<string>()
    for (const item of plan.kept) {
      if (!item.email) { destinations.add(item.id); continue }
      const hash = createHash("sha256").update(item.bytes).digest("hex").slice(0, 16)
      const name = item.filename.replace(/\.docx$/i, "").replace(/[^a-z0-9._ ()-]/gi, "_").slice(0, 120)
      const destination = path.join(root, item.email, item.category, `${name.replace(/__[a-f0-9]{16}$/, "")}__${hash}.docx`)
      await writePath(destination, item.bytes)
      const verified = await readPath(destination)
      if (!verified?.equals(item.bytes)) throw new Error("Could not verify a saved resume. Original files have been preserved.")
      destinations.add(destination)
    }
    for (const email of plan.emails) {
      for (const category of CATEGORY_FOLDERS) await writePath(path.join(root, email, category, ".keep"), "")
    }
    await writePath(path.join(backup, "organization-report.json"), JSON.stringify({ removed: plan.removed, kept: plan.kept.map(({ id, email, category, score, evidence }) => ({ id, email, category, score, evidence })) }))
    // Finish all copies first; if a concurrent edit changed a source, preserve it.
    for (const input of inputs) {
      if (destinations.has(input.id)) continue
      const current = await readPath(input.id)
      if (current?.equals(input.bytes)) await deletePath(input.id)
    }
    await deletePath(path.join(root, ".resume-library-index.json"))
    return NextResponse.json({ kept: plan.kept.length, removed: plan.removed.length, emails: plan.emails, foldersPerEmail: CATEGORY_FOLDERS.length, unassigned: plan.kept.filter(v => !v.email).length })
  } catch (error) {
    console.error("[/api/resumes/organize]", error)
    return NextResponse.json({ error: "Organization could not finish. Source backups are preserved; retry when storage is available." }, { status: 500 })
  }
}
