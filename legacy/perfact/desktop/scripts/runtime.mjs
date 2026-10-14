// Prevents Kompas from showing up in Task Manager as "electron.exe — Electron", and from needing a terminal to
// start. It makes a renamed copy of the Electron runtime once (.runtime/Kompas.exe, FileDescription and
// ProductName "Kompas", Kompas icon), then points that copy at this folder through .runtime/resources/app, which
// Electron loads before anything else. So Kompas.exe opens the panel when double-clicked, with no arguments.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const appDir = path.resolve(here, "..");
const require = createRequire(import.meta.url);
export const electronExe = require("electron");                 // absolute path to node_modules/electron/dist/electron.exe
const electronVersion = require("electron/package.json").version;
const runtimeDir = path.join(appDir, ".runtime");
export const kompasExe = path.join(runtimeDir, "Kompas.exe");
const stampFile = path.join(runtimeDir, "stamp.json");
const stubDir = path.join(runtimeDir, "resources", "app");
const iconPng = path.join(appDir, "icon-256.png");
const STAMP = { electron: electronVersion, layout: 2 };

// An .ico may carry a PNG as-is (Vista+), so the existing 256px PNG becomes the icon without an image library.
function icoFromPng(png) {
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); entry.writeUInt8(0, 1);             // 0 = 256px
  entry.writeUInt8(0, 2); entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

export async function stampExe(exe) {
  const ResEdit = await import("resedit");
  const image = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(image);
  const [info] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  if (info) {
    const names = { FileDescription: "Kompas", ProductName: "Kompas", InternalName: "Kompas", OriginalFilename: "Kompas.exe", CompanyName: "Kompas" };
    const langs = info.getAllLanguagesForStringValues();
    for (const lang of langs.length ? langs : [{ lang: 1033, codepage: 1200 }]) info.setStringValues(lang, names);
    info.outputToResourceEntries(res.entries);
  }
  if (fs.existsSync(iconPng)) {
    const [group] = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
    const icon = ResEdit.Data.IconFile.from(icoFromPng(fs.readFileSync(iconPng)));
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group ? group.id : 1, group ? group.lang : 1033, icon.icons.map(i => i.data));
  }
  // Runs as administrator, like the ProcessSpoofer the owner showed (C:\CCT\ProcessSpoofer.exe, manifest
  // level='highestAvailable'): on his admin account Windows shows the UAC run prompt on every launch (owner,
  // 7 Oct 2026: "It basically would run as administrator as well. The processpoofer as well."). Electron ships
  // asInvoker; rewrite that one word in the embedded manifest so the exe asks for the highest rights it can get.
  const RT_MANIFEST = 24;
  for (const e of res.entries) {
    if (e.type !== RT_MANIFEST || !e.bin) continue;
    const xml = Buffer.from(e.bin).toString("utf8");
    if (!/requestedExecutionLevel/i.test(xml)) continue;
    const next = xml.replace(/(<requestedExecutionLevel\s+level=")[^"]*(")/i, "$1highestAvailable$2");
    if (next !== xml) e.bin = Uint8Array.from(Buffer.from(next, "utf8")).buffer;
  }
  res.outputResource(image);
  fs.writeFileSync(exe, Buffer.from(image.generate()));
}

// The stub holds no code. Its main is this folder's main.js, so an edit here is live on the next launch with
// nothing to rebuild; it is rewritten every time so the name and version always match package.json.
function writeAppStub() {
  const pkg = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8"));
  const stub = { name: pkg.name, productName: pkg.productName, version: pkg.version, private: true,
    main: path.relative(stubDir, path.join(appDir, pkg.main || "main.js")).split(path.sep).join("/") };
  fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(path.join(stubDir, "package.json"), JSON.stringify(stub, null, 2) + "\n");
}

export async function ensureRuntime() {
  if (process.platform !== "win32") return null;
  let fresh = false;
  try {
    const stamp = JSON.parse(fs.readFileSync(stampFile, "utf8"));
    fresh = stamp.electron === STAMP.electron && stamp.layout === STAMP.layout && fs.existsSync(kompasExe);
  } catch {}
  if (!fresh) {
    console.log(`Kompas: preparing Kompas.exe from Electron ${electronVersion} (first run only, a few seconds)…`);
    fs.rmSync(runtimeDir, { recursive: true, force: true });
    fs.cpSync(path.dirname(electronExe), runtimeDir, { recursive: true });
    fs.renameSync(path.join(runtimeDir, "electron.exe"), kompasExe);
    await stampExe(kompasExe);
    fs.writeFileSync(stampFile, JSON.stringify(STAMP));
  }
  writeAppStub();
  return kompasExe;
}

// A desktop shortcut to Kompas.exe, started in this folder. Paths travel in environment variables so a folder name
// with spaces or quotes cannot break the PowerShell line.
export function makeShortcut() {
  if (process.platform !== "win32") return null;
  const ps = "$d=[Environment]::GetFolderPath('Desktop'); $p=Join-Path $d 'Kompas.lnk';" +
    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($p); $s.TargetPath=$env:KOMPAS_EXE; $s.WorkingDirectory=$env:KOMPAS_DIR;" +
    "$s.IconLocation=\"$($env:KOMPAS_EXE),0\"; $s.Description='Kompas'; $s.Save(); Write-Output $p";
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps],
    { env: { ...process.env, KOMPAS_EXE: kompasExe, KOMPAS_DIR: appDir }, encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "PowerShell failed").trim());
  return r.stdout.trim();
}
