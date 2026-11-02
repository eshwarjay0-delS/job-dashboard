import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {pick}=require('../../public/kompas/caption-focus.js');
const cases=[
  ['DNS scenario', "Okay, let's say troubleshooting part, right? Let's say you are able to ping 8.8.8.8, right? The global DNS site. But you are not able to browse anything by host. What all things will be included as part of your troubleshooting?", /not able to browse anything by host.*What all things/i],
  ['question', 'What would you check first if DNS lookup fails?', 'What would you check first if DNS lookup fails?'],
  ['narration', 'How would you troubleshoot DNS? I am going to move on to the next video.', 'How would you troubleshoot DNS?'],
  ['keyword', 'CyberArk EPM', 'CyberArk EPM'],
  ['followup', 'How would you remove local admin? And how would you handle exceptions?', 'How would you remove local admin? And how would you handle exceptions?']
];
for(const [label,input,expected] of cases){
 const actual=pick(input);
 if(expected instanceof RegExp){assert.match(actual,expected,label);assert.match(actual,/ping 8\\.8\\.8\\.8/,label);}
 else assert.equal(actual,expected,label);
 assert.equal(pick(input),actual,label+' stable');
}
assert.equal(pick('Okay.'),'');
assert.equal(pick('Hello everyone.'),'');
assert.equal(pick("So, we're good Bennett, right? That's right?"),'');
console.log('Birlasoft caption cases passed:',cases.length);
