import path from "node:path"
import { createHash } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { DATA_DIR, USER_RESUMES_DIR } from "@/lib/paths"
import { readPath } from "@/lib/storage"

/** Same owner-scoped retrieval for WhatsApp and production import verification. */
export async function recoverLibraryResume(userId: string, documentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(documentId)) return null
  const db = createServiceClient()
  const { data: doc, error } = await db.from("resume_documents").select("id,storage_path,sha256")
    .eq("user_id", userId).eq("id", documentId).maybeSingle()
  if (error) throw error
  if (!doc) return null
  let bytes: Buffer | null = null
  let filepath: string | null = null
  if (doc.storage_path.startsWith(`user-resumes/${userId}/`)) {
    const target = path.resolve(DATA_DIR, doc.storage_path)
    const root = path.resolve(USER_RESUMES_DIR, userId) + path.sep
    if (!target.startsWith(root) || !target.toLowerCase().endsWith(".docx")) return null
    bytes = await readPath(target)
    filepath = target
  } else if (doc.storage_path.startsWith(userId + "/") && !doc.storage_path.split("/").includes("..")) {
    const { data, error: downloadError } = await db.storage.from("resume-library").download(doc.storage_path)
    if (downloadError) throw downloadError
    bytes = Buffer.from(await data.arrayBuffer())
  }
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== doc.sha256) throw new Error("Original resume checksum could not be verified")
  return { bytes, filepath, filename: path.basename(doc.storage_path), sha256: doc.sha256 }
}
