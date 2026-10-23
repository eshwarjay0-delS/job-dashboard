// The three answering levels (owner directive, 22 Oct 2026) and the question
// register: a concept question (define / compare / what-is) is answered
// abstractly at EVERY level; a practice question (his work, a scenario, a deep
// example) takes the level's full depth. Director is no longer the longest
// answer — Architect + Developer is the deep one; Director is the same
// understanding abstracted to decisions, metrics and business outcomes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  answerLevel, questionRegister, levelGuidance, lengthPlan, classify,
} from '../../src/lib/kompasAnswer.ts'

const reg = (q) => questionRegister(q, classify(q).tier)

test('answerLevel: explicit level wins, legacy listeners map to their level', () => {
  assert.equal(answerLevel('director', 'engineer'), 'director')
  assert.equal(answerLevel('architect'), 'architect')
  assert.equal(answerLevel(undefined, 'architect'), 'architect')
  assert.equal(answerLevel('technical_hr'), 'engineer')
  assert.equal(answerLevel('hr'), 'engineer')
  assert.equal(answerLevel('analyst'), 'engineer')
  assert.equal(answerLevel('developer'), 'architect')
  assert.equal(answerLevel('lead'), 'director')
  assert.equal(answerLevel(null, 'supervisor'), 'director')
  assert.equal(answerLevel('nonsense'), 'engineer')
  assert.equal(answerLevel(undefined), 'engineer')
})

test('questionRegister: definitions and comparisons are concept at every level', () => {
  assert.equal(reg('Can you define a DS-specific IDOR vulnerability? What is that?'), 'concept')
  assert.equal(reg('What is the difference between an IDOR and a CSRF?'), 'concept')
  assert.equal(reg('What is a SIEM?'), 'concept')
  assert.equal(reg('How does the TLS handshake work?'), 'concept')
  assert.equal(reg('Explain the difference between symmetric and asymmetric encryption'), 'concept')
  assert.equal(reg('What does SAML stand for?'), 'concept')
})

test('questionRegister: his work, scenarios and deep asks are practice', () => {
  assert.equal(reg('Have you ever discovered a vulnerability? Give me a deep example, the bottlenecks you faced and the business impact.'), 'practice')
  assert.equal(reg('How did you tune Splunk correlation searches for low false positives in a 50k EPS environment?'), 'practice')
  assert.equal(reg('How would you design a detection pipeline for a 10k-endpoint fleet?'), 'practice')
  assert.equal(reg('What tools do you use for vulnerability scanning?'), 'practice')
  assert.equal(reg('Tell me about a time you handled a critical incident'), 'practice')
  assert.equal(reg('Tell me about yourself'), 'practice')
})

test('levelGuidance: concept register caps every level to the abstract', () => {
  for (const lvl of ['engineer', 'architect', 'director']) {
    const g = levelGuidance(lvl, 'concept')
    assert.match(g, /ABSTRACTLY/)
    assert.match(g, /no log sources/i)
    assert.match(g, /definition that becomes a tutorial is a wrong answer/i)
  }
  assert.match(levelGuidance('director', 'concept'), /risk it creates/)
  assert.match(levelGuidance('architect', 'concept'), /no procedure/i)
})

test('levelGuidance: practice register carries each level its own depth', () => {
  assert.match(levelGuidance('architect', 'practice'), /step by step/)
  assert.match(levelGuidance('architect', 'practice'), /built, set up and integrated/)
  assert.match(levelGuidance('director', 'practice'), /metrics that prove them/)
  assert.match(levelGuidance('director', 'practice'), /business consequence/)
  assert.match(levelGuidance('director', 'practice'), /no step-by-step procedure/)
  assert.match(levelGuidance('engineer', 'practice'), /Technical HR screening/)
  assert.match(levelGuidance('engineer', 'practice'), /hypotheses, evidence, research, alternatives and pivots/)
})

test('lengthPlan: director is not the longest level anymore; concept is capped', () => {
  const q = 'How did you design the correlation and tuning approach for the SIEM across a large enterprise environment with trade-offs at scale?'
  const tier = classify(q).tier
  const arch = lengthPlan(tier, q, 'architect', { register: 'practice' })
  const dir = lengthPlan(tier, q, 'director', { register: 'practice' })
  assert.ok(dir.words < arch.words, `director ${dir.words} should be under architect ${arch.words}`)

  const cq = 'What is the difference between symmetric and asymmetric encryption and when would each be used in a large enterprise environment with compliance constraints and trade-offs at scale?'
  const ctier = classify(cq).tier
  assert.equal(questionRegister(cq, ctier), 'concept')
  const capped = lengthPlan(ctier, cq, 'architect', { register: 'concept' })
  const uncapped = lengthPlan(ctier, cq, 'architect', { register: 'practice' })
  assert.ok(capped.words <= 170, `concept words ${capped.words} must be capped at 170`)
  assert.ok(uncapped.words > capped.words, `uncapped ${uncapped.words} should exceed the concept cap`)
})
