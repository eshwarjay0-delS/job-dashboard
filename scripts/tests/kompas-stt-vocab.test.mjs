import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  vocabFromProfile,
  whisperPromptFromProfile,
  streamingKeyterms,
  streamingKeytermQuery,
  applySttCorrections,
  correctionMapFromProfile,
  profilesAreIsolated,
} from '../../src/lib/kompasSttVocab.ts'
import { streamingKeytermsFor, streamingKeytermQuery as streamQuery } from '../../src/lib/kompasStreamingStt.ts'

const citi = {
  id: 'profile-citi',
  identity: { name: 'Eshwar', employers: ['Citi', 'CVS'], tools: ['Qualys VMDR', 'Tanium', 'Splunk', 'ServiceNow GRC', 'Entra ID'] },
  keywords: ['CISO', 'CAB', 'DMARC'],
}
const other = {
  id: 'profile-other',
  identity: { name: 'Other Candidate', employers: ['Acme Health'], tools: ['QRadar', 'CrowdStrike Falcon'] },
  keywords: ['SOAR'],
}

test('vocab comes only from the active profile; two profiles stay isolated', () => {
  const a = vocabFromProfile(citi)
  const b = vocabFromProfile(other)
  assert.ok(a.includes('Citi') && a.includes('Entra ID') && a.includes('Qualys VMDR'))
  assert.ok(!a.includes('QRadar') && !a.includes('Acme Health'))
  assert.ok(b.includes('QRadar') && b.includes('Acme Health'))
  assert.ok(!b.includes('Citi') && !b.includes('Entra ID') && !b.includes('Qualys VMDR'))
  assert.equal(profilesAreIsolated(citi, other), true)
  const prompt = whisperPromptFromProfile(citi)
  assert.match(prompt, /Citi/)
  assert.doesNotMatch(prompt, /QRadar/)
  assert.doesNotMatch(whisperPromptFromProfile(other), /Citi/)
})

test('corrections such as enter a ID run only when the term is in the active profile', () => {
  assert.equal(applySttCorrections('we joined enter a ID yesterday', citi), 'we joined Entra ID yesterday')
  assert.equal(applySttCorrections('we joined enter a ID yesterday', other), 'we joined enter a ID yesterday')
  assert.ok(correctionMapFromProfile(citi).some((p) => p.term === 'Entra ID'))
  assert.ok(!correctionMapFromProfile(other).some((p) => p.term === 'Entra ID'))
  const keys = streamingKeyterms(citi)
  assert.ok(keys.includes('Tanium'))
  const q = streamingKeytermQuery(keys)
  assert.match(q, /keyterm=/)
  assert.deepEqual(streamingKeytermsFor(keys), keys)
  assert.ok(streamQuery(keys).includes('keyterm='))
})

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
test('live whisper prompt uses the active profile only, not a hardcoded second-employer core', () => {
  assert.match(app, /sttVocabFromActiveProfile\(/)
  const body = app.slice(app.indexOf('function whisperPrompt(opt)'), app.indexOf('function dictationRetry'))
  assert.doesNotMatch(body, /Fifth Third/)
  assert.doesNotMatch(body, /Gemalto/)
  assert.match(app, /session\.keyterms/)
})
