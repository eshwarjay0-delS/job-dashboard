import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptableWhatsAppResume } from '../../src/lib/whatsapp-resume-acceptance.ts'
import { resumeQuality } from '../../src/lib/resume-quality.ts'
import { retryDelayMs } from '../../src/lib/whatsapp-retry-policy.ts'
import { resolveRecoveryResumeContext } from '../../src/lib/whatsapp-resume-recovery-path.ts'

const draft = (overrides = {}) => ({
  token: 't-1', diff: [{ section: 'Experience', before: 'Old', after: 'New' }],
  quality: resumeQuality({ matched: 98, total: 100, missing: ['unverified requirement'] }),
  supported_coverage: 98, coverage: 60, partial: undefined,
  skills_only: false, unchanged: false,
  // Acceptance contract (Nov 4 ATS gate): a result without a passing ATS parse
  // check is held, so eligible fixtures carry a passing check.
  ats: { score: 100, passed: true, checks: [], issues: [] },
  ...overrides,
})

const scenarios = [
  ['60% of the job post is not delivered', draft(), false],
  ['95% of the job post with one named gap is eligible', draft({ coverage: 95, supported_coverage: 95, quality: resumeQuality({ matched: 95, total: 100, missing: ['gap'] }) }), true],
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
  ['a completed rewrite at 100% of the job post is eligible', draft({ coverage: 100, supported_coverage: 100, quality: resumeQuality({ matched: 10, total: 10, missing: [] }) }), true],
]
for (const [name, result, expected] of scenarios) {
  test('WhatsApp quality regression: ' + name, () => {
    assert.equal(acceptableWhatsAppResume(result), expected)
  })
}


const recoveryRoots = {
  userId: 'user-1',
  userResumesRoot: '/tmp/mf/user-resumes',
  inboxRoot: '/tmp/mf/whatsapp/inbox/123',
}
test('an uploaded source recovered from Files is tailored against the current user library root', () => {
  const resumePath = '/tmp/mf/user-resumes/user-1/eshwarjay05@gmail.com/General/Eshwar_Resume.docx'
  const context = resolveRecoveryResumeContext({ ...recoveryRoots, resumePath })
  assert.deepEqual(context, {
    ok: true, location: 'library',
    userResumeDir: '/tmp/mf/user-resumes/user-1',
    files: undefined,
  })
})
test('a stale serialized Files root is replaced by the current account root', () => {
  const resumePath = '/tmp/mf/user-resumes/user-1/eshwarjay05@gmail.com/General/Eshwar_Resume.docx'
  const context = resolveRecoveryResumeContext({
    ...recoveryRoots,
    resumePath,
    files: {
      userDir: '/tmp/old-user-root',
      email: 'eshwarjay05@gmail.com',
      said: 'the selected resume',
      depth: 0,
      rel: 'old/resume.docx',
      abs: '/tmp/old-user-root/old/resume.docx',
    },
  })
  assert.equal(context.ok, true)
  if (!context.ok) return
  assert.equal(context.userResumeDir, '/tmp/mf/user-resumes/user-1')
  assert.equal(context.files?.userDir, context.userResumeDir)
  assert.equal(context.files?.abs, resumePath)
  assert.equal(context.files?.rel, 'eshwarjay05@gmail.com/General/Eshwar_Resume.docx')
  assert.equal(context.files?.depth, 2)
})
test('recovery rejects a different email folder, sibling account and arbitrary path', () => {
  const wrongEmail = resolveRecoveryResumeContext({
    ...recoveryRoots,
    resumePath: '/tmp/mf/user-resumes/user-1/other@example.com/General/Resume.docx',
    files: { userDir: '/tmp/mf/user-resumes/user-1', email: 'eshwarjay05@gmail.com', said: 'resume', depth: 2, rel: '', abs: '' },
  })
  const sibling = resolveRecoveryResumeContext({
    ...recoveryRoots,
    resumePath: '/tmp/mf/user-resumes/user-10/eshwarjay05@gmail.com/General/Resume.docx',
  })
  const arbitrary = resolveRecoveryResumeContext({
    ...recoveryRoots,
    resumePath: '/tmp/mf/other-account/Resume.docx',
  })
  assert.deepEqual(wrongEmail, { ok: false })
  assert.deepEqual(sibling, { ok: false })
  assert.deepEqual(arbitrary, { ok: false })
})
test('an inbox source remains in its sender inbox and cannot carry stale Files metadata', () => {
  const resumePath = '/tmp/mf/whatsapp/inbox/123/upload.docx'
  const context = resolveRecoveryResumeContext({ ...recoveryRoots, resumePath })
  assert.deepEqual(context, {
    ok: true, location: 'inbox',
    userResumeDir: '/tmp/mf/whatsapp/inbox/123',
  })
  const staleFiles = resolveRecoveryResumeContext({
    ...recoveryRoots,
    resumePath,
    files: { userDir: '/tmp/mf/user-resumes/user-1', email: 'eshwarjay05@gmail.com', said: 'resume', depth: 2, rel: '', abs: '' },
  })
  assert.deepEqual(staleFiles, { ok: false })
})

const retrySchedule = [300000, 600000, 1200000, 2400000, 4800000, 9600000, 19200000, 21600000, 21600000, 21600000]
for (let i = 0; i < retrySchedule.length; i++) {
  test('WhatsApp recovery backoff attempt ' + (i + 1), () => {
    assert.equal(retryDelayMs(i + 1), retrySchedule[i])
  })
}
