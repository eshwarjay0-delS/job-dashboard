import { NextRequest, NextResponse } from 'next/server'
import { authenticatedUser } from '@/lib/authBoundary'
import { sharedKompasStore } from '@/lib/kompas-session-store'
import { kompasTransition } from '@/lib/whatsapp-kompas'
import { KOMPAS_UPLOAD_BYTES, readKompasUpload, parseKompasUpload } from '@/lib/kompas-upload'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return reply({ error: 'Sign in to import sources.' }, 401)
  const params = request.nextUrl.searchParams
  const id = params.get('id') || '', rawRevision = params.get('revision') || '', role = params.get('role') || ''
  const filename = params.get('name') || ''
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^\d+$/.test(rawRevision) || !Number.isSafeInteger(Number(rawRevision)) ||
      !['resume', 'jd', 'support'].includes(role) || !filename.trim() || filename.length > 100 || !/\.(docx|pdf|txt)$/i.test(filename))
    return reply({ error: 'Choose a DOCX, PDF or TXT file and the current session revision.' }, 400)
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > KOMPAS_UPLOAD_BYTES)) return reply({ error: 'Use a file no larger than 4 MiB.' }, 413)
  const name = filename.replace(/[\\/\u0000-\u001f]/g, '_')
  let session
  try { session = await sharedKompasStore().read(user.id, id) }
  catch { return reply({ error: 'Session unavailable. Please retry.' }, 503) }
  if (!session) return reply({ error: 'Session not found for this account.' }, 404)
  if (session.revision !== Number(rawRevision)) return reply({ error: 'The session changed. Refresh before importing.' }, 409)
  let bytes: Buffer
  try { bytes = await readKompasUpload(request.body) }
  catch { return reply({ error: 'Upload could not be read. Use a nonempty file no larger than 4 MiB.' }, 413) }
  try {
    const text = await parseKompasUpload(bytes, name)
    const checked = kompasTransition(session.sources, { kind: 'document', role: role as 'resume' | 'jd' | 'support', name, text })
    if (checked.action !== 'setup') return reply({ error: checked.prompt || 'This source exceeds the session limits.' }, 422)
    // Preview only. Saving uses PATCH with this original revision; no storage writes here.
    return reply({ name, text, revision: session.revision })
  } catch { return reply({ error: 'Cannot read the complete file. Use readable DOCX, UTF-8 TXT or a text PDF of at most 12 pages. Scanned or oversized files must be converted or split.' }, 422) }
}
