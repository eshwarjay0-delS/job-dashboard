import type { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { authenticatedUserId, signInRequired } from '@/lib/authBoundary'

// The shell resolves this with its own authenticated session. The launch link
// carries only this opaque account identifier, never a token or portal password.
export async function GET(request: NextRequest) {
  const id = await authenticatedUserId(request)
  if (!id) return signInRequired()
  return Response.json({ account: createHash('sha256').update(`apply-browser:${id}`).digest('hex') }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
