import test from 'node:test'
import assert from 'node:assert/strict'
import { checkGmailRead } from '../../src/lib/connectionCheck.ts'

test('Gmail access requires both HTTP success and explicit successful sync', async () => {
  for (const [status, body, expected] of [[200, {ok:true}, true], [401,{ok:true},false], [500,{error:'revoked'},false], [200,{error:'revoked'},false], [200,{ok:false},false], [200,null,false]]) {
    let calls=0
    assert.equal(await checkGmailRead(async (url, init) => {
      calls++
      assert.equal(url, '/api/gmail-sync')
      assert.equal(init.method, 'POST')
      return new Response(JSON.stringify(body), {status})
    }), expected)
    assert.equal(calls,1)
  }
})
test('network and malformed responses fail without automatic retries', async () => {
  for (const failure of ['network','json']) {
    let calls=0
    await assert.rejects(checkGmailRead(async () => {
      calls++
      if (failure === 'network') throw new Error('offline')
      return new Response('not JSON', {status:200})
    }))
    assert.equal(calls,1)
  }
})
