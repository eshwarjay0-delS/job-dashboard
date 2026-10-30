// Build stamp (owner, 30 Oct 2026: "make it build consistent version, even with future updates").
// Writes the exact commit and the build time into BOTH public/version.json and public/kompas/version.json at build time,
// so /version.json, /kompas/version.json and the Kompas sidebar label always name the commit that is serving.
// The commit comes from VERCEL_GIT_COMMIT_SHA (set by Vercel for git and gitSource deployments). Local fallback:
// KOMPAS_STAMP_LOCAL=1 uses `git rev-parse HEAD`; without it a local build leaves the files untouched, so a dev
// build never dirties tracked files. The "build" key is kept as is (the page's update check compares it with
// window.PERFACT_BUILD); "commit" and "builtAt" are added or refreshed. Best effort: always exits 0.
import { readFileSync, writeFileSync, realpathSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

export const STAMP_FILES = ["../public/version.json", "../public/kompas/version.json"].map((p) => new URL(p, import.meta.url))

function gitHead() {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() } catch { return "" }
}

/** The full commit sha to stamp, or "" when there is none (or it does not look like a sha). */
export function resolveCommit(env = process.env, git = gitHead) {
  const sha = String(env.VERCEL_GIT_COMMIT_SHA || (env.KOMPAS_STAMP_LOCAL === "1" ? git() : "") || "").trim()
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.toLowerCase() : ""
}

/** version.json text with commit (7 chars) and builtAt set; every other key, "build" included, unchanged. */
export function stampJson(text, sha, builtAt) {
  const v = JSON.parse(text)
  v.commit = sha.slice(0, 7)
  v.builtAt = builtAt
  return JSON.stringify(v) + "\n"
}

export function stampVersion({ env = process.env, now = new Date(), files = STAMP_FILES, git = gitHead, log = console.log } = {}) {
  const sha = resolveCommit(env, git)
  if (!sha) { log("[stamp-version] no VERCEL_GIT_COMMIT_SHA (set KOMPAS_STAMP_LOCAL=1 to stamp from git), leaving version.json as is"); return null }
  const builtAt = now.toISOString()
  for (const file of files) {
    try {
      writeFileSync(file, stampJson(readFileSync(file, "utf8"), sha, builtAt))
      log("[stamp-version]", fileURLToPath(file).replace(/^.*\/public\//, "public/"), sha.slice(0, 7), builtAt)
    } catch (error) {
      console.warn("[stamp-version] skipped", String(file), error && error.message)
    }
  }
  return { commit: sha.slice(0, 7), builtAt }
}

const isMain = () => { try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] || "") } catch { return false } }
if (isMain()) {
  try { stampVersion() } catch (error) { console.warn("[stamp-version] skipped:", error && error.message) }
}
