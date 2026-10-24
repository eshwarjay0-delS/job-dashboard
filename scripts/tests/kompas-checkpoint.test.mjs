import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { saveCheckpoint } from '../lib/evaluation-checkpoint.mjs'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

for (const failure of ['partial write', 'sync', 'rename']) {
 test(`checkpoint preserves prior evidence after ${failure} failure`, async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'kompas-checkpoint-'))
  const destination = path.join(dir, 'round-1.json')
  try {
   await fs.writeFile(destination, '[{"id":"prior"}]\n', { mode: 0o600 })
   const injected = {
    ...fs,
    open: async (...args) => {
     const handle = await fs.open(...args)
     return {
      writeFile: async data => {
       if (failure === 'partial write') { await handle.writeFile(data.slice(0, 8)); throw Error('Injected partial write') }
       return handle.writeFile(data)
      },
      sync: async () => { if (failure === 'sync') throw Error('Injected sync'); await handle.sync() },
      close: () => handle.close(),
     }
    },
    rename: async (...args) => { if (failure === 'rename') throw Error('Injected rename'); await fs.rename(...args) },
   }
   await assert.rejects(saveCheckpoint(destination, [{ id: 'next' }], injected), /Injected/)
   assert.deepEqual(JSON.parse(await fs.readFile(destination)), [{ id: 'prior' }])
   assert.deepEqual(await fs.readdir(dir), ['round-1.json'])
   await saveCheckpoint(destination, [{ id: 'next' }])
   assert.deepEqual(JSON.parse(await fs.readFile(destination)), [{ id: 'next' }])
   assert.equal((await fs.stat(destination)).mode & 0o777, 0o600)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
 })
}

test('cleanup failure does not replace the original write error', async () => {
 const original = Error('original write failure')
 await assert.rejects(saveCheckpoint('/unused', [], {
  open: async () => ({ writeFile: async () => { throw original }, close: async () => {} }),
  unlink: async () => { throw Object.assign(Error('cleanup denied'), { code: 'EACCES' }) },
 }), error => error === original)
})

test('killing a writer before rename preserves the last complete checkpoint', { timeout: 10000 }, async () => {
 const dir = await fs.mkdtemp(path.join(tmpdir(), 'kompas-kill-'))
 const destination = path.join(dir, 'round-1.json')
 let child
 try {
  await fs.writeFile(destination, '[{"id":"prior"}]\n')
  const moduleUrl = new URL('../lib/evaluation-checkpoint.mjs', import.meta.url).href
  child = spawn(process.execPath, ['--input-type=module', '-e', `
   import * as fs from 'node:fs/promises';
   import { saveCheckpoint } from ${JSON.stringify(moduleUrl)};
   await saveCheckpoint(process.argv[1], [{id:'next'}], {...fs, open: async (...args) => {
    const handle=await fs.open(...args);
    return {writeFile:async data=>{
     await handle.writeFile(data.slice(0,8)); await handle.sync();
     console.log('PARTIAL'); await new Promise(()=>{setInterval(()=>{},1000)});
    },sync:()=>handle.sync(),close:()=>handle.close()};
   }});
  `, destination], { stdio: ['ignore', 'pipe', 'pipe'] })
  const exited = once(child, 'exit')
  await once(child.stdout, 'data')
  child.kill('SIGKILL')
  await exited
  assert.deepEqual(JSON.parse(await fs.readFile(destination)), [{ id: 'prior' }])
  const orphan = (await fs.readdir(dir)).find(name => name.endsWith('.tmp'))
  assert.ok(orphan, 'interruption leaves temporary evidence separate from round file')
  assert.equal((await fs.stat(path.join(dir, orphan))).mode & 0o777, 0o600)
 } finally { child?.kill('SIGKILL'); await fs.rm(dir, { recursive: true, force: true }) }
})
