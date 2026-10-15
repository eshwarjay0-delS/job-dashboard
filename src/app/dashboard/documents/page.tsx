// Standalone Documents page — real resume/file manager (upload, folders,
// move/delete, ZIP import). Was previously a redirect into the My Resume hub's
// Documents tab; now a real page at its own URL, scanning the SAME on-disk
// resume folder (with the SAME scanner, src/lib/resume-library-scan.ts) and
// rendering the SAME DocumentsClient component the hub tab uses — so the two
// stay perfectly in sync (add a file here, it shows there).
import path from "path"
import { createClient } from "@/lib/supabase/server"
import PageIntro from "../_components/page-intro"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { mendLibrary } from "@/lib/resume-library-store"
import { scanLibrary } from "@/lib/resume-library-scan"
import DocumentsClient from "./DocumentsClient"

export const dynamic = "force-dynamic"

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? "demo"

  const userDir = path.join(USER_RESUMES_DIR, userId)
  // A folder is named by the email and nothing else: one that was named with more ("x@gmail.comlinkedin") is put back
  // under the email before anything is listed (13 Oct 2026: "Both are same!!").
  await mendLibrary(userDir)
  const { files, folders } = await scanLibrary(userDir)

  return (
    <div>
      <PageIntro page="/dashboard/documents" action={{ label: "Add a resume file", htmlFor: "doc-upload" }} />
      <DocumentsClient initialFiles={files} initialFolders={folders} />
    </div>
  )
}
