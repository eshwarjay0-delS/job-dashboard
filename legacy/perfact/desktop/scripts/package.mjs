// Prevents the Kompas.exe someone downloads from being the dev stub, which only works beside this source folder.
// Builds one self-contained dist/Kompas.exe: the Electron runtime, this shell, and a copy of the web copilot's
// three page files (index.html, styles.css, app.js). No api/ folder, no .env, no key goes in.
// electron-builder's portable target wraps an x64 app in a 32-bit 7-Zip stub (PE machine 0x014C). The file
// Jay double-clicks has to be machine 0x8664 itself, so this packs the x64 win-unpacked folder into an x64
// launcher (scripts/sfx.cs) and that launcher is the Kompas.exe written here.
// `--copy-to <dir>` also copies the exe there (MarketFit serves it from public/downloads).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { build, Platform } from "electron-builder";
import { appDir, stampExe } from "./runtime.mjs";

if (process.platform !== "win32") { console.error("Kompas.exe is a Windows build."); process.exit(1); }

const COPILOT_FILES = ["index.html", "styles.css", "diamond.js", "jev.js", "levels-core.js", "anchors.js", "dossier-md.js", "correct.js", "anchor-flight.js", "screen-core.js", "screen-review.js", "account-sync.js", "desktop-focus.js", "qbank-problems.js", "qbank-library.js", "review-core.js", "pace-core.js", "score-core.js", "feedback.js", "qbank.js", "app.js", "caption-once.js", "version.json"];
// MFit is the canonical app; the earlier perfACT/copilot folder is gone.
// Package the exact same HTML/JS that production serves from public/kompas.
const source = path.resolve(appDir, "..", "..", "..", "public", "kompas");
const stage = path.join(appDir, ".stage", "copilot");
fs.rmSync(path.dirname(stage), { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const f of COPILOT_FILES) fs.copyFileSync(path.join(source, f), path.join(stage, f));

const out = await build({
  targets: Platform.WINDOWS.createTarget("dir", 1),             // 1 = x64. The portable target's own exe is 32-bit.
  config: {
    appId: "app.kompas.desktop",
    productName: "Kompas",
    executableName: "Kompas",
    directories: { output: "dist" },
    files: ["main.js", "marketfit-auth.cjs", "desktop-handoff.cjs", "preload.js", "panel.css", "picker.html", "picker.js", "picker-preload.js", "icon-256.png", "package.json",
      { from: ".stage/copilot", to: "copilot", filter: COPILOT_FILES }],
    asar: true,
    npmRebuild: false,
    win: { icon: "icon-256.png", signAndEditExecutable: false },
    portable: { artifactName: "Kompas.exe", unpackDirName: "Kompas" },
    // rcedit is skipped above (its download fails without symlink rights); the same names and icon go on here
    afterPack: async (ctx) => { await stampExe(path.join(ctx.appOutDir, "Kompas.exe")); },
  },
});

const unpacked = path.join(appDir, "dist", "win-unpacked", "Kompas.exe");
if (!fs.existsSync(unpacked)) { console.error("electron-builder produced no x64 Kompas.exe:", out); process.exit(1); }

const csc = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
const sfxExe = path.join(appDir, "dist", "sfx-stub.exe");
const compiled = spawnSync(csc, ["/nologo", "/platform:x64", "/optimize+", `/out:${sfxExe}`,
  "/r:System.IO.Compression.FileSystem.dll", path.join(appDir, "scripts", "sfx.cs")], { stdio: "inherit" });
if (compiled.status) { console.error("the x64 launcher did not compile"); process.exit(compiled.status || 1); }
await stampExe(sfxExe);

const zip = path.join(appDir, "dist", "payload.zip");
fs.rmSync(zip, { force: true });
const seven = "C:\\Program Files\\7-Zip\\7z.exe";
const packed = spawnSync(seven, ["a", "-tzip", "-mx=1", zip, "*"], { cwd: path.dirname(unpacked), stdio: "inherit" });
if (packed.status) { console.error("the app folder did not zip"); process.exit(packed.status || 1); }

const exe = path.join(appDir, "dist", "Kompas.exe");
const payload = fs.readFileSync(zip);
const len = Buffer.alloc(8);
len.writeBigInt64LE(BigInt(payload.length));
fs.writeFileSync(exe, Buffer.concat([fs.readFileSync(sfxExe), payload, len]));
fs.rmSync(sfxExe, { force: true });
fs.rmSync(zip, { force: true });

const fd = fs.openSync(exe, "r");
const hdr = Buffer.alloc(64);
fs.readSync(fd, hdr, 0, 64, 0);
const mach = Buffer.alloc(2);
fs.readSync(fd, mach, 0, 2, hdr.readUInt32LE(0x3c) + 4);
fs.closeSync(fd);
if (mach.readUInt16LE(0) !== 0x8664) { console.error(`Kompas.exe is PE machine 0x${mach.readUInt16LE(0).toString(16)}, not x64`); process.exit(1); }
console.log(`Kompas.exe: ${exe} (${(fs.statSync(exe).size / 1048576).toFixed(1)} MB, PE 0x8664)`);

const i = process.argv.indexOf("--copy-to");
if (i > 0 && process.argv[i + 1]) {
  const dir = path.resolve(process.argv[i + 1]);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(exe, path.join(dir, "Kompas.exe"));
  console.log(`Copied to:  ${path.join(dir, "Kompas.exe")}`);
}
