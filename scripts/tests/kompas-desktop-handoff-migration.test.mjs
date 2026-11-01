import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

// The redeem route assumed claim_kompas_desktop_handoff by name only, and no
// migration defined kompas_desktop_handoffs at all — mint inserted into a
// table that only existed if created out-of-band. This pins the migration
// to the exact contract both routes use. It cannot prove Postgres accepts
// the SQL (no database here); applying it in Supabase is still the live
// proof, followed by a mint/redeem round-trip.
const dir = new URL('../../supabase/migrations/', import.meta.url)
const file = readdirSync(dir).find((f) => f.includes('kompas_desktop_handoffs'))
assert.ok(file, 'a kompas_desktop_handoffs migration exists')
const sql = readFileSync(join(dir.pathname, file), 'utf8')
const mint = readFileSync(new URL('../../src/app/api/kompas/desktop-handoff/route.ts', import.meta.url), 'utf8')
const redeem = readFileSync(new URL('../../src/app/api/kompas/desktop-handoff/redeem/route.ts', import.meta.url), 'utf8')

test('the table carries every column the mint insert sets', () => {
  assert.ok(sql.includes('create table if not exists public.kompas_desktop_handoffs'))
  for (const col of ['ticket_hash', 'user_id', 'payload', 'expires_at']) {
    assert.ok(sql.includes(col), `table defines ${col}`)
    assert.ok(mint.includes(col), `mint sets ${col}`)
  }
  assert.ok(sql.includes("ticket_hash ~ '^[0-9a-f]{64}$'"), 'ticket hash is a sha256 hex digest')
  assert.ok(sql.includes('enable row level security'), 'server-only under RLS')
  assert.ok(sql.includes('revoke all on public.kompas_desktop_handoffs from public, anon, authenticated'))
  assert.ok(sql.includes('grant select, insert, update, delete on public.kompas_desktop_handoffs to service_role'))
})

test('the claim function is atomic, expiry-aware, and returns the payload object', () => {
  assert.ok(sql.includes('create or replace function public.claim_kompas_desktop_handoff(p_ticket_hash text)'))
  assert.ok(sql.includes('returns jsonb'), 'scalar jsonb, not a table — the route reads data.site and data.id off it')
  assert.ok(!sql.includes('returns table'), 'must not return a table')
  assert.ok(sql.includes('security definer'), 'runs as the function owner')
  assert.ok(sql.includes('delete from public.kompas_desktop_handoffs'), 'claim deletes the row')
  assert.ok(sql.includes('returning payload, expires_at into'), 'single-statement claim: concurrent redeems serialize, one wins')
  assert.ok(sql.includes('v_expires > clock_timestamp()'), 'expired tickets return NULL, not the payload')
  assert.ok(sql.includes('revoke all on function public.claim_kompas_desktop_handoff(text) from public, anon, authenticated'))
  assert.ok(sql.includes('grant execute on function public.claim_kompas_desktop_handoff(text) to service_role'))
  assert.ok(redeem.includes('db.rpc("claim_kompas_desktop_handoff", { p_ticket_hash: hash })'), 'redeem calls exactly this function with this arg')
})
