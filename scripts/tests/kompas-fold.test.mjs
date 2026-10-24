import test from 'node:test'
import assert from 'node:assert/strict'
import { desktopQuestionKind, desktopResponsePolicy } from '../../src/lib/kompasDesktopResponse.ts'
const prompts = [
 ['What is CSRF?', 'definition'],
 ['Compare IDOR versus CSRF.', 'comparison'],
 ['How have you managed a security incident?', 'experience'],
 ['Walk me through an incident you handled.', 'experience'],
 ['How would you configure endpoint controls?', 'implementation'],
]
const variants = [s => s, s => s.toUpperCase(), s => '  '+s+'  ', s => s.replaceAll(' ', '  '), s => s.replaceAll(' ', '\n'), s => s.replaceAll(' ', '\t')]
const count = Number(process.env.KOMPAS_FOLD_CASES || 30)
for (let i=0;i<count;i++) {
 const [original, kind] = prompts[i%5]
 const question = variants[Math.floor(i/5)](original)
 test(`case ${i+1}: ${kind}, input form ${Math.floor(i/5)+1}`, () => {
  assert.equal(desktopQuestionKind(question), kind)
  for (const level of ['engineer','architect','director']) {
   const p = desktopResponsePolicy(level, question)
   assert.equal(p.kind, kind)
   assert.equal(p.level, level)
   if (kind === 'definition' || kind === 'comparison') assert.ok(p.words <= 120)
   if (kind === 'experience') assert.match(p.guidance, /Use only supplied facts and metrics/)
  }
 })
}
