// Reads the Windows launcher Kompas.exe (PE stub + zip + int64 length) or an
// app directory and fails if the asar is missing a file main.js will require.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { missingPackaged, runtimeClosure } from "./package-closure.mjs";

export function listAsarFiles(buf) {
  const start = buf.indexOf(Buffer.from("{"));
  if (start < 0 || start > 128) throw new Error("asar header was not found");
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < buf.length; i++) {
    const c = buf[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === 0x5c) esc = true;
      else if (c === 0x22) inStr = false;
      continue;
    }
    if (c === 0x22) inStr = true;
    else if (c === 0x7b) depth++;
    else if (c === 0x7d) {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) throw new Error("asar header json was truncated");
  const header = JSON.parse(buf.slice(start, end).toString("utf8"));
  const names = [];
  const walk = (node, prefix) => {
    for (const [name, value] of Object.entries(node.files || {})) {
      const next = prefix ? prefix + "/" + name : name;
      if (value && value.files) walk(value, next);
      else names.push(next);
    }
  };
  walk(header, "");
  return names.sort();
}

function findZip(buf) {
  if (buf.length >= 8 && buf.readUInt32LE(0) === 0x04034b50) return buf;
  if (buf.length < 16) throw new Error("packaged exe is too small");
  const len = Number(buf.readBigInt64LE(buf.length - 8));
  if (!Number.isInteger(len) || len < 32 || len > buf.length - 8) throw new Error("packaged exe has no zip payload");
  const zip = buf.subarray(buf.length - 8 - len, buf.length - 8);
  if (zip.readUInt32LE(0) !== 0x04034b50) throw new Error("packaged exe payload is not a zip");
  return zip;
}

export function readZip(buf) {
  const zip = findZip(buf);
  const files = new Map();
  let pos = 0;
  while (pos + 30 <= zip.length && zip.readUInt32LE(pos) === 0x04034b50) {
    const method = zip.readUInt16LE(pos + 8);
    const compSize = zip.readUInt32LE(pos + 18);
    const nameLen = zip.readUInt16LE(pos + 26);
    const extraLen = zip.readUInt16LE(pos + 28);
    const name = zip.subarray(pos + 30, pos + 30 + nameLen).toString("utf8").replaceAll("\\", "/");
    const dataStart = pos + 30 + nameLen + extraLen;
    const compressed = zip.subarray(dataStart, dataStart + compSize);
    let data = compressed;
    if (method === 8) data = zlib.inflateRawSync(compressed);
    else if (method !== 0) throw new Error("unsupported zip method " + method + " for " + name);
    files.set(name, data);
    pos = dataStart + compSize;
  }
  return files;
}

export function asarFromPackage(buf) {
  const files = readZip(buf);
  for (const [name, data] of files) {
    if (name === "resources/app.asar" || name.endsWith("/resources/app.asar")) return data;
  }
  throw new Error("packaged app has no resources/app.asar");
}

function asarFileBytes(asarBuf) {
  const start = asarBuf.indexOf(Buffer.from("{"));
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < asarBuf.length; i++) {
    const c = asarBuf[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === 0x5c) esc = true;
      else if (c === 0x22) inStr = false;
      continue;
    }
    if (c === 0x22) inStr = true;
    else if (c === 0x7b) depth++;
    else if (c === 0x7d) { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const header = JSON.parse(asarBuf.slice(start, end).toString("utf8"));
  const dataStart = (end + 3) & ~3;
  const out = new Map();
  const walk = (node, prefix) => {
    for (const [name, value] of Object.entries(node.files || {})) {
      const next = prefix ? prefix + "/" + name : name;
      if (value && value.files) walk(value, next);
      else if (value && value.size != null && value.offset != null) {
        const offset = Number(value.offset);
        out.set(next, asarBuf.subarray(dataStart + offset, dataStart + offset + value.size));
      }
    }
  };
  walk(header, "");
  return out;
}

export function assertAsarClosure(asarBuf) {
  const bytes = asarFileBytes(asarBuf);
  const closure = runtimeClosure(
    (rel) => bytes.get(rel).toString("utf8"),
    (rel) => bytes.has(rel),
  );
  const missing = [...new Set([...closure.missing, ...missingPackaged(bytes.keys(), closure.required)])].sort();
  if (missing.length) throw new Error("Packaged app is missing runtime files: " + missing.join(", "));
  return closure;
}

async function assertAsInvokerManifest(exeBytes, label) {
  const ResEdit = await import("resedit");
  const image = ResEdit.NtExecutable.from(Buffer.from(exeBytes), { ignoreCert: true });
  const resources = ResEdit.NtExecutableResource.from(image);
  const manifests = resources.entries.filter((entry) => entry.type === 24 && entry.bin);
  if (!manifests.length) throw new Error(label + " has no RT_MANIFEST resource");
  for (let i = 0; i < manifests.length; i++) {
    const xml = Buffer.from(manifests[i].bin).toString("utf8");
    const level = xml.match(/<requestedExecutionLevel\\b[^>]*\\blevel="([^"]+)"/i);
    if (!level) throw new Error(label + " manifest " + (i + 1) + " has no requestedExecutionLevel");
    if (level[1].toLowerCase() !== "asinvoker") {
      throw new Error(label + " manifest " + (i + 1) + " requests " + level[1] + ", expected asInvoker");
    }
    const uiAccess = xml.match(/<requestedExecutionLevel\\b[^>]*\\buiAccess="([^"]+)"/i);
    if (uiAccess && uiAccess[1].toLowerCase() !== "false") {
      throw new Error(label + " manifest " + (i + 1) + " enables uiAccess");
    }
  }
  return manifests.length;
}

export async function assertPackagedExe(exePath) {
  const buf = fs.readFileSync(exePath);
  const outerManifestResources = await assertAsInvokerManifest(buf, "outer SFX launcher");
  const files = readZip(buf);
  const innerExe = [...files.entries()].find(([name]) => name === "Kompas.exe" || name.endsWith("/Kompas.exe"));
  if (!innerExe) throw new Error("packaged launcher has no inner Kompas.exe");
  const innerManifestResources = await assertAsInvokerManifest(innerExe[1], "inner Electron executable");
  const asar = [...files.entries()].find(([name]) => name === "resources/app.asar" || name.endsWith("/resources/app.asar"));
  if (!asar) throw new Error("packaged app has no resources/app.asar");
  const closure = assertAsarClosure(asar[1]);
  return {
    bytes: buf.length,
    required: closure.required,
    absent: closure.absent,
    manifestResources: { outer: outerManifestResources, inner: innerManifestResources },
  };
}

if (process.argv[1] && /verify-packaged-app\.mjs$/.test(process.argv[1])) {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: node scripts/verify-packaged-app.mjs <Kompas.exe>");
    process.exit(1);
  }
  try {
    const result = await assertPackagedExe(target);
    console.log("packaged runtime closure ok (" + result.required.length + " files, " + result.bytes + " bytes)");
    console.log(result.required.join("\n"));
  } catch (error) {
    console.error(String(error && error.message || error));
    process.exit(1);
  }
}
