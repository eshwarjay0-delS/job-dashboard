import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {applicationUrl,contractTypes} from '../../src/lib/contract-jobs.ts'
const require=createRequire(import.meta.url)
const wrapped=fn=>({__esModule:true,default:fn})

test('saved search uses its own filters immediately and older results cannot replace newer results',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://mfit.test/dashboard/apply'})
 const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})
 const root=createRoot(document.getElementById('root')),requests=[],pending=new Map()
 const fetch=async(url,options)=>{
  if(url==='/api/resumes')return {ok:true,json:async()=>({files:[]})}
  if(url==='/api/apply/activity')return {ok:true,json:async()=>options?{event:{id:'event',...JSON.parse(options.body)}}:{events:[]}}
  requests.push(url)
  if(url.startsWith('/api/crawl/jobs'))return {ok:true,json:async()=>({ok:true,jobs:[]})}
  const query=new URL(url,'https://mfit.test').searchParams.get('q')
  return new Promise(resolve=>pending.set(query,()=>resolve({ok:true,json:async()=>({live:true,jobs:[{id:query,title:query,company:'Example',location:'Remote, Chicago',description:'',url:'https://example.com/'+query,source:'test',salary:null,contractTypes:['C2C']}]})})))
 }
 const code=ts.transpileModule(readFileSync(new URL('../../src/app/dashboard/apply/page.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
 const module={exports:{}}
 vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{URLSearchParams,fetch,document:dom.window.document,sessionStorage:dom.window.sessionStorage,localStorage:dom.window.localStorage,setTimeout:()=>0})(id=>{
  if(id==='next/navigation')return {useRouter:()=>({push:()=>{}})}
  if(id==='next/link')return wrapped(({children,...props})=>React.createElement('a',props,children))
  if(id==='@/lib/contract-jobs')return {applicationUrl,contractTypes}
  if(id==='@/lib/duplicate-check')return {findDuplicates:()=>[]}
  if(id==='./_components/saved-searches')return {SavedSearches:({onRun})=>React.createElement('div',null,...['first','second'].map(query=>React.createElement('button',{key:query,onClick:()=>onRun({query,location:'Chicago',remote:true,type:'C2C'})},query)))}
  if(id==='./_components/receipts')return {ApplyReceipts:()=>null}
  if(id==='@/components/FolderBrowser')return ()=>null
  if(id.endsWith('.css'))return {}
  return require(id)
 },module,module.exports)
 try{
  await act(async()=>root.render(React.createElement(module.exports.default)))
  const click=async text=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent===text).click())
  await click('first');await click('second')
  const urls=requests.filter(u=>u.startsWith('/api/jobs')).map(u=>new URL(u,'https://mfit.test'))
  assert.deepEqual(urls.map(u=>u.searchParams.get('q')),['first','second'])
  for(const u of urls){assert.equal(u.searchParams.get('location'),'Chicago');assert.equal(u.searchParams.get('remote'),'true')}
  await act(async()=>pending.get('second')())
  assert.equal(document.querySelector('.mf-apply-job h2').textContent,'second')
  await act(async()=>pending.get('first')())
  assert.equal(document.querySelector('.mf-apply-job h2').textContent,'second')
  assert.equal(document.querySelector('input[placeholder="Software developer"]').value,'second')
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,previous);dom.window.close()}
})
