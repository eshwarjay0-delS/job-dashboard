import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { createHash } from "node:crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Export how BOTH engines are wired without leaking credentials or executable
// source. The behavioral contract is versioned and harmless to import as data.
// Actual code changes remain reviewed/deployed, never eval'd from a user file.
const NO_STORE = { "Cache-Control": "no-store" }
const RUNTIME_ASSETS = [
  "app.js", "index.html", "move-core.js", "move.js",
  "diamond.js", "jev.js", "jev-prep.js", "levels-core.js",
  "anchors.js", "anchor-flight.js", "correct.js", "feedback.js",
  "review-core.js", "pace-core.js", "score-core.js",
  "lexicon-core.js", "lexicon-data.js", "qbank.js",
  "qbank-library.js", "qbank-problems.js", "dossier-md.js",
] as const

export async function GET() {
  const root = join(process.cwd(), "public", "kompas")
  try {
    const raw = await readFile(join(root, "engine-policy.json"), "utf8")
    const policy = JSON.parse(raw) as Record<string, unknown>
    const assets: Record<string, { sha256: string; bytes: number }> = {}
    const missing: string[] = []
    await Promise.all(RUNTIME_ASSETS.map(async (name) => {
      try {
        const source = await readFile(join(root, name))
        assets[name] = { sha256: createHash("sha256").update(source).digest("hex"), bytes: source.byteLength }
      } catch { missing.push(name) }
    }))
    const sha256 = createHash("sha256").update(raw).digest("hex")
    return NextResponse.json({
      ...policy,
      fingerprint: sha256,
      runtimeAssets: assets,
      missing,
      completeRuntimeAssets: missing.length === 0,
      // These are local parity checks. They do NOT prove that all data in
      // the older browser or every private service was migrated.
      dataMigrated: false,
      safeToDeletePerfact: false,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "Kompas engine manifest unavailable." }, { status: 503, headers: NO_STORE })
  }
}
