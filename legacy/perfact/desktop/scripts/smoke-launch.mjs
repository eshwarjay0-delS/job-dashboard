// Starts the unpacked Kompas.exe with KOMPAS_SMOKE=1. That flag returns
// before any session file is read and before Chrome is opened. Exit 0 means
// the main process loaded its modules and reached app ready. This file does
// not run the smoke on Linux.
import { spawn } from "node:child_process";
import fs from "node:fs";

const exe = process.argv[2];
if (process.platform !== "win32") {
  console.log("startup smoke skipped: not Windows");
  process.exit(0);
}
if (!exe || !fs.existsSync(exe)) {
  console.error("startup smoke missing " + (exe || "exe"));
  process.exit(1);
}
const child = spawn(exe, [], {
  env: { ...process.env, KOMPAS_SMOKE: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
const take = (chunk) => {
  log += chunk.toString();
  if (log.length > 20000) log = log.slice(-20000);
};
child.stdout.on("data", take);
child.stderr.on("data", take);
const timer = setTimeout(() => {
  child.kill();
  console.error("startup smoke timed out\n" + log);
  process.exit(1);
}, 25000);
child.on("exit", (code) => {
  clearTimeout(timer);
  if (/Cannot find module|Uncaught Exception|A JavaScript error occurred/.test(log) || code !== 0) {
    console.error("startup smoke failed, exit " + code + "\n" + log);
    process.exit(1);
  }
  console.log("startup smoke passed");
});
