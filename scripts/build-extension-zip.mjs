// Builds the extension people download (public/extension/marketfit-extension.zip) from the extension/ folder.
//
// Found 19 Oct 2026: the zip had been put together by hand and was one change behind the source: it lacked
// trusted-url.js, the 2 Oct hardening of where the extension may send the account's token. Every install since then got
// the older code. Now the zip is made only from the folder, the same way every time, and
// scripts/tests/extension-zip.test.mjs fails if the two ever differ.
//
// Run: node scripts/build-extension-zip.mjs
import JSZip from "jszip"
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const EXTENSION_DIR = path.join(root, "extension")
export const ZIP_PATH = path.join(root, "public", "extension", "marketfit-extension.zip")
// Kept in the folder for people working on it, never shipped.
const LEAVE_OUT = new Set(["README.md", "generate-icons.js"])
const TEXT = /\.(js|json|html|css|svg|md|txt)$/i
// One fixed date on every entry, so the same folder always makes the same zip.
const FIXED_DATE = new Date("2026-01-01T00:00:00Z")

/** Every file that ships, as paths relative to the extension folder with "/" between parts. */
export function extensionFiles(dir = EXTENSION_DIR, prefix = "") {
  const out = []
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".") || LEAVE_OUT.has(name)) continue
    const abs = path.join(dir, name), rel = prefix ? `${prefix}/${name}` : name
    if (statSync(abs).isDirectory()) out.push(...extensionFiles(abs, rel))
    else out.push(rel)
  }
  return out
}

/** A file's bytes as shipped: text files with "\n" line endings whatever the checkout used. */
export function shippedBytes(rel) {
  const bytes = readFileSync(path.join(EXTENSION_DIR, ...rel.split("/")))
  return TEXT.test(rel) ? Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8") : bytes
}

export async function buildZip() {
  const zip = new JSZip()
  for (const rel of extensionFiles()) zip.file(rel, shippedBytes(rel), { date: FIXED_DATE, createFolders: false })
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", platform: "UNIX" })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const buf = await buildZip()
  writeFileSync(ZIP_PATH, buf)
  console.log(`wrote ${path.relative(root, ZIP_PATH)}: ${extensionFiles().length} files, ${buf.length} bytes`)
}
