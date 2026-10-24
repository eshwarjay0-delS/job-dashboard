import test from 'node:test'
import assert from 'node:assert/strict'
import { desktopQuestionKind, desktopResponsePolicy } from '../../src/lib/kompasDesktopResponse.ts'

// Ten questions recovered from the owner-provided MHT. No private resume,
// recruiter contact details, or unsupported model answers are stored here.
const cases = [
 ['How do you conduct an end-to-end cybersecurity risk assessment and map findings to NIST CSF and NIST 800-53?', 'implementation'],
 ['How have you managed GRC, compliance audits, risk registers, and remediation tracking in enterprise environments?', 'experience'],
 ['Walk me through a critical security incident you handled, from initial detection through containment and recovery.', 'experience'],
 ['How do you integrate Splunk, Microsoft Sentinel, and Google SecOps to improve threat detection and incident response?', 'implementation'],
 ['How do you investigate endpoint threats using CrowdStrike Falcon and Microsoft Defender for Endpoint?', 'implementation'],
 ['How do you assess and secure AWS, Azure, and GCP environments while maintaining regulatory compliance?', 'implementation'],
 ['How do you prioritize critical vulnerabilities when business operations prevent immediate remediation?', 'implementation'],
 ['How have you applied MITRE ATT&CK and the Cyber Kill Chain to threat hunting, incident investigation, and detection engineering?', 'experience'],
 ['How do you evaluate firewall policies, IDS/IPS, network segmentation, and email security controls during security assessments?', 'implementation'],
 ['How do you communicate critical security risks, justify remediation priorities, and demonstrate compliance improvements to senior leadership?', 'implementation'],
]
test('experience repair preserves concept and hypothetical walkthrough boundaries', () => {
 assert.equal(desktopQuestionKind('Walk me through what CSRF is.'), 'general')
 assert.equal(desktopQuestionKind('Compare IDOR versus CSRF.'), 'comparison')
 assert.equal(desktopQuestionKind('How would you handle an incident?'), 'implementation')
})
for (const [index, [question, expected]] of cases.entries()) {
 for (const level of ['engineer', 'architect', 'director']) {
  test(`MHT question ${index + 1}, ${level}: preserve requested ${expected} depth`, () => {
   const policy = desktopResponsePolicy(level, question)
   assert.equal(desktopQuestionKind(question), expected)
   assert.equal(policy.kind, expected)
   assert.equal(policy.level, level)
   assert.ok(policy.words >= 180, 'a scoped practical question must not receive the 70–90 word general-answer cap')
   assert.doesNotMatch(policy.guidance, /This is a general\.|This is an ordinary question/)
   if (expected === 'experience') {
    assert.match(policy.guidance, /Use only supplied facts and metrics/)
    assert.match(policy.guidance, /If the incident is absent/)
   }
   if (level === 'architect') assert.match(policy.guidance, /bit by bit/)
   if (level === 'director') assert.match(policy.guidance, /business|operational/)
  })
 }
}
