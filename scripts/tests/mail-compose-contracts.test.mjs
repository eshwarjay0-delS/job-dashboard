import test from 'node:test'
import assert from 'node:assert/strict'
import { recipients, attachments, encodeGmailMessage } from '../../src/lib/gmail-message.ts'
import { contractTypes, applicationUrl } from '../../src/lib/contract-jobs.ts'
import { validTracked, trackedBy } from '../../src/lib/mail-important.ts'
test('recipients and attachments reject header injection and excessive payloads',()=>{
 assert.deepEqual(recipients('one@example.com; two@example.com,one@example.com'),['one@example.com','two@example.com'])
 for(const input of ['person@example.com\r\nBcc: other@example.com','not-an-email','a@b.com\n'])assert.throws(()=>recipients(input))
 assert.throws(()=>attachments([{name:'file\r\nBcc: other@example.com',data:'YQ=='}]))
 assert.throws(()=>attachments([{name:'large',data:Buffer.alloc(2*1024*1024+1).toString('base64')}]))
 assert.throws(()=>attachments([{name:'bad',data:'%bad!'}]))
})
test('MIME preserves unicode, separate cc/bcc, threading and an attachment',()=>{
 const raw=encodeGmailMessage({from:'one@example.com',to:['two@example.com'],cc:['cc@example.com'],bcc:['private@example.com'],subject:'Résumé ✓',body:'Hello\nThank you.',attachments:attachments([{name:'résumé.docx',type:'application/octet-stream',data:'YWJj'}]),replyTo:'<original@example.com>'})
 const mime=Buffer.from(raw,'base64url').toString()
 assert.match(mime,/From: one@example.com\r\nTo: two@example.com\r\nCc: cc@example.com\r\nBcc: private@example.com/)
 assert.match(mime,/In-Reply-To: <original@example.com>/)
 assert.ok(mime.includes(Buffer.from('Résumé ✓').toString('base64')))
 assert.ok(mime.includes("filename*=UTF-8''r%C3%A9sum%C3%A9.docx"))
 assert.ok(mime.includes('YWJj'))
 const plain=Buffer.from(encodeGmailMessage({from:'a@example.com',to:['b@example.com'],cc:[],bcc:[],subject:'Hi',body:'test',attachments:[]}), 'base64url').toString()
 assert.match(plain,/Content-Transfer-Encoding: base64\r\n\r\ndGVzdA==/)
})
test('contract filters distinguish payroll from contractual employment and reject unsafe portal URLs',()=>{
 assert.deepEqual(contractTypes('Permanent full-time W2 employee'),[])
 assert.deepEqual(contractTypes('6 month W2 contract; no C2C'),['W2'])
 assert.deepEqual(contractTypes('Contract to hire. W-2 only.'),['W2','C2H'])
 assert.deepEqual(contractTypes('C2C or 1099'),['C2C','1099'])
 assert.deepEqual(contractTypes('Developer','CONTRACTOR'),['Contract'])
 assert.deepEqual(contractTypes('Temporary role'),['Temporary'])
 for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','#'])assert.equal(applicationUrl(url),null)
 assert.equal(applicationUrl('https://example.com/job/1'),'https://example.com/job/1')
})
test('tracking rules bind sender and receiving inbox, reject query syntax',()=>{
 const rule={account:'one@example.com',email:'sender@example.com',name:'Sender',at:123}
 assert.ok(validTracked(rule));assert.ok(trackedBy([rule],'ONE@example.com','sender@example.com'))
 assert.equal(trackedBy([rule],'two@example.com','sender@example.com'),false)
 assert.equal(validTracked({...rule,email:'{from:any}@example.com'}),false)
})
