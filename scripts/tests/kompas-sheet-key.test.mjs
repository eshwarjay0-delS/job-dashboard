// Exact sheet key. A near miss is not a match, and the page uses the same key.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { sheetTopicMatch } from "../../src/lib/kompasSheetMatch.ts"

const NEGATIVE = [
  ["What is authorization?", "How would you test whether authorization is enforced consistently across both UI and API layers?"],
  ["How would you handle a manual security scanner outage without stopping every deployment?", "How do you tune a noisy scanner without hiding a real attack?"],
  ["What is a log aggregator or syslog relay and when would you use one?", "Tell me about a time you rolled out one-time passwords."],
  ["What is syslog?", "How do you secure remote access for privileged users?"],
  ["What is the difference between SAST and DAST?", "Have you used SAST and DAST tools?"],
  ["How does the IAM lifecycle work for a joiner, mover, and leaver?", "How do you secure remote access for privileged users?"],
  ["Walk me through your incident response steps after a phishing email.", "Walk me through SailPoint joiner mover leaver."],
  ["What is third-party risk management and how do you assess a vendor?", "How do you map controls to NIST and ISO?"],
  ["Why do you want this role?", "Why are you leaving your current role?"],
  ["What is a compensating control?", "How do you map controls to NIST and ISO?"],
  ["Explain zero trust in one minute.", "How would you investigate a failed privileged session in CyberArk?"],
  ["When would you use MFA instead of a one-time password?", "Tell me about a time you rolled out one-time passwords."],
  ["What is the difference between a vulnerability and a threat?", "What is your experience with Qualys?"],
  ["What is a SOC and what does an analyst do on shift?", "Tell me about yourself."],
  ["How would you respond if ransomware encrypted a file share?", "Tell me about a phishing incident you handled."],
  ["What is least privilege?", "How do you secure remote access for privileged users?"],
  ["How do you write a risk acceptance?", "How do you secure remote access for privileged users?"],
  ["How do you separate duties in an IAM tool?", "Have you used SAST and DAST tools?"],
  ["What logs would you check first for an impossible-travel alert?", "How do you secure remote access for privileged users?"],
  ["How do you onboard a new log source?", "Tell me about a time you rolled out one-time passwords."],
  ["What is privileged access management?", "What is syslog?"],
  ["How would you implement security controls in a CI/CD pipeline without allowing developers to bypass them?", "How would you handle a manual security scanner outage?"],
  ["How would you identify malicious or compromised third-party packages entering the CI pipeline?", "How would you tune a noisy SIEM rule?"],
  ["How would you monitor suspicious package activity and coordinate incident response?", "What is a SOC and what does an analyst do on shift?"],
  ["Can you explain the difference between authentication, authorization, and access control?", "What is authorization?"],
  ["How would you test whether authorization is enforced consistently across both UI and API layers?", "What is authentication?"],
  ["Let's say a critical vulnerability is reported in a shared Java library. How would you determine which applications are affected and prioritize remediation?", "What is your experience with Qualys?"],
  ["Security identifies a critical vulnerability, but the development team disputes the finding. How would you organize the technical review?", "Tell me about a time you handled a difficult stakeholder."],
  ["What is SAST?", "What is DAST?"],
  ["What is DAST?", "What is the difference between SAST and DAST?"],
  ["How do you tune a noisy SIEM rule?", "How did you onboard log sources into Splunk?"],
  ["What is a one-time password?", "When would you use MFA instead of a one-time password?"],
  ["How do you map a control to NIST CSF and ISO 27001?", "What is third-party risk management and how do you assess a vendor?"],
  ["Tell me about a time you handled a difficult stakeholder.", "Tell me about a time something went wrong and what you did."],
  ["How would you respond if ransomware encrypted a file share?", "Walk me through your incident response steps after a phishing email."],
  ["What is syslog?", "What is a log aggregator or syslog relay and when would you use one?"],
  ["Can you walk me through how you configured the syslog relay to the SIEM?", "How did you onboard log sources into Splunk?"],
  ["Explain zero trust in one minute.", "What is least privilege?"],
  ["How do you evidence a control for an auditor?", "How do you write a risk acceptance?"],
  ["What questions do you have for us?", "Tell me about yourself."],
  ["How do you run vulnerability management from scan to exception?", "What is a compensating control?"],
  ["How would you investigate a failed privileged session in CyberArk?", "What is privileged access management?"],
  ["What is the difference between SAST and DAST?", "What is the difference between a vulnerability and a threat?"],
  ["How would you handle a manual security scanner outage?", "How would you identify malicious third-party packages entering the CI pipeline?"],
  ["Tell me about yourself.", "Why do you want this role?"],
  ["How does the IAM lifecycle work for a joiner, mover, and leaver?", "How do you separate duties in an IAM tool?"],
  ["What logs would you check first for an impossible-travel alert?", "How do you tune a noisy SIEM rule?"],
  ["Can you explain your experience with SAST and DAST?", "What is the difference between SAST and DAST?"],
  ["How do you onboard a new log source?", "What is syslog?"],
  ["What is a SOC and what does an analyst do on shift?", "How do you tune a noisy SIEM rule?"],
  ["How would you test authorization across both UI and API layers?", "How would you implement security controls in a CI/CD pipeline?"],
  ["What is MFA?", "What is a one-time password?"],
  ["How do you run a vendor questionnaire?", "How do you map controls to NIST and ISO?"],
]

test("near misses do not reuse a sheet entry", () => {
  assert.ok(NEGATIVE.length >= 50, "need at least 50 near-miss pairs")
  for (const [asked, entry] of NEGATIVE) {
    assert.equal(sheetTopicMatch(asked, entry), false, asked + " <> " + entry)
  }
})

test("the same ask still matches itself", () => {
  for (const q of [
    "What is authorization?",
    "What is the difference between SAST and DAST?",
    "How would you handle a manual security scanner outage?",
    "Tell me about yourself.",
    "Why do you want this role?",
    "Can you walk me through how you configured the syslog relay to the SIEM?",
  ]) assert.equal(sheetTopicMatch(q, q), true, q)
})

test("the page keys a sheet entry the same way", () => {
  const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const start = app.indexOf("const SHEET_INTRO")
  const end = app.indexOf("function bookMatch(")
  const ctx = {}
  vm.createContext(ctx)
  vm.runInContext(app.slice(start, end) + "\nthis.m = sheetTopicMatch;", ctx)
  for (const [asked, entry] of NEGATIVE) assert.equal(ctx.m(asked, entry), false, asked)
  assert.equal(ctx.m("What is syslog?", "What is syslog?"), true)
})
