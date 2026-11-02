// Regression cases from the November 2 Birlasoft interview and reported caption pollution.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {pick}=require('../../public/kompas/caption-focus.js');
const cases=[
 ['DNS scenario','Okay, let's say troubleshooting part, right? Let's say you are able to ping 8.8.8.8, right? The global DNS site. But you are not able to browse anything by host. What all things will be included as part of your troubleshooting?', 'What all things will be included as part of your troubleshooting?'],
 ['real question','What would you check first if DNS lookup fails?','What would you check first if DNS lookup fails?'],
 ['narration after question','How would you troubleshoot DNS? I am going to move on to the next video.','How would you troubleshoot DNS?'],
 ['technical keyword','CyberArk EPM','CyberArk EPM'],
 ['linked followup','How would you remove local admin? And how would you handle exceptions?','How would you remove local admin? And how would you handle exceptions?']
];
for(const [label,input,expected] of cases){const got=pick(input);assert.equal(got,expected,label);assert.equal(pick(input),got,label+' repeated stable');}
assert.equal(pick('Okay.'),'');
assert.equal(pick('Hello everyone.'),'');
console.log('Caption focus regression cases passed:',cases.length);
