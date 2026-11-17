import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validUpdatePreferences } from '../../src/lib/mail-update-policy.ts'

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8')

test('mobile preferences accept multiple inboxes while preserving duplicate and email validation', () => {
  const accounts = Array.from({ length: 12 }, (_, i) => `inbox${i + 1}@example.com`)
  const base = { enabled: true, mobile: true, ending: '1234', accounts, onlyImportant: true, since: Date.now() - 1000 }
  assert.equal(validUpdatePreferences(base), true)
  assert.equal(validUpdatePreferences({ ...base, accounts: [...accounts, accounts[0]] }), false)
  assert.equal(validUpdatePreferences({ ...base, accounts: ['../../other-user'] }), false)
})

test('the migration removes only the account-count ceiling and retains owner/security boundaries', () => {
  const migration = read('supabase/migrations/20261117125100_google_workspace_no_account_cap.sql')
  const attachStart = migration.indexOf('create or replace function public.identity_attach_google_workspace_account')
  const listStart = migration.indexOf('create or replace function public.identity_list_google_workspace_accounts')
  const revokeStart = migration.indexOf('revoke all on function')
  assert.ok(attachStart >= 0 && listStart > attachStart && revokeStart > listStart)
  const attach = migration.slice(attachStart, listStart)
  const list = migration.slice(listStart, revokeStart)
  assert.match(attach, /security definer/)
  assert.match(attach, /set search_path = pg_catalog, public, private/)
  assert.match(attach, /v_owner is not null and v_owner <> p_user_id/)
  assert.match(attach, /insert into public\.identity_audit/)
  assert.doesNotMatch(attach, /v_count|>=\s*4|up to 4/i)
  assert.match(list, /where a\.user_id=p_user_id and a\.revoked_at is null/)
  assert.doesNotMatch(list, /limit\s+4/i)
  assert.match(migration, /revoke all on function public\.identity_attach_google_workspace_account[\s\S]*from public,anon,authenticated/)
  assert.match(migration, /grant execute on function public\.identity_attach_google_workspace_account[\s\S]*to service_role/)
})

test('API and UI do not advertise or enforce a four-account product cap', () => {
  const accountRoute = read('src/app/api/identity/google-workspace/accounts/route.ts')
  const statusRoute = read('src/app/api/connections/status/route.ts')
  const syncRoute = read('src/app/api/gmail-sync/route.ts')
  const callback = read('src/app/api/identity/google-workspace/callback/route.ts')
  const chatCard = read('src/app/dashboard/copilot/ChatIntegrationsCard.tsx')
  const connections = read('src/app/dashboard/connections/ConnectionsClient.tsx')
  const policy = read('src/lib/mail-update-policy.ts')
  for (const source of [accountRoute,statusRoute,syncRoute]) assert.doesNotMatch(source,/maxAccounts\s*:\s*4|accounts?\.length\s*<\s*4/)
  assert.doesNotMatch(callback,/up to 4/i)
  assert.doesNotMatch(chatCard,/maxAccounts|accounts\.length\s*<\s*max/)
  assert.doesNotMatch(connections,/maxAccounts|slots? left|of \$\{status\.google\./i)
  assert.doesNotMatch(policy,/accounts\.length\s*<=\s*4/)
  assert.match(accountRoute,/canAdd:\s*loaded\.source === "supabase"/)
  assert.match(statusRoute,/canAdd:\s*loaded\.source === "supabase"/)
})

test('product direction records that removing the four-account ceiling needs direct owner confirmation', () => {
  const direction = read('PRODUCT_DIRECTION.md')
  const gmailVision = read('docs/gmail.md')
  assert.match(direction,/pending direct owner confirmation/i)
  assert.match(gmailVision,/pending direct owner confirmation/i)
})
