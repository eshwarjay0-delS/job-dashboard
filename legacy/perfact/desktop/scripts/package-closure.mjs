// Runtime files the packaged Electron app must contain.
// main.js loads these with require() before any window exists. A name that
// is only in the source tree, and not in the asar, crashes startup with
// "Cannot find module".
import fs from "node:fs";
import path from "node:path";

const ENTRY = ["main.js", "preload.js", "picker-preload.js", "picker.html"];
// Referenced from main.js as a window icon. The file is not in this repo, and
// Electron does not require() it, so it is not the startup crash.
const KNOWN_ABSENT = new Set(["icon-256.png"]);

export function dependencies(text, fromRel) {
  const dir = path.posix.dirname(String(fromRel).replaceAll("\\", "/"));
  const out = [];
  const add = (spec, fromRequire) => {
    if (!spec) return;
    let rel = spec;
    if (fromRequire) {
      if (!spec.startsWith(".")) return;
      rel = path.posix.join(dir === "." ? "" : dir, spec);
    }
    rel = path.posix.normalize(rel);
    if (rel.startsWith("./")) rel = rel.slice(2);
    if (!rel || rel.startsWith("../") || rel.includes("..")) return;
    out.push(rel);
  };
  for (const match of text.matchAll(/require\(\s*["'](\.[^"']+)["']\s*\)/g)) add(match[1], true);
  for (const match of text.matchAll(/path\.join\(\s*__dirname\s*,\s*["']([^"']+)["']\s*\)/g)) add(match[1], false);
  for (const match of text.matchAll(/<script\s+src=["']([^"':]+)["']/g)) add(match[1], false);
  return out;
}

export function runtimeClosure(readFile, exists) {
  const required = new Set();
  const absent = new Set();
  const missing = new Set();
  const seen = new Set();
  const queue = [...ENTRY];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!exists(rel)) {
      if (KNOWN_ABSENT.has(rel)) { absent.add(rel); continue; }
      missing.add(rel);
      continue;
    }
    required.add(rel);
    const text = readFile(rel);
    for (const dep of dependencies(text, rel)) {
      if (!seen.has(dep)) queue.push(dep);
    }
  }
  return { required: [...required].sort(), absent: [...absent].sort(), missing: [...missing].sort() };
}

export function shellPackageFiles(root) {
  const closure = runtimeClosure(
    (rel) => fs.readFileSync(path.join(root, rel), "utf8"),
    (rel) => {
      try { return fs.statSync(path.join(root, rel)).isFile(); } catch { return false; }
    },
  );
  if (closure.missing.length) throw new Error("Desktop runtime file is missing: " + closure.missing.join(", "));
  return closure.required;
}

export function missingPackaged(packagedNames, required) {
  const have = new Set([...packagedNames].map((name) => String(name).replaceAll("\\", "/").replace(/^\.?\//, "")));
  return required.filter((file) => !have.has(file));
}
