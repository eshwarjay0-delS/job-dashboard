import path from "path"
import { createClient } from "@/lib/supabase/server"
import ResumeClient from "./ResumeClient"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { mendLibrary } from "@/lib/resume-library-store"
import { scanLibrary } from "@/lib/resume-library-scan"

export interface ResumeFile {
  id: string
  filename: string
  filepath: string
  category: string
  size: string
  uploadedAt: string
}

export const dynamic = "force-dynamic"

export default async function ResumePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Demo mode: show the page without auth (uses a shared demo folder)
  const userId = user?.id ?? "demo"

  const userDir = path.join(USER_RESUMES_DIR, userId)
  // A folder is named by the email and nothing else: one that was named with more ("x@gmail.comlinkedin") is put back
  // under the email before anything is listed (13 Oct 2026: "Both are same!!").
  await mendLibrary(userDir)
  // One scanner with Files (src/lib/resume-library-scan.ts): the Word files can be tailored, the PDFs are listed beside them.
  const { files, folders } = await scanLibrary(userDir)
  const docx = files.filter(f => f.kind === "docx")
  const pdfs = files.filter((f): f is typeof f & { kind: "pdf" } => f.kind === "pdf")
  return <ResumeClient initialFiles={docx} initialFolders={folders} otherFiles={pdfs} />
}
