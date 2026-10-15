// Prevents Kompas from showing up in Task Manager as "electron.exe — Electron" when started from a terminal.
// `electron .` runs the stock binary, so every Kompas process would carry Electron's name. This prepares
// .runtime/Kompas.exe (scripts/runtime.mjs) and launches it. If the copy cannot be made, it says so and falls back
// to plain Electron rather than failing to start.
import { spawn } from "node:child_process";
import { appDir, electronExe, ensureRuntime } from "./runtime.mjs";

let exe = electronExe;
try { exe = (await ensureRuntime()) || electronExe; }
catch (err) {
  console.warn(`Kompas: could not prepare Kompas.exe (${err.message}). Starting with electron.exe instead; Task Manager will show "Electron".`);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(exe, [appDir, ...process.argv.slice(2)], { stdio: "inherit", env, windowsHide: false });
child.on("close", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
