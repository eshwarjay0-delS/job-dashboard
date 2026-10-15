// Prevents "open Kompas" from meaning "open a terminal and type npm start". Prepares .runtime/Kompas.exe so it
// runs on a double-click, and puts a Kompas shortcut on the desktop. `--no-shortcut` skips the shortcut.
import { ensureRuntime, makeShortcut } from "./runtime.mjs";

if (process.platform !== "win32") { console.error("Kompas.exe is a Windows build. Use npm start elsewhere."); process.exit(1); }
const exe = await ensureRuntime();
console.log(`Kompas.exe: ${exe}`);
if (!process.argv.includes("--no-shortcut")) console.log(`Shortcut:   ${makeShortcut()}`);
