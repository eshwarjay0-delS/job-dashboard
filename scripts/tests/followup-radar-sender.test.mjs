import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { emailAddress } from '../../src/lib/application-evidence.ts'
const route = readFileSync(new URL('../../src/app/api/gmail/followup-radar/route.ts', import.meta.url), 'utf8')
const expression = route.match(/const outbound = (.+)/)[1]
const outbound = new Function('emailAddress', 'latest', 'own', `return ${expression}`)
test('radar recognizes only the exact parsed outbound mailbox', () => {
 for (const from of ['me@example.com', 'Me <ME@example.com>']) assert.equal(outbound(emailAddress,{from},'me@example.com'),true)
 for (const from of ['notme@example.com','me@example.com.attacker.test','"me@example.com" <other@example.com>','"Contact <me@example.com>" <other@example.com>','']) assert.equal(outbound(emailAddress,{from},'me@example.com'),false)
})
test('radar recipient lookup also uses exact parsed mailbox equality', () => {
 assert.match(route,/emailAddress\(t\.messages\[i\]\.from\) !== own/)
 assert.doesNotMatch(route,/includes\(own\)/)
})
test('quoted display names cannot supply an account mailbox',()=>{
 assert.equal(emailAddress('"Contact <me@example.com>" <other@example.com>'),'other@example.com')
 assert.equal(emailAddress('"Contact \\"alias\\" <me@example.com>" <other@example.com>'),'other@example.com')
 assert.equal(emailAddress('"me@example.com"'),'')
 assert.equal(emailAddress('First <me@example.com>, Other <other@example.com>'),'')
 assert.equal(emailAddress('"Example Person" <ME@example.com>'),'me@example.com')
})
