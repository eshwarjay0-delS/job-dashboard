import { createHash } from 'node:crypto'
// Exact bytes, rather than parsed-object serialization, identify the supplied artifacts.
export function evidenceDigest(bytes) {
 return createHash('sha256').update(bytes).digest('hex')
}
