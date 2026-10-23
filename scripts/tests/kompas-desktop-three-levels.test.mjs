import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {JSDOM} from 'jsdom'
import {desktopQuestionKind,desktopResponsePolicy} from '../../src/lib/kompasDesktopResponse.ts'

test('level one retains technical HR foundations and practical engineering reasoning',()=>{
 const screening=desktopResponsePolicy('engineer','What is privileged access?')
 const engineering=desktopResponsePolicy('engineer','How would you troubleshoot an outage during on-call?')
 assert.equal(screening.kind,'definition')
 assert.equal(engineering.kind,'implementation')
 assert.ok(engineering.words>screening.words)
 assert.match(screening.guidance,/Technical HR screens foundational JD readiness/)
 assert.match(engineering.guidance,/hypotheses, evidence, research, alternatives, pivots/)
 assert.match(engineering.guidance,/on-call accountability/)
 assert.match(engineering.guidance,/metrics only when supplied/)
})

test('definitions and comparisons stay concise across all three audiences while explicit deep experience expands',()=>{
 for(const audience of ['engineer','architect','director']){
  const definition=desktopResponsePolicy(audience,'What is CSRF?')
  const comparison=desktopResponsePolicy(audience,'Compare IDOR versus CSRF')
  const experience=desktopResponsePolicy(audience,'Have you ever discovered a vulnerability? Give me a deep example.')
  assert.equal(definition.kind,'definition');assert.equal(comparison.kind,'comparison');assert.equal(experience.kind,'experience')
  assert.ok(definition.words<=100);assert.ok(comparison.words<=120);assert.ok(experience.words>comparison.words)
  assert.match(definition.guidance,/Do not add a personal incident/)
  assert.match(experience.guidance,/actual bottleneck/)
  assert.match(experience.guidance,/only supplied facts and metrics/)
 }
 assert.equal(desktopQuestionKind('Compare IDOR and CSRF in depth, step by step'),'implementation')
 assert.match(desktopResponsePolicy('architect','How would you integrate authorization?').guidance,/bit by bit/)
 assert.match(desktopResponsePolicy('director','How would you integrate authorization?').guidance,/business and operational level/)
})

test('desktop offers exactly three levels and switches a pending response immediately with isolated cached answers',()=>{
 const source=readFileSync(new URL('../../public/kompas/app.js',import.meta.url),'utf8')
 const options='<option value="engineer">Technical HR + Engineer</option><option value="architect" selected>Architect + Developer</option><option value="director">Director</option>'
 const dom=new JSDOM('<select id="interviewerSelect">'+options+'</select><select id="liveInterviewer">'+options+'</select><div id="depthBars"></div><span id="depthMeter"></span><button id="whoUp"></button><button id="whoDown"></button>')
 const calls=[],card={question:'Compare IDOR and CSRF',anchors:{director:{prose:'Old director answer'}},anchorFlight:'director',req:{abort:()=>calls.push('aborted')}}
 const context={window:{kompasDesktop:{}},document:dom.window.document,$:id=>dom.window.document.getElementById(id),current:{},cards:[card],idx:0,liveConfig:()=>({mode:'technical',length:'balanced'}),askingLevel:()=>context.$('liveInterviewer').value,saveSession:()=>{},clearTimeout:()=>{},setTimeout:()=>{throw Error('Desktop switch must not wait for a timer')},paintFromAnchors:()=>{throw Error('Desktop must not derive from another audience')},renderCard:()=>calls.push('render'),status:()=>{},generateAnswer:(q,c,o)=>calls.push({q,regen:o.regen,level:context.$('liveInterviewer').value})}
 const start=source.indexOf('const DESKTOP_RESPONSE_LEVELS'),end=source.indexOf('/* ---- start / stop ---- */',start)
 vm.runInNewContext(source.slice(start,end),context)
 assert.deepEqual([...context.$('liveInterviewer').options].map(o=>o.textContent),['Technical HR + Engineer','Architect + Developer','Director'])
 assert.equal(context.keptLevel('developer'),'architect','legacy developer migrates to the combined second level')
 context.$('liveInterviewer').value='engineer';context.audienceChanged(false)
 assert.equal(calls[0],'aborted');assert.deepEqual(calls[1],{q:'Compare IDOR and CSRF',regen:true,level:'engineer'})
 card.desktopByDepth={'three-level-v4|director|technical|balanced|Compare IDOR and CSRF':{answer:'Business view',meta:'cached'}}
 context.$('liveInterviewer').value='director';context.audienceChanged(false)
 assert.equal(card.answer,'Business view');assert.equal(card.streaming,false)
 assert.equal(calls.filter(x=>typeof x==='object').length,1,'cached director answer does not generate again')
 dom.window.close()
})

test('desktop response path passes its selected level directly and bypasses two-anchor generation',()=>{
 const app=readFileSync(new URL('../../public/kompas/app.js',import.meta.url),'utf8')
 const route=readFileSync(new URL('../../src/app/api/kompas/answer/route.ts',import.meta.url),'utf8')
 assert.match(app,/if \(!directDesktop && window\.KompasAnchors/)
 assert.match(app,/if \(!directDesktop && window\.KompasJev/)
 assert.match(app,/responseCalibration: "three-level-v1"/)
 assert.match(app,/if \(!directDesktop && window\.KompasLevels && text/)
 assert.match(route,/desktopResponsePolicy\(level, question\)/)
 assert.match(route,/plan\.words = desktopPolicy\.words/)
})
