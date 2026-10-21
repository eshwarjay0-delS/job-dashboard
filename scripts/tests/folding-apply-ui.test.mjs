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
import {findDuplicates} from '../../src/lib/duplicate-check.ts'
const require=createRequire(import.meta.url)
function component(path,mocks={}){const module={exports:{}};const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;vm.runInNewContext('(function(require,module,exports){'+code+'\n})')(id=>id in mocks?mocks[id]:require(id),module,module.exports);return module.exports.default}
async function domTest(fn){const dom=new JSDOM('<div id="root"></div>',{url:'https://mfit.test/dashboard/apply'}),old={window:globalThis.window,document:globalThis.document,sessionStorage:globalThis.sessionStorage,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};Object.assign(globalThis,{window:dom.window,document:dom.window.document,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true});const root=createRoot(document.getElementById('root'));try{await fn(root,dom)}finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close()}}
const wrapped=defaultFn=>({__esModule:true,default:defaultFn})
test('reply unfolds composer into third pane and moves contact to fourth',()=>domTest(async root=>{
 const Fold=component('../../src/app/dashboard/mail/_components/folded-conversation.tsx',{'./reading-pane':wrapped(({onReply})=>React.createElement('button',{onClick:onReply},'Reply')),'./smart-reply':wrapped(({onClose})=>React.createElement(React.Fragment,null,React.createElement('textarea',{'aria-label':'Compose'}),React.createElement('button',{onClick:onClose},'Save and close'))),'./contact-card':wrapped(({mail})=>React.createElement('p',null,mail.account))})
 await act(async()=>root.render(React.createElement(Fold,{mail:{id:'thread',account:'correct@example.com'},tint:'#000',restored:false,onSent:()=>{}})))
 assert.equal(document.querySelectorAll('.mf-mail-fold').length,2)
 assert.ok(document.querySelector('.mf-mail-context').textContent.includes('correct@example.com'))
 await act(async()=>document.querySelector('button').click())
 assert.equal(document.querySelectorAll('.mf-mail-fold').length,3)
 assert.ok(document.querySelector('.mf-mail-context textarea'))
 assert.ok(document.querySelector('.mf-mail-contact').textContent.includes('correct@example.com'))
 // Since 725c270 (17 Oct, "Preserve browser reply drafts") the fold has no close button of its own: the composer
 // saves the reply on this browser first, then folds back through onClose ("Save and close").
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Save and close').click())
 assert.equal(document.querySelector('.mf-mail-contact'),null)
}))
test('Apply merges real index results, excludes sample jobs and carries JD into tailoring',()=>domTest(async(root,dom)=>{
 const events=[],navigation=[];globalThis.fetch=async(url,options)=>({ok:true,json:async()=>{
 if(url==='/api/resumes')return {files:[{id:'resume1',filename:'My baseline',filepath:'/owned/resume.docx'}]}
 if(url==='/api/apply/activity'){if(options){const e={...JSON.parse(options.body),id:String(events.length),at:Date.now()};events.push(e);return {event:e}}return {events:[]}}
 if(url.startsWith('/api/jobs'))return {live:false,jobs:[{id:'fake',title:'Sample job'}]}
 if(url.startsWith('/api/crawl/jobs'))return {ok:true,jobs:[{id:'real',title:'Software engineer',firm:'Example',location:'Remote',description:'Build APIs with TypeScript.',url:'https://example.com/jobs/1',portal:'verified',engagement:'W2 contract'}]}
 throw Error(url)
 }})
 const module={exports:{}};const code=ts.transpileModule(readFileSync(new URL('../../src/app/dashboard/apply/page.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
 // What the page took on after this test was written (17-19 Oct): the real duplicate check; stand-ins for saved searches
 // and receipts, which fetch their own data and are not what this test checks; and document, for the "Back from the
 // portal?" listener. The search on page open (e487275) waits on setTimeout, which this sandbox leaves out on purpose.
 vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{URLSearchParams,fetch:(...args)=>globalThis.fetch(...args),sessionStorage:dom.window.sessionStorage,document:dom.window.document})(id=>id==='next/navigation'?{useRouter:()=>({push:p=>navigation.push(p)})}:id==='next/link'?wrapped(({children,...p})=>React.createElement('a',p,children)):id==='@/lib/contract-jobs'?{applicationUrl,contractTypes}:id==='@/lib/duplicate-check'?{findDuplicates}:id==='./_components/saved-searches'?{SavedSearches:()=>null}:id==='./_components/receipts'?{ApplyReceipts:()=>null}:id==='@/components/FolderBrowser'?(({files,onPick})=>React.createElement('div',{className:'folder-stand-in'},files.map(f=>React.createElement('button',{key:f.id,type:'button','data-pick':f.filepath,onClick:()=>onPick(f)},f.filename)))):id.endsWith('.css')?{}:require(id),module,module.exports)
 await act(async()=>root.render(React.createElement(module.exports.default)))
 await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})))
 assert.equal(document.querySelectorAll('.mf-apply-job').length,1)
 assert.ok(!document.body.textContent.includes('Sample job'))
 await act(async()=>document.querySelector('.mf-apply-job').click())
 await act(async()=>document.querySelector('[data-pick="/owned/resume.docx"]').click())  // the resume is picked in the folder window (FolderBrowser), not a select
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Tailor to this job').click())
 assert.equal(dom.window.sessionStorage.getItem('jd_prefill'),'Build APIs with TypeScript.')
 assert.equal(dom.window.sessionStorage.getItem('apply_resume_path'),'/owned/resume.docx')
 assert.deepEqual(navigation,['/dashboard/resume'])
 assert.ok(events.some(e=>e.kind==='view'));assert.ok(!events.some(e=>e.kind==='submitted'))
}))
