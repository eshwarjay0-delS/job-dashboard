import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
const require=createRequire(import.meta.url)
test('inbox update controls save selected accounts, keep mobile disabled and refresh scoped links',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://mfit.test/dashboard/mail'})
  const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
  const data={preferences:{enabled:false,mobile:false,ending:'',accounts:[],onlyImportant:true,since:0},accounts:['a@example.com','b@example.com'],events:[],numbers:[],mobileReady:false,backgroundReady:false}
  const calls=[]
  const fetch=async(_,options)=>{calls.push(options.method);if(options.method==='PATCH')data.preferences=JSON.parse(options.body);return {ok:true,json:async()=>options.method==='POST'?{events:[{id:'event',thread:'thread',account:'b@example.com',subject:'An update',from:'sender@example.com',at:Date.now(),initial:false}],issues:[],delivery:{accepted:0,blocked:0}}:structuredClone(data)}}
  const source=readFileSync(new URL('../../src/app/dashboard/mail/_components/inbox-updates.tsx',import.meta.url),'utf8')
  const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
  const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,require:id=>id.endsWith('.css')?{}:require(id),fetch,window:dom.window,document:dom.window.document,console})
  const root=createRoot(document.getElementById('root'))
  try{
    await act(async()=>root.render(React.createElement(module.exports.default)))
    const boxes=[...document.querySelectorAll('input[type=checkbox]')];assert.equal(boxes[3].disabled,true)
    await act(async()=>{boxes[0].click();boxes[2].click()})
    await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})))
    assert.deepEqual(data.preferences.accounts,['b@example.com']);assert.equal(data.preferences.mobile,false)
    await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh updates').click())
    const link=document.querySelector('li a');assert.ok(link.href.includes('account=b%40example.com'));assert.ok(link.href.includes('open=thread'))
    assert.match(document.body.textContent,/Background refresh is not configured/);assert.equal(calls.filter(x=>x==='POST').length,1)
  }finally{await act(async()=>root.unmount());Object.assign(globalThis,previous);dom.window.close()}
})
