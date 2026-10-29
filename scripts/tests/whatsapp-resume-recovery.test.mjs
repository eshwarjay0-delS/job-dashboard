import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptableWhatsAppResume } from '../../src/lib/whatsapp-resume-acceptance.ts'
import { resumeQuality } from '../../src/lib/resume-quality.ts'

const draft = (overrides = {}) => ({
  token: 't-1', diff: [{ section: 'Experience', before: 'Old', after: 'New' }],
  quality: resumeQuality({ matched: 98, total: 100, missing: ['unverified requirement'] }),
  supported_coverage: 98, coverage: 60, partial: undefined,
  skills_only: false, unchanged: false, ...overrides,
})

const scenarios = [
  ['98% evidenced skills, 60% overall JD: honest incomplete match is eligible', draft(), true],
  ['95% evidenced skills with explicit unsupported gaps is eligible', draft({ supported_coverage: 95, quality: resumeQuality({ matched: 95, total: 100, missing: ['gap'] }) }), true],
  ['94.9% evidenced skills must not be delivered', draft({ supported_coverage: 94.9 }), false],
  ['90% evidenced skills must not be delivered', draft({ supported_coverage: 90 }), false],
  ['partial experience rewrite must not be delivered', draft({ partial: { failed: 1, total: 5 } }), false],
  ['quality report with incomplete role alignment must not be delivered', draft({ quality: resumeQuality({ matched: 100, total: 100, missing: [], partial: true }) }), false],
  ['skills-only floor must not be delivered', draft({ skills_only: true }), false],
  ['unchanged original must not be delivered', draft({ unchanged: true }), false],
  ['no changed lines must not be delivered', draft({ diff: [] }), false],
  ['no stored document token must not be delivered', draft({ token: '' }), false],
  ['missing supported coverage must not be interpreted as full match', draft({ supported_coverage: undefined }), false],
  ['NaN coverage must not pass', draft({ supported_coverage: Number.NaN }), false],
  ['zero evidence requirements must not count as a 100% match', draft({ supported_coverage: 100, quality: resumeQuality({ matched: 0, total: 0, missing: [] }) }), false],
  ['below-floor quality status must not be overridden by a percentage', draft({ supported_coverage: 100, quality: resumeQuality({ matched: 80, total: 100, missing: ['gap'] }) }), false],
  ['a completed 100% evidenced rewrite is eligible', draft({ supported_coverage: 100, quality: resumeQuality({ matched: 10, total: 10, missing: [] }) }), true],
]
for (const [name, result, expected] of scenarios) {
  test('WhatsApp quality regression: ' + name, () => {
    assert.equal(acceptableWhatsAppResume(result), expected)
  })
}
