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
 if(expected instanceof RegExp){assert.match(actual,expected,label);assert.match(actual,/ping 8\.8\.8\.8/,label);}
 else assert.equal(actual,expected,label);
 assert.equal(pick(input),actual,label+' stable');
}
assert.equal(pick('Okay.'),'');
assert.equal(pick('Hello everyone.'),'');
assert.equal(pick("So, we're good Bennett, right? That's right?"),'');
console.log('Birlasoft caption cases passed:',cases.length);

const tailRegressions=[
  ['linked questions', 'Well, how would you build a detection pipeline? And how would you test false positives? I am going to play the next video.', /how would you build a detection pipeline\? And how would you test false positives\?/i, /next video/i],
  ['phishing question tail', 'What are the steps of responding to a phishing alert? And how do you prove containment?', /What are the steps.*And how do you prove containment\?/i, /neverthis/i],
  ['DNS setup', "Okay, let's say troubleshooting part, right? Let's say you are able to ping 8.8.8.8, right? The global DNS site. But you are not able to browse anything by host. What all things will be included as part of your troubleshooting?", /ping 8\.8\.8\.8.*not able to browse.*What all things/i, /neverthis/i],
  ['independent later turn', 'How would you configure DHCP? Next question. What logs would you inspect for DNS failures?', /What logs would you inspect for DNS failures\?/i, /configure DHCP/i],
  ['technical keyword', 'Next.js routing', /^Next\.js routing$/, /neverthis/i],
  ['unrelated narration', 'I am going to play the next video and take notes.', /^$/, /neverthis/i],
];
for(const [label,input,expected,excluded] of tailRegressions){
  const selected=pick(input);
  assert.match(selected,expected,label);
  if(excluded.source!=='neverthis')assert.doesNotMatch(selected,excluded,label);
}
// Nov 2's last-anchor implementation incorrectly returned only the second
// clause; the repaired selection must preserve both without retaining narration.
const nov2Truncated='And how would you test false positives?';
const fullLinked=pick('How would you build a detection pipeline? And how would you test false positives?');
assert.notEqual(fullLinked,nov2Truncated);
assert.equal(fullLinked,'How would you build a detection pipeline? And how would you test false positives?');
// Three visible caption lines are a CSS presentation limit, not a text limit.
const {readFileSync}=require('node:fs');
const css=readFileSync(new URL('../../public/kompas/styles.css',import.meta.url),'utf8');
assert.match(css,/max-height:calc\(3 \* 1\.45em\)/);
assert.ok(fullLinked.split(/\s+/).length>3);
