// T6 dossier skeleton (research/notebooklm-lens-spec.md §7): every figure in a generated dossier comes from the
// sources or becomes a visibly marked hole; AD079's invented Kompas figures never come back; each blueprint
// question carries three angles and a three-rung ladder; old-shape items still render exactly as before.
import test from 'node:test'
import assert from 'node:assert/strict'
import { gateFigures, HOLE, bannedFigures, normalizeItem, skeletonCheck, BLUEPRINT_PARTS, holesIn } from '../../src/lib/dossierBlueprint.ts'
import { dossierHtml } from '../../src/lib/dossierPdf.ts'
import '../../public/kompas/dossier-md.js'

const resume = 'Security Analyst with 5+ years. Cigna Healthcare Jul 2023 – Present. Citi Bank Jan 2019 – June 2022.'
const jd = 'Review cyber control issues across NIST 800-53 and the CRI Profile. 6+ months contract, four days on-site.'

test('an unsourced figure becomes a marked hole, a sourced one stays', () => {
  const out = gateFigures('I cut triage time by 40% over 5+ years.', [resume, jd])
  assert.match(out.text, /5\+ years/)
  assert.doesNotMatch(out.text, /40%/)
  assert.ok(out.text.includes(HOLE))
  assert.equal(out.blocked.length, 1)
})

test('AD079 invented figures are blocked even when the digits appear in sources', () => {
  for (const bad of ['We used an 800-point risk tolerance.', 'Every issue had a fixed 30-day SLA.', 'Our closure rate rose to 92%.']) {
    const out = gateFigures(bad, [resume, jd, '800 30 92%'])
    assert.equal(bannedFigures(out.text).length, 0, bad)
    assert.ok(out.text.includes(HOLE), bad)
  }
})

test('technical constants (NIST 800-53, event 4624, port 443) are not claims', () => {
  const out = gateFigures('Map to NIST 800-53 AC-2, check event 4624 on port 443.', [resume])
  assert.equal(out.blocked.length, 0)
})

test('blueprint item keeps old fields and adds angles, ladder, failure', () => {
  const it = normalizeItem({ q: 'How do you challenge an RCA?', a: ['x'], angles: { direct: 'd', architect: 'a', brownfield: 'b' }, ladder: ['2', '3', '4', '5'], failure: 'f' })
  assert.deepEqual(Object.keys(it.angles), ['direct', 'architect', 'brownfield'])
  assert.equal(it.ladder.length, 3)
  const old = normalizeItem({ q: 'Old?', a: ['y'] })
  assert.equal(old.angles, undefined)
  assert.equal(old.ladder, undefined)
})

test('old-shape dossier markdown renders byte-identical; new shape renders angles and ladder', () => {
  const { dossierMarkdown } = globalThis.KompasDossierMd
  const old = dossierMarkdown({ interviewer: 'engineer', items: [{ q: 'Q1', a: ['A one.', 'A two.'] }] })
  assert.equal(old, '# Dossier · engineer · standard · general\n\n### Q1\n\n**SAY THIS**\n\nA one. A two.\n')
  const md = dossierMarkdown({ items: [{ q: 'Q2', a: ['A.'], opener: 'I check evidence first.', angles: { direct: 'D.', architect: 'R.', brownfield: 'B.' }, ladder: ['L2', 'L3', 'L4'], failure: 'F.' }] })
  for (const s of ['**OPENER**', '**Angle A · direct**', '**Angle B · architect**', '**Angle C · brownfield**', '**FOLLOW-UP LADDER**', '1. L2', '**FAILURE PROMPT**']) assert.ok(md.includes(s), s)
  assert.equal(globalThis.KompasDossierMd.itemsFromMarkdown(md)[0].q, 'Q2')
})

test('persona exposes the six blueprint parts', () => {
  assert.deepEqual(BLUEPRINT_PARTS, ['evidence', 'oneminute', 'signals', 'fixfirst', 'ladder', 'jargon'])
})

test('skeleton check flags a dossier missing sections or angles', () => {
  const bad = skeletonCheck('## Cover\n\nhi', [{ q: 'q', a: ['a'] }])
  assert.equal(bad.ok, false)
  assert.ok(bad.missing.length > 0)
})

test('print HTML gates every figure and lists holes; contact lines are never printed', () => {
  const html = dossierHtml({ title: 'T', md: '## Evidence base\n\nCall me at (555) 123-4567 or x@y.com. I closed 312 findings.', sources: [resume] })
  assert.doesNotMatch(html.html, /312|555|x@y\.com/)
  assert.ok(html.blocked >= 1)
  assert.ok(holesIn(html.html).length >= 1)
})

test('list numbers in a source do not whitelist a figure; a currency figure becomes a clean hole', () => {
  const asked = '1. Background\n2. On-site\n3. Control issues\n6. Deviations'
  for (const bad of ['It closed in 3 weeks.', 'I led a team of 6 analysts.']) assert.ok(gateFigures(bad, [asked]).text.includes(HOLE), bad)
  assert.equal(gateFigures('It saved $2M.', [asked]).text, `It saved ${HOLE}.`)
})

test('dossier cross-references are labels; a claim right after one is still gated', () => {
  const out = gateFigures('### Arc 4 · see Fix first, item 2 and section 7. I closed 14 issues.', ['nothing'])
  assert.match(out.text, /Arc 4 · see Fix first, item 2 and section 7\./)
  assert.equal(out.blocked.length, 1)
})
