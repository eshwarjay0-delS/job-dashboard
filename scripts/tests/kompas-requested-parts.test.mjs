// What a question asks for, read before anything is answered (owner, 25 Oct 2026: understand the question, its
// granularity and every expected part). Measured 26 Oct on production: listed parts were lost, a bare abbreviation
// was answered as a vague 70-word "general" turn, and "a vulnerability you personally discovered" got 70 words and
// "do not open a project story".
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const A = await import('../../src/lib/kompasAnswer.ts')
const R = await import('../../src/lib/kompasDesktopResponse.ts')

test('a listed ask becomes one part per item, in order, and its conditions are kept apart', () => {
  const design = A.requestedParts('Design Splunk and Sentinel ingestion with identity correlation. Explain trust boundaries, data flow, failure isolation, rollout and validation.')
  assert.deepEqual(design.parts, ['Design Splunk and Sentinel ingestion with identity correlation', 'Explain trust boundaries', 'Explain data flow', 'Explain failure isolation', 'Explain rollout', 'Explain validation'])
  const director = A.requestedParts('Now explain the same incident to a director: risk acceptance versus remediation. State decision owner, business exposure and measures you would track, without inventing achieved numbers.')
  assert.deepEqual(director.parts, ['explain the same incident to a director: risk acceptance versus remediation', 'State decision owner', 'State business exposure', 'State measures you would track'])
  assert.deepEqual(director.constraints, ['without inventing achieved numbers'])
  const recursive = A.requestedParts('Go deeper on that failure. What if the first mitigation fails and telemetry is incomplete? Give a falsifiable test and an exit criterion.')
  assert.deepEqual(recursive.parts, ['Go deeper on that failure', 'What if the first mitigation fails and telemetry is incomplete?', 'Give a falsifiable test', 'Give an exit criterion'])
  const compound = A.requestedParts('Define IDOR, explain why it matters, and give one mitigation.')
  assert.deepEqual(compound.parts, ['Define IDOR', 'explain why it matters', 'give one mitigation'])
  const definition = A.requestedParts('Define NIST CSF risk assessments. Keep it suitable for technical HR.')
  assert.deepEqual(definition, { parts: ['Define NIST CSF risk assessments'], constraints: ['Keep it suitable for technical HR'] })
})

test('setup sentences are context, a single ask stays one part, and "and" inside a name is not a split', () => {
  assert.deepEqual(A.requestedParts('A permission fix passes unit tests but fails for one tenant. How would you diagnose it?').parts, ['How would you diagnose it?'])
  assert.deepEqual(A.requestedParts('Compare IDOR and CSRF.').parts, ['Compare IDOR and CSRF'])
  assert.deepEqual(A.requestedParts('Design tenant isolation for an API and explain failure handling.').parts, ['Design tenant isolation for an API', 'explain failure handling'])
  assert.deepEqual(A.requestedParts('Walk through diagnosis, competing hypotheses, safe containment and rollback.').parts.length, 4)
})

test('a bare term or abbreviation is asked as "what is it", and only a term is', () => {
  assert.equal(A.canonicalQuestion('IDOR', 2), 'What is IDOR? If it is an abbreviation, say what it stands for first.')
  assert.equal(A.canonicalQuestion('Venafi certificate discovery', 2), 'What is Venafi certificate discovery? If it is an abbreviation, say what it stands for first.')
  for (const q of ['Next question', 'Design a SIEM', 'How do you rotate keys?', 'Continue', 'Intro']) assert.equal(A.canonicalQuestion(q, 2), q, q)
  assert.equal(A.canonicalQuestion('Intro', 0), 'Tell me about yourself')
  assert.equal(R.desktopQuestionKind(A.canonicalQuestion('IDOR', 2)), 'definition')
})

test('the candidate\'s own discovery and own incident are experience, a hypothetical stays implementation', () => {
  assert.equal(R.desktopQuestionKind('Describe a vulnerability you personally discovered and the impact.'), 'experience')
  assert.equal(R.desktopQuestionKind('In that same incident, why did your first mitigation fail?'), 'experience')
  assert.equal(R.desktopQuestionKind('Go deeper on that failure. What if the first mitigation fails and telemetry is incomplete? Give a falsifiable test and an exit criterion.'), 'implementation')
  assert.equal(R.desktopQuestionKind('Now explain the same incident to a director: risk acceptance versus remediation. State decision owner, business exposure and measures you would track, without inventing achieved numbers.'), 'implementation')
})

test('the route puts the parts checklist right under the question, for every tier but an introduction', () => {
  const route = readFileSync(new URL('../../src/lib/kompasAnswerService.ts', import.meta.url), 'utf8')
  assert.match(route, /const asks = tier !== 0 \? requestedParts\(question\)/)
  assert.match(route, /userText: `ANSWER ONLY THIS:\\n\$\{question\}\\n\\n\$\{partsBlock \?/)
})
