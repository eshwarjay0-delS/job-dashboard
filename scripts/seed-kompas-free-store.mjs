#!/usr/bin/env node
// One-shot seed of the login-off owner's Kompas sessions into the free Vercel Blob store.
// Reads a JSON dump (not committed; it can contain resume text). Does not print payloads.
// Usage: node --experimental-strip-types scripts/seed-kompas-free-store.mjs /path/to/dump.json
import { readFileSync } from "node:fs"
import { replaceCatalog, saveArtifact, setFreeStoreClockForTests } from "../src/lib/kompasFreeSessionStore.ts"

const path = process.argv[2]
if (!path) {
  console.error("Usage: node --experimental-strip-types scripts/seed-kompas-free-store.mjs <dump.json>")
  process.exit(2)
}
if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.KOMPAS_BLOB_STORE_ID) {
  console.error("Set BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN first. Do not paste the token into a log.")
  process.exit(2)
}

const dump = JSON.parse(readFileSync(path, "utf8"))
const userId = dump.userId
if (!userId || !Array.isArray(dump.sessions)) {
  console.error("Dump must have userId and sessions[].")
  process.exit(2)
}

const rows = dump.sessions.map(row => ({
  session_id: row.session_id,
  payload: row.payload && typeof row.payload === "object" ? row.payload : {},
  deleted_at: row.deleted_at || null,
  updated_at: row.updated_at,
  revision: Number(row.revision) || 1,
}))
await replaceCatalog(userId, rows)
let artifacts = 0
for (const item of dump.artifacts || []) {
  setFreeStoreClockForTests(() => item.updated_at || new Date().toISOString())
  try {
    const saved = await saveArtifact(userId, item.session_id, item.artifact_key, item.payload, Number(item.captured_at) || 0)
    if (saved) artifacts += 1
  } catch {
    // Tombstoned sessions cannot take artifacts; skip and keep going.
  }
}
setFreeStoreClockForTests(null)
console.log(JSON.stringify({
  ok: true,
  userId,
  sessions: rows.length,
  active: rows.filter(r => !r.deleted_at).length,
  artifacts,
}, null, 2))
