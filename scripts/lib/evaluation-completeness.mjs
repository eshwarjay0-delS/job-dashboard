// Capture completeness never implies that answer quality has passed review.
export function captureSummary(cases, records) {
 const expected = cases.map(c => c.id)
 if (!expected.length || new Set(expected).size !== expected.length) throw Error('Expected unique nonempty fixture')
 const captured = records.filter(r => typeof r.text === 'string' && r.text.trim() && r.meta?.model && r.status !== 'failed')
 const ids = captured.map(r => r.id)
 const complete = records.length === expected.length && ids.length === expected.length && new Set(ids).size === ids.length && expected.every(id => ids.includes(id))
 return { status: complete ? 'capture-complete' : 'capture-incomplete', expected: expected.length, captured: captured.length, quality: 'unverified' }
}
