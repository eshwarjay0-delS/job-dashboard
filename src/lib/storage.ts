// ── Storage abstraction (filesystem locally, Cloudflare R2 in production) ──────
//
// WHY: the app writes resumes / tailored .docx / jobs / feedback to the local disk
// (see paths.ts). That works locally and on a persistent VPS, but serverless hosts
// (Vercel, Cloudflare) wipe the filesystem between requests — so uploads and tailored
// files would vanish. This interface lets every module read/write by a string KEY
// (e.g. "jobs/ab12.json", "tailored/<token>.docx", "user-resumes/<uid>/r.docx")
// without caring where the bytes actually live.
//
// Adapter selection (see `blob` at the bottom):
//   • R2_BUCKET + R2 credentials present  → Cloudflare R2 (durable, serverless-safe)
//   • otherwise                            → local filesystem under DATA_DIR (dev / VPS)
//
// The R2 adapter is added once a bucket + API token exist (so it can be tested for
// real); until then the filesystem adapter is the default and nothing changes.

import { readFile, writeFile, mkdir, readdir, unlink, stat, rm } from "fs/promises"
import path from "path"
import {
  S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand,
  DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command,
} from "@aws-sdk/client-s3"
import { DATA_DIR } from "@/lib/paths"

export interface Blob {
  /** Write bytes (or a string) at `key`, creating any parent structure. */
  put(key: string, data: Buffer | string): Promise<void>
  /** Read raw bytes, or null if the key doesn't exist. */
  get(key: string): Promise<Buffer | null>
  /** Read as UTF-8 text, or null if absent. */
  getText(key: string): Promise<string | null>
  /** True if the key exists. */
  exists(key: string): Promise<boolean>
  /** Size (bytes) + last-modified for a key, or null if absent. */
  stat(key: string): Promise<{ size: number; mtime: Date } | null>
  /** Delete the key (no-op if already gone). */
  delete(key: string): Promise<void>
  /** Recursively delete everything under a key prefix (a "folder"). */
  deletePrefix(key: string): Promise<void>
  /** List keys under a prefix (recursive), relative to the store root. */
  list(prefix: string): Promise<string[]>
}

// Convert an absolute path that lives under DATA_DIR into a storage key (POSIX,
// relative to the store root). Lets existing code that passes absolute filepaths
// (e.g. resume library entries) read/write through `blob` unchanged — locally the
// FsStorage adapter re-joins DATA_DIR + key → the identical path.
export function keyOf(absPath: string): string {
  const rel = path.relative(DATA_DIR, absPath)
  return rel.split(path.sep).join("/")
}

// ── Absolute-path helpers ──────────────────────────────────────────────────────
// Existing code passes ABSOLUTE paths (resume filepaths, index files). These route
// through `blob` when the path is under DATA_DIR (durable / R2 in prod) and fall back
// to the real filesystem otherwise — which is only the committed, read-only template
// library (RESUMES_LIB, outside DATA_DIR) that ships in the deploy bundle. So user data
// is serverless-safe, and swapping readFile→readPath etc. is a one-line change per site.
function underData(abs: string): boolean {
  if (abs === DATA_DIR) return true
  const r = path.relative(DATA_DIR, abs)
  return !!r && !r.startsWith("..") && !path.isAbsolute(r)
}

export async function readPath(abs: string): Promise<Buffer | null> {
  if (underData(abs)) return blob.get(keyOf(abs))
  try { return await readFile(abs) } catch { return null }
}
export async function readPathText(abs: string): Promise<string | null> {
  if (underData(abs)) return blob.getText(keyOf(abs))
  try { return await readFile(abs, "utf8") } catch { return null }
}
export async function writePath(abs: string, data: Buffer | string): Promise<void> {
  if (underData(abs)) return blob.put(keyOf(abs), data)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, data)
}
export async function existsPath(abs: string): Promise<boolean> {
  if (underData(abs)) return blob.exists(keyOf(abs))
  try { await stat(abs); return true } catch { return false }
}
export async function statPath(abs: string): Promise<{ size: number; mtime: Date } | null> {
  if (underData(abs)) return blob.stat(keyOf(abs))
  try { const s = await stat(abs); return { size: s.size, mtime: s.mtime } } catch { return null }
}
export async function deletePath(abs: string): Promise<void> {
  if (underData(abs)) return blob.delete(keyOf(abs))
  try { await unlink(abs) } catch { /* ignore */ }
}
export async function deleteDir(abs: string): Promise<void> {
  if (underData(abs)) return blob.deletePrefix(keyOf(abs))
  try { await rm(abs, { recursive: true, force: true }) } catch { /* ignore */ }
}
export async function movePath(from: string, to: string): Promise<void> {
  const data = await readPath(from)
  if (data == null) return
  await writePath(to, data)
  await deletePath(from)
}
// Recursively list ALL files under a directory → absolute paths (R2 has no dirs, so a
// "folder" is just a key prefix). Skips Office lock files and dotfiles like readdir did.
export async function listFiles(absDir: string, opts?: { includeHidden?: boolean }): Promise<string[]> {
  const keep = (b: string) => opts?.includeHidden ? !b.startsWith("~$") : (!b.startsWith("~$") && !b.startsWith("."))
  if (underData(absDir)) {
    return (await blob.list(keyOf(absDir)))
      .map(k => path.join(DATA_DIR, ...k.split("/")))
      .filter(p => keep(path.basename(p)))
  }
  const out: string[] = []
  const walk = async (d: string) => {
    let es
    try { es = await readdir(d, { withFileTypes: true }) } catch { return }
    for (const e of es) {
      if (e.name.startsWith("~$") || (!opts?.includeHidden && e.name.startsWith("."))) continue
      const f = path.join(d, e.name)
      if (e.isDirectory()) await walk(f)
      else out.push(f)
    }
  }
  await walk(absDir)
  return out
}

