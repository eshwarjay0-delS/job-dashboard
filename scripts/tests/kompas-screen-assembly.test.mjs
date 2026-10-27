import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const ctx=vm.createContext({});vm.runInContext(readFileSync('public/kompas/screen-core.js','utf8'),ctx);const core=ctx.KompasScreenCore
const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/kompasScreen.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,Buffer});const {screenTasks}=module.exports
const task=(overrides={})=>({question:'Which control blocks the attack?',kind:'mcq',options:[{label:'A',text:'Authentication'},{label:'B',text:'Authorization'}],choiceMode:'single',complete:true,bounds:[10,20,800,900],...overrides})
const parse=tasks=>screenTasks(JSON.stringify({tasks}))
test('three MCQs retain separate labels, options and regions',()=>{const tasks=[task(),task({question:'Which log?',options:[{label:'A',text:'Audit'},{label:'B',text:'Access'}]}),task({question:'Which two?',choiceMode:'multiple'})];assert.equal(parse(tasks).length,3);const formatted=core.format(tasks);assert.match(formatted,/Question 3/);assert.match(formatted,/multiple choice/);assert.match(formatted,/B: Authorization/);assert.match(formatted,/B: Access/)})
for(const kind of ['coding','free-text','diagram'])test(`accept ${kind} without options`,()=>assert.equal(parse([task({kind,options:[],choiceMode:'unknown'})])[0].kind,kind))
for(const [name,overrides] of [['outside bounds',{bounds:[-1,0,900,900]}],['reversed bounds',{bounds:[900,0,10,900]}],['zero area',{bounds:[0,0,0,100]}],['fractional bounds',{bounds:[0,0,1.5,100]}],['missing completeness',{complete:undefined}],['unsupported type',{kind:'advertisement'}],['unknown choice rule',{choiceMode:'guess'}],['duplicate options',{options:[{label:'A',text:'one'},{label:'a',text:'two'}]}],['missing option text',{options:[{label:'A',text:''}]}],['incomplete full MCQ',{options:[]}]])test(`reject ${name}`,()=>assert.equal(parse([task(overrides)]),null))
test('no questions is empty, not a generated question',()=>assert.equal(parse([]).length,0))
test('readable partial MCQ may be collected without invented choices',()=>assert.equal(parse([task({options:[],complete:false})])[0].complete,false))
test('too many tasks rejected without truncating the set',()=>assert.equal(parse(Array.from({length:9},()=>task())),null))
test('duplicate capture produces one task',()=>assert.equal(core.append([task()],[task()],false).length,1))
test('scroll sections append only on explicit continuation',()=>{const first=task({kind:'coding',question:'Implement sort\nInput: list\nOutput: sorted',options:[],complete:false});const second=task({kind:'coding',question:'Input: list\nOutput: sorted\nConstraints: O(n log n)',options:[]});assert.equal(core.append([first],[second],false).length,2);const merged=core.append([first],[second],true);assert.equal(merged.length,1);assert.match(merged[0].question,/Constraints/);assert.equal((merged[0].question.match(/Input: list/g)||[]).length,1);assert.equal(merged[0].complete,false);assert.equal(first.question.includes('Constraints'),false)})
test('MCQ continuation adds new choices and deduplicates repeated choices',()=>{const merged=core.append([task({complete:false})],[task({question:'continued options',options:[{label:'B',text:'Authorization'},{label:'C',text:'Monitoring'}]})],true);assert.equal(merged[0].options.length,3)})
test('conflicting option text cannot silently overwrite evidence',()=>assert.throws(()=>core.append([task()],[task({question:'continued',options:[{label:'B',text:'Different answer'}]})],true),/different text/))
test('different question types cannot silently merge',()=>assert.throws(()=>core.append([task()],[task({kind:'coding'})],true),/different question types/))
test('multiple regions cannot be ambiguously appended',()=>assert.throws(()=>core.append([task()],[task(),task()],true),/Select one/))
test('continuation without earlier capture is refused',()=>assert.throws(()=>core.append([],[task()],true),/previous/))
test('assembled context limit fails explicitly',()=>assert.throws(()=>core.append([],[task({question:'x'.repeat(12000)})],false),/too large/))
