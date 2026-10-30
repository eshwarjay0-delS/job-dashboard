#!/usr/bin/env node
/**
 * Failing-without-the-fix proof (29 Oct 2026). Runs a test file from the CURRENT tree against the src/ (and scripts/
 * helpers) of an OLDER commit, the one before the fix, one test at a time, and reports which tests fail there.
 * A fix test should FAIL before the fix; a "failsafe" test (the fix must not break X) may pass before and after, and
 * is reported as such rather than counted as a proof. Exports the test imports that did not exist yet are stubbed to
 * throw, so each test fails on its own instead of the whole file failing on import.
 *
 *   node scripts/kompas-fix-proof.mjs <base-commit> <test-file> [<test-file> ...]
 * Read-only for this repo: it uses a throwaway `git worktree` under /tmp and removes it. Offline, no network.
 */
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, mkdtempSync, cpSync, rmSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, resolve } from "node:path"

const repo = resolve(new URL("..", import.meta.url).pathname)
const [base, ...files] = process.argv.slice(2)
if (!base || !files.length) { console.error("usage: kompas-fix-proof.mjs <base-commit> <test-file>..."); process.exit(2) }

export function testNames(source) {
  return [...source.matchAll(/^\s*test\(\s*(["'`])((?:\\.|(?!\1).)*)\1/gm)].map((m) => m[2])
}

const dir = mkdtempSync(join(tmpdir(), "kompas-fix-proof-"))
const wt = join(dir, "tree")
execFileSync("git", ["-C", repo, "worktree", "add", "--detach", wt, base], { stdio: "ignore" })
const report = []
try {
  // Fixtures and harness scripts the new tests read are copied from the current tree; src/ stays at the base.
  for (const p of ["tests/fixtures", "scripts/fixtures"]) if (existsSync(join(repo, p))) cpSync(join(repo, p), join(wt, p), { recursive: true })
  for (const file of files) {
    const source = readFileSync(join(repo, file), "utf8")
    for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
      if (!m[2].startsWith(".")) continue
      const target = resolve(dirname(join(wt, file)), m[2])
      if (!target.startsWith(join(wt, "src"))) {
        if (target.startsWith(join(wt, "scripts")) && !existsSync(target)) cpSync(join(repo, target.slice(wt.length + 1)), target)
        continue
      }
      if (!existsSync(target)) { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, "") }
      let body = readFileSync(target, "utf8")
      for (const raw of m[1].split(",")) {
        const name = raw.replace(/^\s*type\s+/, "").split(/\s+as\s+/)[0].trim()
        if (!name || new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|class|type|interface)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`).test(body)) continue
        body += `\nexport function ${name}(): never { throw new Error("${name} did not exist before the fix") }\n`
      }
      writeFileSync(target, body)
    }
    mkdirSync(dirname(join(wt, file)), { recursive: true })
    writeFileSync(join(wt, file), source)
    for (const name of testNames(source)) {
      const pattern = `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
      const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", `--test-name-pattern=${pattern}`, file], { cwd: wt, encoding: "utf8", timeout: 120000 })
      const out = run.stdout || ""
      const failed = /^not ok \d+/m.test(out) || run.status !== 0
      const ran = /^(?:not )?ok \d+/m.test(out)
      report.push({ file, test: name, beforeFix: !ran ? "did not run" : failed ? "FAILS" : "passes", failsafe: /failsafe/i.test(name) })
    }
  }
} finally {
  execFileSync("git", ["-C", repo, "worktree", "remove", "--force", wt], { stdio: "ignore" })
  rmSync(dir, { recursive: true, force: true })
}
let proven = 0, failsafeHeld = 0, notProven = []
for (const r of report) {
  const verdict = r.beforeFix === "FAILS" ? "PROVEN (fails without the fix)" : r.failsafe ? "failsafe (passes before and after; guards against over-fixing)" : "NOT PROVEN (passes without the fix)"
  if (r.beforeFix === "FAILS") proven++
  else if (r.failsafe) failsafeHeld++
  else notProven.push(r.test)
  console.log(`${verdict.padEnd(64)} ${r.test}`)
}
console.log(`\n${report.length} tests: ${proven} fail without the fix, ${failsafeHeld} failsafes pass before and after, ${notProven.length} not proven (base ${base})`)
process.exitCode = notProven.length ? 1 : 0
