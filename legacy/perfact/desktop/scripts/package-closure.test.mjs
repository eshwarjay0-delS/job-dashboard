import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { missingPackaged, shellPackageFiles } from "./package-closure.mjs";
import { assertAsarClosure, assertPackagedExe, listAsarFiles } from "./verify-packaged-app.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLISHED_1B116CE = [
  "chrome-handoff.cjs", "desktop-handoff.cjs", "desktop-update.cjs", "main.js",
  "marketfit-auth.cjs", "package.json", "panel.css", "picker-preload.js",
  "picker.html", "picker.js", "preload.js",
];

test("the shell package list is the require closure, including capture and taskbar", () => {
  const files = shellPackageFiles(root);
  for (const name of ["main.js", "auth-disabled.cjs", "capture-source.cjs", "output-loopback.cjs", "taskbar-choice.cjs", "chrome-handoff.cjs", "marketfit-auth.cjs", "desktop-handoff.cjs", "desktop-update.cjs", "preload.js", "picker-preload.js", "picker.html", "picker.js", "panel.css"]) {
    assert.equal(files.includes(name), true, name);
  }
  assert.equal(files.includes("icon-256.png"), false);
  const packageSource = fs.readFileSync(path.join(root, "scripts", "package.mjs"), "utf8");
  assert.match(packageSource, /shellPackageFiles\(appDir\)/);
  assert.match(packageSource, /assertPackagedExe\(exe\)/);
});

test("the published 1b116ce asar list fails this gate on later startup modules", () => {
  const missing = missingPackaged(PUBLISHED_1B116CE, shellPackageFiles(root));
  assert.deepEqual(missing, ["auth-disabled.cjs", "capture-source.cjs", "output-loopback.cjs", "taskbar-choice.cjs"]);
});

test("a packaged asar that contains the closure passes, and a dropped module fails", () => {
  const required = shellPackageFiles(root);
  const real = Object.fromEntries(required.map((name) => [name, fs.readFileSync(path.join(root, name))]));
  const good = fakeAsar(real);
  assert.deepEqual(listAsarFiles(good).filter((name) => required.includes(name)).sort(), required);
  assert.doesNotThrow(() => assertAsarClosure(good));
  const bad = { ...real };
  delete bad["capture-source.cjs"];
  assert.throws(() => assertAsarClosure(fakeAsar(bad)), /capture-source\.cjs/);
});

test("the launcher zip is what the gate reads", async () => {
  const required = shellPackageFiles(root);
  const asar = fakeAsar(Object.fromEntries(required.map((name) => [name, fs.readFileSync(path.join(root, name))])));
  const zip = zipStore({ "resources/app.asar": asar, "Kompas.exe": Buffer.from("MZ") });
  const len = Buffer.alloc(8);
  len.writeBigInt64LE(BigInt(zip.length));
  const exe = Buffer.concat([Buffer.from("MZ-stub"), zip, len]);
  const dir = fs.mkdtempSync(path.join(root, ".stage-closure-"));
  const exePath = path.join(dir, "Kompas.exe");
  try {
    fs.writeFileSync(exePath, exe);
    const result = await assertPackagedExe(exePath);
    assert.equal(result.required.includes("capture-source.cjs"), true);
    assert.equal(result.required.includes("taskbar-choice.cjs"), true);
    assert.equal(result.required.includes("output-loopback.cjs"), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function fakeAsar(files) {
  let cursor = 0;
  const tree = { files: {} };
  const blobs = [];
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text);
    const parts = name.split("/");
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      node.files[parts[i]] = node.files[parts[i]] || { files: {} };
      node = node.files[parts[i]];
    }
    node.files[parts[parts.length - 1]] = { size: data.length, offset: String(cursor) };
    blobs.push(data);
    cursor += data.length;
  }
  const json = Buffer.from(JSON.stringify(tree));
  const header = Buffer.concat([Buffer.alloc(16), json]);
  const pad = (4 - ((header.length) & 3)) & 3;
  return Buffer.concat([header, Buffer.alloc(pad), ...blobs]);
}

function zipStore(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  let index = 0;
  for (const [name, raw] of Object.entries(files)) {
    const stored = index++ % 2 === 0;
    const data = stored ? raw : zlib.deflateRawSync(raw);
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(stored ? 0 : 8, 10);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(raw.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}
