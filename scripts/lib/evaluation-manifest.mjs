// A completion manifest identifies a round without copying private answers or source text.
export function buildManifest({ status, stage, round, fixture, caseCount, records, hashes, code, completedAt }) {
 return {
  status,
  stage,
  round,
  fixture,
  caseCount,
  capturedCount: records.filter(record => record.review?.status === 'pending').length,
  sourcesSha256: hashes.sourcesSha256,
  fixtureSha256: hashes.fixtureSha256,
  runnerSha256: hashes.runnerSha256,
  codeVersion: code.codeVersion,
  codeVersionStatus: code.codeVersionStatus,
  promptVersion: null,
  promptVersionStatus: 'Answer route does not return a prompt version.',
  completedAt,
  cases: records.filter(record => record.id).map(record => ({
   id: record.id,
   captureId: record.captureId,
   status: record.status || 'captured',
   provider: record.meta?.provider ?? null,
   model: record.meta?.model ?? null,
   providerRequestId: record.meta?.requestId ?? null,
   elapsedMs: record.elapsedMs,
   reviewStatus: record.review?.status ?? null,
  })),
 }
}
