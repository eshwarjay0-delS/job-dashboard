import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const FIXTURES = [
  'whatsapp-5fold.test.mjs',
  'whatsapp-resume-failsafe.test.mjs',
  'whatsapp-single-request.test.mjs',
]

for (const file of FIXTURES) {
  test(`${file} uses synthetic email and reserved fictional phone data`, () => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    const emails = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/ig) ?? []
    const phones = source.match(/(?:\\+?1[\\s.-]?)?\\(?\\d{3}\\)?[\\s.-]\\d{3}[\\s.-]\\d{4}/g) ?? []

    assert.ok(
      emails.every(email => /@example\\.test$/i.test(email)),
      `${file} must not contain a real or non-reserved email address`,
    )
    assert.ok(
      phones.every(phone => /^55501\\d{2}$/.test(phone.replace(/\\D/g, '').slice(-7))),
      `${file} must use only the reserved fictional 555-0100 through 555-0199 range`,
    )
  })
}
