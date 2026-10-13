import test from 'node:test';
import assert from 'node:assert/strict';
import { partsOf } from '../../src/app/dashboard/kompas/transcribe/audio.ts';
test('empty audio creates no chunks', () => assert.deepEqual(partsOf(0), []));
