// Different questions must not be rewritten as the previous one.
// Measured before this change, with the previous ask "What is NLA and why do we disable it?":
// three new questions were glued onto it (least privilege, residual risk, session recording)
// and "Explain that" was dropped, so the previous answer stayed on screen.
// Gain: those four no longer collapse. Real follow-ups still attach.
import test from 'node:test'
import assert from 'node:assert/strict'
import { questionForAnswer, differentQuestionLine } from '../../src/lib/kompasAnswer.ts'

const previous = [{ q: 'What is NLA and why do we disable it?', a: 'NLA checks the client before the session starts.' }]
const asks = [
  ['What exactly is least privilege?', false],
  ['What is the meaning of residual risk?', false],
  ['How does certificate validation work?', false],
  ['Go deeper', true],
  ['Explain that', true],
  ['Could you elaborate on session recording?', false],
  ['Walk me through that', true],
  ['What is a policy exception?', false],
  ['Have you configured CyberArk EPM?', false],
  ['Which of those would you start with?', true],
]

function whatsapp(q) {
  return questionForAnswer(q, '', false, false, previous)
}
function desktop(q) {
  return questionForAnswer('You: ' + q, '', false, false, previous)
}
function screen(q) {
  return questionForAnswer('Question 4 (technical): ' + q, q, true, false, previous)
}

for (let n = 1; n <= asks.length; n++) {
  test('distinct question fold ' + String(n).padStart(2, '0') + ' keeps every earlier ask apart', () => {
    const seen = new Set()
    let collapsed = 0
    for (const [question, follow] of asks.slice(0, n)) {
      const phone = whatsapp(question)
      const desk = desktop(question)
      const shown = screen(question)
      assert.ok(phone, question)
      assert.equal(desk, phone, question)
      assert.equal(shown.toLowerCase().includes('following up on'), follow, question)
      assert.equal(phone.toLowerCase().includes('following up on'), follow, question)
      if (!follow) {
        assert.equal(phone.toLowerCase().includes('nla'), false, question)
        assert.equal(differentQuestionLine(phone, previous).includes('DIFFERENT QUESTION'), true, question)
      } else {
        assert.match(phone, /What is NLA and why do we disable it/, question)
        assert.equal(differentQuestionLine(phone, previous), '')
      }
      if (phone.toLowerCase().includes('nla') && !follow) collapsed++
      seen.add(phone.toLowerCase())
    }
    assert.equal(collapsed, 0)
    assert.equal(seen.size, n)
  })
}

test('words before the next question are not answered as the previous ask', () => {
  const heard = 'Moving to the next question, what exactly is least privilege?'
  const cut = questionForAnswer(heard, '', false, false, previous)
  assert.match(cut, /least privilege/i)
  assert.equal(/nla/i.test(cut), false)
})