// Keys are POSIX-style ("a/b/c.json"); normalize + guard against path traversal.
function safeSegments(key: string): string[] {
  return key
    .replace(/\\/g, "/")
    .split("/")
    .map(s => s.trim())
    .filter(s => s && s !== "." && s !== "..")
}

// ── Filesystem adapter (default): everything lives under DATA_DIR ──────────────
class FsStorage implements Blob {
  constructor(private root: string) {}
  private abs(key: string): string {
    return path.join(this.root, ...safeSegments(key))
  }
  async put(key: string, data: Buffer | string): Promise<void> {
    const p = this.abs(key)
    await mkdir(path.dirname(p), { recursive: true })
    await writeFile(p, data)
  }
  async get(key: string): Promise<Buffer | null> {
    try { return await readFile(this.abs(key)) } catch { return null }
  }
  async getText(key: string): Promise<string | null> {
    try { return await readFile(this.abs(key), "utf8") } catch { return null }
  }
  async exists(key: string): Promise<boolean> {
    try { await stat(this.abs(key)); return true } catch { return false }
  }
  async stat(key: string): Promise<{ size: number; mtime: Date } | null> {
    try { const s = await stat(this.abs(key)); return { size: s.size, mtime: s.mtime } } catch { return null }
  }
  async delete(key: string): Promise<void> {
    try { await unlink(this.abs(key)) } catch { /* already gone */ }
  }
  async deletePrefix(key: string): Promise<void> {
    try { await rm(this.abs(key), { recursive: true, force: true }) } catch { /* ignore */ }
  }
  async list(prefix: string): Promise<string[]> {
    const base = this.abs(prefix)
    const out: string[] = []
    const walk = async (dir: string, rel: string) => {
      let entries
      try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const childRel = rel ? `${rel}/${e.name}` : e.name
        if (e.isDirectory()) await walk(path.join(dir, e.name), childRel)
        else out.push(prefix ? `${prefix}/${childRel}` : childRel)
      }
    }
    await walk(base, "")
    return out
  }
}

// ── Cloudflare R2 adapter (S3-compatible) ──────────────────────────────────────
// Durable object storage for serverless hosts (Vercel), where the filesystem is
// ephemeral. Same Blob interface; keys map straight to object keys.
function isNotFound(e: unknown): boolean {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } }
  return err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404
}
class R2Storage implements Blob {
  private s3: S3Client
  constructor(private bucket: string, accountId: string, accessKeyId: string, secretAccessKey: string) {
    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  }
  private norm(key: string): string { return safeSegments(key).join("/") }
  async put(key: string, data: Buffer | string): Promise<void> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket, Key: this.norm(key),
      Body: typeof data === "string" ? Buffer.from(data) : data,
    }))
  }
  async get(key: string): Promise<Buffer | null> {
    try {
      const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.norm(key) }))
      const bytes = await r.Body!.transformToByteArray()
      return Buffer.from(bytes)
    } catch (e) { if (isNotFound(e)) return null; throw e }
  }
  async getText(key: string): Promise<string | null> {
    const b = await this.get(key); return b ? b.toString("utf8") : null
  }
  async exists(key: string): Promise<boolean> {
    try { await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.norm(key) })); return true }
    catch { return false }
  }
  async stat(key: string): Promise<{ size: number; mtime: Date } | null> {
    try {
      const r = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.norm(key) }))
      return { size: r.ContentLength ?? 0, mtime: r.LastModified ?? new Date(0) }
    } catch { return null }
  }
  async delete(key: string): Promise<void> {
    try { await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.norm(key) })) } catch { /* ignore */ }
  }
  async list(prefix: string): Promise<string[]> {
    const p = this.norm(prefix)
    const Prefix = p ? p + "/" : undefined
    const keys: string[] = []
    let token: string | undefined
    do {
      const r = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix, ContinuationToken: token }))
      for (const o of r.Contents || []) if (o.Key) keys.push(o.Key)
      token = r.IsTruncated ? r.NextContinuationToken : undefined
    } while (token)
    return keys
  }
  async deletePrefix(prefix: string): Promise<void> {
    const keys = await this.list(prefix)
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000)
      if (batch.length) {
        await this.s3.send(new DeleteObjectsCommand({
          Bucket: this.bucket, Delete: { Objects: batch.map(Key => ({ Key })) },
        }))
      }
    }
  }
}

// ── Adapter selection ──────────────────────────────────────────────────────────
// R2 when all four R2_* env vars are present (serverless/production); otherwise the
// local filesystem (dev / persistent VPS). Set in Vercel's env, NOT in the repo.
function makeBlob(): Blob {
  const { R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (R2_BUCKET && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    return new R2Storage(R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)
  }
  return new FsStorage(DATA_DIR)
}
export const blob: Blob = makeBlob()
