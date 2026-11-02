"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { chooseDesktopUpdate, parseVersion, OFFICIAL_RELEASE } = require("../desktop-update.cjs");
const cases = [
  ["new patch", "0.8.5", "0.8.6", true],
  ["new minor", "0.8.5", "0.9.0", true],
  ["new major", "0.8.5", "1.0.0", true],
  ["already current", "0.8.6", "0.8.6", false],
  ["older patch", "0.8.6", "0.8.5", false],
  ["older minor", "0.9.0", "0.8.9", false],
  ["older major", "1.0.0", "0.99.99", false],
  ["numeric version not lexical", "0.8.9", "0.8.10", true],
  ["installed newer patch", "0.8.10", "0.8.9", false],
  ["future major", "0.9.99", "1.0.0", true],
];
for(const [name, installed, latest, expected] of cases) {
  test("version fold: " + name, () => {
    assert.equal(!!chooseDesktopUpdate(installed,{version:latest,downloadUrl:OFFICIAL_RELEASE}),expected);
  });
}
test("invalid update metadata never becomes a clickable executable",()=>{
  for(const latest of ["", "0.8", "v0.8.6", "0.8.6-beta", "0.8.6.7", "1.0.0000", "../1", null, {}, 8])
    assert.equal(chooseDesktopUpdate("0.8.5",{version:latest,downloadUrl:OFFICIAL_RELEASE}),null);
});
test("remote URL injection and redirect lookalikes cannot be offered",()=>{
  for(const url of [
    "http://github.com/eshwarjay0-delS/job-dashboard/releases/download/kompas-desktop-latest/Kompas.exe",
    "https://github.com.evil.example/eshwarjay0-delS/job-dashboard/releases/download/kompas-desktop-latest/Kompas.exe",
    "https://example.com/Kompas.exe",
    "https://github.com/eshwarjay0-delS/job-dashboard/releases/download/kompas-desktop-latest/Kompas.exe?external=1",
    "https://github.com/eshwarjay0-delS/job-dashboard/releases/download/kompas-desktop-latest/Kompas.exe#javascript:alert(1)",
    "javascript:alert(1)", "", null
  ]) assert.equal(chooseDesktopUpdate("0.8.5",{version:"0.8.6",downloadUrl:url}),null);
});
test("native update is only a consented official browser download, never silent install",()=>{
  const fs = require("node:fs"),path=require("node:path");
  const main=fs.readFileSync(path.join(__dirname,"..","main.js"),"utf8");
  assert.match(main,/chooseDesktopUpdate\(app\.getVersion\(\), manifest\)/);
  assert.match(main,/dialog\.showMessageBox\(win, \{/);
  assert.match(main,/if \(response === 0\) await shell\.openExternal\(offer\.downloadUrl\)/);
  assert.match(main,/void checkNativeDesktopUpdate\(\)/);
  assert.doesNotMatch(main,/autoUpdater\.quitAndInstall|autoUpdater\.downloadUpdate/);
});
test("the desktop manifest is same-origin and uses the current installed app version",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const main=fs.readFileSync(path.join(__dirname,"..","main.js"),"utf8");
  assert.match(main,/MARKETFIT_API_ORIGIN \+ "\/api\/kompas\/desktop-version"/);
  assert.match(main,/redirect: "error"/);
  assert.match(main,/if \(!startedForMarketFit \|\| updateCheckDone\) return/);
});
