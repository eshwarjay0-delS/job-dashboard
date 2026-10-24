import { open, rename, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

// Same-directory rename keeps readers on a complete old or new checkpoint.
// A killed process may leave a private temporary file; it cannot truncate the last checkpoint.
export async function saveCheckpoint(destination, records, fs = { open, rename, unlink }) {
 const temporary = `${destination}.${randomUUID()}.tmp`
 let handle
 let primaryError
 try {
  handle = await fs.open(temporary, 'wx', 0o600)
  await handle.writeFile(JSON.stringify(records, null, 2) + '\n')
  await handle.sync()
  await handle.close()
  handle = undefined
  await fs.rename(temporary, destination)
 } catch (error) {
  primaryError = error
  throw error
 } finally {
  if (handle) await handle.close().catch(() => {})
  await fs.unlink(temporary).catch(error => { if (!primaryError && error.code !== 'ENOENT') throw error })
 }
}
