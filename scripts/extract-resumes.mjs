/**
 * Extracts Cyber Marketing.zip into resumes/Cyber Marketing/
 * Run: node scripts/extract-resumes.mjs
 */
import { createReadStream, createWriteStream, mkdirSync } from "fs"
import { join, dirname, basename } from "path"
import { pipeline } from "stream/promises"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

const __dir  = dirname(fileURLToPath(import.meta.url))
const ROOT   = join(__dir, "..")
const ZIP    = "C:\\Users\\Eshwa\\AppData\\Roaming\\Claude\\local-agent-mode-sessions\\d38b159c-07a7-49a4-a6a9-95e89dcae100\\021232c8-58e5-465c-bbc1-7a89fd7e8b41\\local_d264c347-d539-48de-a1b4-8d1bf283e288\\uploads\\Cyber Marketing.zip"
const OUT    = join(ROOT, "resumes", "Cyber Marketing")

async function main() {
  // Install unzipper if missing
  let unzipper
  try {
    unzipper = (await import("unzipper")).default
  } catch {
    console.log("Installing unzipper…")
    execSync("npm install unzipper --no-save", { stdio: "inherit", cwd: ROOT })
    unzipper = (await import("unzipper")).default
  }

  mkdirSync(OUT, { recursive: true })
  console.log(`Extracting to: ${OUT}\n`)

  const zip = createReadStream(ZIP).pipe(unzipper.Parse({ forceStream: true }))
  let count = 0

  for await (const entry of zip) {
    const entryPath = entry.path.replace(/\\/g, "/")

    // Skip Mac junk and directories
    if (entryPath.includes("__MACOSX") || entryPath.startsWith(".") || entry.type === "Directory") {
      entry.autodrain(); continue
    }

    if (!entryPath.toLowerCase().endsWith(".docx")) {
      entry.autodrain(); continue
    }

    // Build dest: strip top-level folder from zip path if present
    const parts = entryPath.split("/").filter(Boolean)
    // If zip has a root folder like "Cyber Marketing/Admin/file.docx", skip root
    const relative = parts.length > 1 && parts[0].toLowerCase().includes("cyber") ? parts.slice(1) : parts

    const destDir = relative.length > 1 ? join(OUT, ...relative.slice(0, -1)) : OUT
    mkdirSync(destDir, { recursive: true })
    const dest = join(destDir, relative[relative.length - 1])

    await pipeline(entry, createWriteStream(dest))
    console.log(`  ✓  ${relative.join(" / ")}`)
    count++
  }

  console.log(`\nDone — ${count} resume${count !== 1 ? "s" : ""} extracted to resumes/Cyber Marketing/`)
  console.log("Restart the dev server or hard-refresh the page to see them.")
}

main().catch(e => { console.error("\n✗ Error:", e.message); process.exit(1) })
