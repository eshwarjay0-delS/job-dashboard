import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumeEmails, organizeResumes, CATEGORY_FOLDERS } from '../../src/lib/resumeOrganization.ts'
test('contact run whitespace and case are normalized without joining labels', () => {
  assert.deepEqual(resumeEmails('Email: Jay.44 @ gmail.com\nPhone: 123'), ['jay.44@gmail.com'])
  assert.deepEqual(resumeEmails('a@example.com b@example.com'), ['a@example.com', 'b@example.com'])
})
test('same-email duplicates are removed but different identities and ambiguous contacts survive', () => {
  const rows = [
    { id: 'a', filename: 'a.docx', text: 'a@example.com SIEM Splunk incident response' },
    { id: 'b', filename: 'b.docx', text: 'A@EXAMPLE.COM   SIEM Splunk incident response' },
    { id: 'c', filename: 'c.docx', text: 'b@example.com SIEM Splunk incident response' },
    { id: 'd', filename: 'd.docx', text: 'a@example.com b@example.com SIEM Splunk incident response' },
  ]
  const result = organizeResumes(rows)
  assert.equal(result.kept.length, 3)
  assert.equal(result.removed.length, 1)
  assert.equal(result.kept.find(v => v.id === 'd').email, null)
})
test('strongest two category matches survive independent of upload order', () => {
  const rows = ['SIEM', 'SIEM Splunk incident response', 'SIEM Splunk incident response Sentinel SOC'].map((text, i) => ({ id: String(i), filename: `${i}.docx`, text: 'a@example.com '+text }))
  assert.deepEqual(organizeResumes(rows).kept.map(v => v.id), ['2', '1'])
  assert.deepEqual(organizeResumes([...rows].reverse()).kept.map(v => v.id), ['2', '1'])
  assert.equal(CATEGORY_FOLDERS.length, 25)
})
test('reorganization is stable and an empty input never invents documents', () => {
  assert.equal(organizeResumes([]).kept.length, 0)
  const input = [{ id: 'a', filename: 'a.docx', text: 'a@example.com AI security LLM prompt injection' }]
  assert.deepEqual(organizeResumes(organizeResumes(input).kept).kept, organizeResumes(input).kept)
})
