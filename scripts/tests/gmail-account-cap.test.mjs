import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const migrations = path.join(root, 'supabase', 'migrations')
const files = readdirSync(migrations).filter(name => name.toLowerCase().endsWith('.sql')).sort()
const definition = /create\s+or\s+replace\s+function\s+public\.identity_list_google_workspace_accounts\s*\([\s\S]*?\)\s*returns[\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$;/gi
const definitions = []

for (const file of files) {
  const sql = readFileSync(path.join(migrations, file), 'utf8')
  for (const match of sql.matchAll(definition)) {
    definitions.push({ file, body: match[1], index: match.index ?? -1 })
  }
}

test('latest Google Workspace account-list migration preserves the approved four-account ceiling', () => {
  assert.ok(definitions.length > 0, 'a migration must define identity_list_google_workspace_accounts')
  const latest = definitions.at(-1)
  assert.match(latest.body, /order\s+by\s+a\.is_primary\s+desc\s*,\s*a\.connected_at\s+asc/i,
    `primary account and stable connection order must remain explicit in ${latest.file}`)
  assert.match(latest.body, /\blimit\s+4\b/i,
    `the latest account-list definition must keep LIMIT 4; no-cap removal is not approved (${latest.file})`)
  assert.doesNotMatch(latest.body, /\blimit\s+(?:[5-9]|[1-9]\d+)\b/i,
    `the account-list ceiling must not silently increase in ${latest.file}`)
})
