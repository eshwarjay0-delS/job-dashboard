"use strict";

// Only this canonical public GitHub release can be opened by Kompas. The
// manifest is public metadata, never a command or arbitrary executable URL.
const OFFICIAL_RELEASE = "https://github.com/eshwarjay0-delS/job-dashboard/releases/download/kompas-desktop-latest/Kompas.exe";
function parseVersion(input) {
  if (typeof input !== "string" || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(input)) return null;
  const numbers = input.split(".").map(Number);
  return numbers.every(n => Number.isInteger(n) && n < 1000) ? numbers : null;
}
function chooseDesktopUpdate(installed, manifest) {
  const current = parseVersion(installed);
  const next = parseVersion(manifest?.version);
  if (!current || !next || manifest?.downloadUrl !== OFFICIAL_RELEASE) return null;
  for (let i = 0; i < current.length; i++) {
    if (next[i] < current[i]) return null;
    if (next[i] > current[i]) return { version: manifest.version, downloadUrl: OFFICIAL_RELEASE };
  }
  return null;
}
module.exports = { OFFICIAL_RELEASE, parseVersion, chooseDesktopUpdate };
