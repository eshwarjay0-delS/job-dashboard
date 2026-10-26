import test from 'node:test'
import assert from 'node:assert/strict'
import {evidenceDigest} from '../lib/evaluation-provenance.mjs'
test('artifact digests are stable and identify exact bytes',()=>{assert.equal(evidenceDigest('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');assert.notEqual(evidenceDigest('abc'),evidenceDigest('abc\n'));assert.equal(evidenceDigest(Buffer.from('abc')),evidenceDigest('abc'))})
