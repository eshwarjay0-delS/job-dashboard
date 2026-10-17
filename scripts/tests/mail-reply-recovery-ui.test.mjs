import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import * as drafts from '../../src/lib/mail-reply-draft.ts'
const require=createRequire(import.meta.url)
test('composer restores attachments and text, preserves write-my-own text, and clears only after send succeeds',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://mfit.test'})
 const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const key=drafts.replyDraftKey('user','a@example.com','thread');const saved={to:'to@example.com',cc:'cc@example.com',bcc:'bcc@example.com',subject:'My subject',body:'Keep my own words',files:[{name:'resume.docx',type:'application/octet-stream',data:'YWJj'}]};drafts.saveReplyDraft(dom.window.localStorage,key,saved)
 let fail=true,sent=0,closed=0,posted
 const fetch=async(url,options)=>{if(url==='/api/gmail-send'){posted=JSON.parse(options.body);return {ok:!fail,json:async()=>fail?{error:'Try again'}:{ok:true}}}return {ok:true,json:async()=>({ok:true,plans:[],phrases:[],decisions:[],chips:[],accountId:'account'})}}
 const code=ts.transpileModule(readFileSync(new URL('../../src/app/dashboard/mail/_components/smart-reply.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
 const module={exports:{}};const scoped=id=>{
  if(id==='@/lib/supabase/client')return {createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})}})}
  if(id==='@/lib/mail-reply-draft')return drafts
  if(id==='@/lib/mail-habits')return {readyFor:()=>[]}
  if(id==='@/lib/mail-reading')return {senderName:()=>''}
  if(id.includes('typing-dots'))return {default:()=>null,__esModule:true}
  if(id==='./smart-compose')return {default:({value,onChange})=>React.createElement('textarea',{value,onChange:e=>onChange(e.target.value)}),__esModule:true}
  if(id.includes('_suite/ui'))return {Chip:({label,onClick})=>React.createElement('button',{onClick},label),Btn:({children,...p})=>React.createElement('button',p,children)}
  return require(id)
 }
 vm.runInNewContext(code,{module,exports:module.exports,require:scoped,fetch,localStorage:dom.window.localStorage,window:dom.window,queueMicrotask,console})
 const root=createRoot(document.getElementById('root'))
 try{
  await act(async()=>root.render(React.createElement(module.exports.default,{mail:{id:'thread',account:'a@example.com',fromEmail:'to@example.com',subject:'Old subject'},onSent:()=>sent++,onClose:()=>closed++})))
  assert.equal(document.querySelector('textarea').value,saved.body);assert.match(document.body.textContent,/resume.docx/)
  const click=async text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert.ok(b,text);await act(async()=>b.click())}
  await click('Write my own');assert.equal(document.querySelector('textarea').value,saved.body)
  await click('Save and close');assert.equal(closed,1);assert.deepEqual(drafts.readReplyDraft(dom.window.localStorage,key),saved)
  await click('Approve & Send');assert.equal(sent,0);assert.ok(dom.window.localStorage.getItem(key));assert.equal(posted.bcc,saved.bcc)
  fail=false;await click('Approve & Send');assert.equal(sent,1);assert.equal(dom.window.localStorage.getItem(key),null)
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,previous);dom.window.close()}
})
