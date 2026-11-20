// Offline Parakeet S5 gate. No model call, no network.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const testFile = fileURLToPath(new URL("./tests/kompas-s5-gate.test.mjs", import.meta.url))
const run = spawnSync(process.execPath, ["--experimental-strip-types", "--test", testFile], { stdio: "inherit" })
if (run.status !== 0) {
  console.error("S5 gate failed")
  process.exit(run.status || 1)
}
console.log("S5 gate: screen, press, and honesty fixtures passed 10/10 folds")
