// Adds the deployed commit to public/version.json at build time so /version.json proves which commit is live.
// Vercel sets VERCEL_GIT_COMMIT_SHA for git-based and gitSource deployments. Locally it is absent: the file is left unchanged.
// Best effort: any problem is logged and the build continues (always exits 0).
import { readFileSync, writeFileSync } from "node:fs"
try {
  const file = new URL("../public/version.json", import.meta.url)
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || ""
  if (!sha) {
    console.log("[stamp-version] no VERCEL_GIT_COMMIT_SHA, leaving version.json as is")
  } else {
    const v = JSON.parse(readFileSync(file, "utf8"))
    v.commit = sha.slice(0, 7)
    v.builtAt = new Date().toISOString()
    writeFileSync(file, JSON.stringify(v) + "\n")
    console.log("[stamp-version]", v.build, v.commit)
  }
} catch (error) {
  console.warn("[stamp-version] skipped:", error && error.message)
}