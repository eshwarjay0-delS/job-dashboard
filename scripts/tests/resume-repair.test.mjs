import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptImprovingRepairs, mergeIndexedEdits } from '../../src/lib/resume-repair.ts'
const pass = terms => ({ afterKw: new Set(terms), cov: terms.length / 10 })
test('a failed role repair cannot discard skills and other role improvements', async () => {
  const start = pass(['IAM'])
  const edits = [['IAM', 'IGA'], ['PAM'], ['IAM', 'IGA', 'SSO']]
  const result = await acceptImprovingRepairs(start, edits, async (_, terms) => pass(terms), p => p.cov)
  assert.deepEqual([...result.afterKw], ['IAM', 'IGA', 'SSO'])
})
test('each repair is applied to the latest accepted draft, preserving earlier gains', async () => {
  const seen = []
  const result = await acceptImprovingRepairs(pass(['IAM']), ['IGA', 'PAM'], async (current, term) => {
    seen.push([...current.afterKw]); return pass([...current.afterKw, term])
  }, p => p.cov)
  assert.deepEqual(seen, [['IAM'], ['IAM', 'IGA']])
  assert.equal(result.cov, .3)
})
test('a higher total score cannot erase a previously covered requirement', async () => {
  const start = pass(['IAM'])
  assert.equal(await acceptImprovingRepairs(start, [pass(['IGA', 'PAM'])], async (_, p) => p, p => p.cov), start)
})
test('targeted rewrites retain every untouched skill and experience line', () => {
  assert.deepEqual(mergeIndexedEdits([{idx:1,text:'IAM'}, {idx:2,text:'SSO'}], [{idx:1,text:'IAM and IGA'}]), [{idx:1,text:'IAM and IGA'}, {idx:2,text:'SSO'}])
})

test('accepted repairs survive actual Word export and preserve the candidate contact', async () => {
  const { renderResumeDocx } = await import('../../src/lib/resume-formatting.ts')
  const { default: mammoth } = await import('mammoth')
  const terms = ['identity governance', 'access certification', 'privileged access', 'single sign-on']
  const base = ['Candidate', 'candidate@example.com', 'SKILLS', 'Identity: identity governance', 'EXPERIENCE', 'Engineer | Client | 2021 - Present', '• Managed identity governance workflows.']
  async function evaluate(lines) {
    const buffer = await renderResumeDocx(lines.join('\n'), 'kristopher-master')
    const text = (await mammoth.extractRawText({ buffer })).value.toLowerCase()
    const afterKw = new Set(terms.filter(term => text.includes(term)))
    return {lines, buffer, afterKw, cov:afterKw.size / terms.length}
  }
  const result = await acceptImprovingRepairs(await evaluate(base), [
    {line:3, text:'Identity: identity governance, access certification, privileged access, single sign-on'},
    {line:6, text:'• Managed access certification and privileged access reviews within identity governance and investigated single sign-on failures.'},
  ], async (cur, edit) => evaluate(cur.lines.map((line, i) => i === edit.line ? edit.text : line)), p => p.cov + (p.lines[6].includes('investigated') ? .1 : 0))
  assert.equal(result.cov, 1)
  const exported = (await mammoth.extractRawText({buffer:result.buffer})).value
  assert.ok(exported.includes('candidate@example.com'))
  assert.ok(exported.includes('investigated single sign-on failures'))
})
