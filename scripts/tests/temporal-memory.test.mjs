import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../../src/lib/memory/retrieval.ts", import.meta.url), "utf8");

test("memory resolver is model independent and contains retrieval time resolution", () => {
  assert.match(source, /classifyMemoryIntent/);
  assert.match(source, /resolveVersionedMemory/);
  assert.match(source, /reciprocalRankFusion/);
  assert.match(source, /requireConstraints: true/);
});

test("memory schema preserves temporal and multimodal provenance", () => {
  const sql = fs.readFileSync(new URL("../../supabase/migrations/20261004_temporal_memory.sql", import.meta.url), "utf8");
  for (const required of ["memory_events","memory_claims","memory_constraints","memory_edges","memory_consolidations","asset_locator","valid_from","supersedes_claim_id"]) {
    assert.ok(sql.includes(required), required);
  }
  assert.match(sql, /enable row level security/g);
});

test("derived memory is not writable by authenticated browser clients", () => {
  const sql = fs.readFileSync(new URL("../../supabase/migrations/20261004_temporal_memory.sql", import.meta.url), "utf8");
  assert.match(sql, /revoke insert,update,delete on public\.memory_claims/);
});
