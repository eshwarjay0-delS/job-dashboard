import test from 'node:test'
import assert from 'node:assert/strict'
import {replyDraftKey,readReplyDraft,saveReplyDraft} from '../../src/lib/mail-reply-draft.ts'
const draft={to:'recipient@example.com',cc:'cc@example.com',bcc:'private@example.com',subject:'Re: Role',body:'My own reply',files:[{name:'resume.docx',type:'application/octet-stream',data:'YWJj'}]}
function storage(){const rows=new Map();return {getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)}}
test('draft round trip retains recipients, subject, body and attachments',()=>{const s=storage(),key=replyDraftKey('u','a@example.com','t');saveReplyDraft(s,key,draft);assert.deepEqual(readReplyDraft(s,key),draft)})
test('draft namespaces isolate users, Gmail accounts and threads',()=>{const keys=[replyDraftKey('u','a@example.com','t'),replyDraftKey('v','a@example.com','t'),replyDraftKey('u','b@example.com','t'),replyDraftKey('u','a@example.com','other')];assert.equal(new Set(keys).size,4);assert.equal(keys[0],replyDraftKey('u','A@example.com','t'));assert.throws(()=>replyDraftKey('','a','t'))})
test('storage quota and corrupt entries surface errors instead of claiming saved',()=>{assert.throws(()=>saveReplyDraft({setItem:()=>{throw Error('quota')}},'key',draft),/quota/);const s=storage();s.setItem('key','{"body":"partial"}');assert.throws(()=>readReplyDraft(s,'key'),/not been overwritten/);assert.equal(s.getItem('key'),'{"body":"partial"}')})
test('clearing delivered draft does not delete another conversation',()=>{const s=storage();saveReplyDraft(s,'one',draft);saveReplyDraft(s,'two',draft);s.removeItem('one');assert.equal(readReplyDraft(s,'one'),null);assert.deepEqual(readReplyDraft(s,'two'),draft)})
