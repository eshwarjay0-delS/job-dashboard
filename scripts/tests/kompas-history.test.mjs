import test from 'node:test'
import assert from 'node:assert/strict'
import { formatInterviewHistory, HISTORY_MAX_CHARS } from '../../src/lib/kompasHistory.ts'

test('retains full ordinary compound questions and closing mitigation details', () => {
 const q = 'Explain the incident. ' + 'Consider ownership and evidence. '.repeat(15) + 'When would you reverse the change?'
 const a = 'I tested the mitigation. ' + 'Evidence and reasoning. '.repeat(100) + 'The rollback criterion was renewed cross-tenant access.'
 assert.equal(formatInterviewHistory([{ q, a }]), `Q: ${q}\nA: ${a}`)
})
test('preserves four turns chronologically and supports all existing aliases', () => {
 const history = [{ question: 'Q1', answer: 'A1' }, { q: 'Q2', text: 'A2' }, { q: 'Q3', a: 'A3' }, { q: 'Q4', a: 'A4' }]
 const before = JSON.stringify(history)
 assert.equal(formatInterviewHistory(history), 'Q: Q1\nA: A1\n\nQ: Q2\nA: A2\n\nQ: Q3\nA: A3\n\nQ: Q4\nA: A4')
 assert.equal(JSON.stringify(history), before)
})
test('extreme turns retain opening and closing facts with explicit omission', () => {
 const text = formatInterviewHistory([{ q: 'START_Q' + 'q'.repeat(9000) + 'END_Q', a: 'START_A' + 'a'.repeat(90000) + 'END_A' }])
 for (const marker of ['START_Q', 'END_Q', 'START_A', 'END_A', '[Middle omitted from prior turn]']) assert.ok(text.includes(marker))
 assert.ok(text.length < 8100)
})
test('total budget prioritizes recent turns and marks dropped older context', () => {
 const history = Array.from({ length: 8 }, (_, i) => ({ q: `QUESTION_${i} ` + 'q'.repeat(2200), a: `ANSWER_${i} ` + 'a'.repeat(6500) }))
 const text = formatInterviewHistory(history)
 assert.ok(text.length <= HISTORY_MAX_CHARS)
 assert.ok(text.includes('QUESTION_7'))
 assert.ok(text.includes('QUESTION_6'))
 assert.ok(!text.includes('QUESTION_0'))
 assert.ok(text.startsWith('[Older interview context omitted]'))
 assert.ok(text.indexOf('QUESTION_6') < text.indexOf('QUESTION_7'))
})
test('malformed history never coerces values or emits empty Q/A blocks', () => {
 for (const invalid of [null, undefined, 'text', {}, [null, 3, [], { q: {}, a: false }, {}]]) assert.equal(formatInterviewHistory(invalid), '')
 assert.equal(formatInterviewHistory([{ q: '  question  ', a: 123 }]), 'Q: question\nA: ')
})
