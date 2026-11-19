import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const FIXTURES = [
  'whatsapp-5fold.test.mjs',
  'whatsapp-resume-failsafe.test.mjs',
  'whatsapp-single-request.test.mjs',
  'whatsapp-library.test.mjs',
  'whatsapp-recovery-durability.test.mjs',
  'whatsapp-resume-acceptance.test.mjs',
  'whatsapp-resume-contract.test.mjs',
  'whatsapp-tailor-rounds.test.mjs',
]
const SYNTHETIC_NAMES = new Set(['Candidate', 'Candidate One', 'Candidate Two'])
const RESERVED_TEST_USER_ID = '00000000-0000-4000-8000-000000000001'

for (const file of FIXTURES) {
  test(file + ' contains only reserved synthetic identity and contact data', () => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    const scanSource = source.replace(/\\n/g, '\n').replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/ig, '')
    const emails = scanSource.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) ?? []
    const phones = scanSource.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) ?? []
    const identityNames = [...source.matchAll(/(?:firstName|lastName|fullName|candidateName|displayName)\s*:\s*['"]([^'"]+)['"]/g)].map(match => match[1])
    const resumeHeaderNames = [...source.matchAll(/const\s+(?:HOUSTON|SAINT_LOUIS|src|IDENTITY)\s*=\s*['"](Candidate(?: One| Two)?)(?:\\n|\\)/g)].map(match => match[1])
    const outputNames = [...source.matchAll(/outputNameFor:\s*async\s*\(\)\s*=>\s*['"]([^'"]+)['"]/g)].map(match => match[1])
    const whatsappRecipients = [...source.matchAll(/(?:generate|sendText|sendDocument)\(\s*['"](\d{7,15})['"]/g)].map(match => match[1])

    assert.doesNotMatch(source, /\b(?:Eshwar|Ishu|Janjirala|Jyothishwar)\b/i, file + ' must not contain owner or personal fixture names')
    assert.doesNotMatch(source, /(?:J_Eshwar_44|Eshwar_44|Ishu_44)/i, file + ' must not contain personal account paths')
    assert.ok(
      emails.every(email => /^candidate\d+@example\.test$/i.test(email)),
      file + ' must use only candidateN@example.test addresses',
    )
    assert.ok(
      phones.every(phone => /^55501\d{2}$/.test(phone.replace(/\D/g, '').slice(-7))),
      file + ' must use only reserved fictional 555-0100 through 555-0199 numbers',
    )
    assert.ok(
      identityNames.every(name => SYNTHETIC_NAMES.has(name)),
      file + ' must use only the reserved synthetic identity names',
    )
    assert.ok(
      resumeHeaderNames.every(name => SYNTHETIC_NAMES.has(name)),
      file + ' resume text must use only reserved synthetic candidate names',
    )
    assert.ok(
      outputNames.every(name => /^Candidate(?:_Resume)?\.docx$/i.test(name)),
      file + ' must not contain a personal name in an exported test filename',
    )
    assert.ok(
      whatsappRecipients.every(phone => /^1?55501\d{2}$/.test(phone)),
      file + ' WhatsApp recipient fixtures must use the reserved fictional 555-0100 through 555-0199 range',
    )

    if (source.includes('TEST_USER_ID')) {
      const userId = source.match(/const TEST_USER_ID = ['"]([^'"]+)['"]/)?.[1]
      const userRoot = source.match(/const TEST_USER_ROOT = \x60([^\x60]+)\x60/)?.[1]
      const accountFolders = [...source.matchAll(/const\s+\w+_PATH\s*=\s*\x60\$\{TEST_USER_ROOT\}\/([^/\x60]+)\//g)].map(match => match[1])

      assert.equal(userId, RESERVED_TEST_USER_ID, file + ' must use the reserved synthetic test user UUID')
      assert.equal(userRoot, '/data/user-resumes/$' + '{TEST_USER_ID}', file + ' must use the generic test-only resume root')
      assert.ok(accountFolders.length > 0, file + ' must exercise explicit account-scoped paths')
      assert.ok(
        accountFolders.every(folder => /^candidate\d+@example\.test$/i.test(folder)),
        file + ' account path segments must be synthetic candidate inboxes, not personal accounts',
      )
    }
  })
}
