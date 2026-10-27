import test from 'node:test'
import assert from 'node:assert/strict'
import {repeatQuestionGuidance} from '../../src/lib/kompasIntent.ts'
import {readFileSync} from 'node:fs'
test('intro re-ask retains career breadth instead of demanding a different incident',()=>{
 const instruction=repeatQuestionGuidance(0)
 assert.match(instruction,/full supported career narrative/)
 assert.match(instruction,/Do not replace/)
 assert.doesNotMatch(instruction,/Give the SAME truth from a different view/)
})
test('drilldown retains the same context',()=>assert.match(repeatQuestionGuidance(3),/Continue the same incident/))
test('ordinary re-ask makes alternative examples optional and relevant',()=>assert.match(repeatQuestionGuidance(2),/optional and must be supported and directly relevant/))
test('route applies question-first policy and removes unconditional novelty command',()=>{
 const route=readFileSync('src/lib/kompasAnswerService.ts','utf8')
 assert.ok(route.includes('${QUESTION_FIRST_POLICY}'))
 assert.ok(route.includes('repeatQuestionGuidance(tier)'))
 assert.ok(!route.includes('Give the SAME truth from a different view'))
})
