import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('src/app/api/gmail/followup-radar/route.ts','utf8')
const block=source.slice(source.indexOf('      const now = Date.now()'),source.indexOf('      // Who did he write'))
const age=new Function('latest','Date','minWait',`for(const item of [latest]){${block}return daysWaiting;}return null;`)
const now=1800000000000
for(const value of [undefined,null,'',0,'0','bad',-1,now+1])test(`invalid timestamp ${value} cannot produce follow-up evidence`,()=>assert.equal(age({internalDate:value},{now:()=>now},3),null))
test('three whole quiet days qualify; a shorter interval waits',()=>{assert.equal(age({internalDate:String(now-3*86400000)},{now:()=>now},3),3);assert.equal(age({internalDate:String(now-3*86400000+1)},{now:()=>now},3),null)})
