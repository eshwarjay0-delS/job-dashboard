// Replay a private session through the real authenticated answer API.
// Keep input/output outside the repository. Credentials are read only from env.
import { readFile, writeFile } from 'node:fs/promises'

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) {
  throw new Error('Usage: node scripts/regenerate-kompas-session.mjs INPUT.json OUTPUT.md')
}
const token = process.env.KOMPAS_API_TOKEN?.trim()
if (!token) throw new Error('KOMPAS_API_TOKEN is required. Use an existing signed-in session credential locally; never put it in the input file.')
const origin = new URL(process.env.KOMPAS_BASE_URL || 'https://job-dashboard-fawn.vercel.app')
if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') throw new Error('Use HTTPS for the authenticated API.')
const endpoint = new URL('/api/kompas/answer', origin)
const input = JSON.parse(await readFile(inputPath, 'utf8'))
if (!input.config?.resume || !input.config?.jd || !Array.isArray(input.questions) || !input.questions.length) {
  throw new Error('The session needs an original resume, JD and questions array.')
}
const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` }
const readiness = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ preflight: true }), signal: AbortSignal.timeout(25000) })
if (!readiness.ok) throw new Error(`Answer API preflight failed (HTTP ${readiness.status}). No answers were regenerated.`)
const ready = await readiness.json()
if (!ready.ready) throw new Error('The answer service is not ready. No answers were regenerated.')
const results = []
const save = async () => {
  const markdown = ['# Kompas session API regeneration', '',
    `Generated: ${new Date().toISOString()}`, `Completed: ${results.length}/${input.questions.length}`, '',
    ...results.flatMap((r, i) => [`## ${i + 1}. ${r.question}`, '', r.text, '',
      `API timing: first content ${r.firstMs} ms; total ${r.totalMs} ms. Model: ${r.model || 'not reported'}.`, '']),
  ].join('\n')
  await writeFile(outputPath, markdown, { mode: 0o600 })
  await writeFile(outputPath + '.json', JSON.stringify(results, null, 2), { mode: 0o600 })
}
for (const question of input.questions) {
  if (typeof question !== 'string' || !question.trim()) throw new Error('Every question must be a nonempty string.')
  const began = performance.now()
  const response = await fetch(endpoint, {
    method: 'POST', headers, signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ stream: true, question, config: input.config, prep: {}, history: [] }),
  })
  if (!response.ok) throw new Error(`Answer ${results.length + 1} failed (HTTP ${response.status}); completed answers are preserved.`)
  if (!response.body || !response.headers.get('content-type')?.includes('event-stream')) throw new Error('Expected a streaming answer response.')
  let text = '', firstMs = 0, buffer = '', meta = {}, done = false
  const decoder = new TextDecoder()
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true })
    let boundary
    while ((boundary = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, boundary).trim()
      buffer = buffer.slice(boundary + 1)
      if (!line.startsWith('data:')) continue
      const event = JSON.parse(line.slice(5).trim())
      if (event.type === 'delta') { if (!firstMs) firstMs = Math.round(performance.now() - began); text += event.text || '' }
      if (event.type === 'replace') text = event.text || ''
      if (event.type === 'meta' || event.type === 'done') meta = { ...meta, ...event }
      if (event.type === 'done') done = true
    }
  }
  if (!done || !text.trim() || meta.degraded || meta.unavailable || meta.busy || meta.noQuestion) {
    throw new Error(`Answer ${results.length + 1} was incomplete or unavailable; completed answers are preserved.`)
  }
  results.push({ question, text: text.trim(), firstMs, totalMs: Math.round(performance.now() - began), model: meta.model, serverTiming: meta.timing })
  await save()
  console.log(`Completed ${results.length}/${input.questions.length}: first content ${firstMs} ms.`)
}
