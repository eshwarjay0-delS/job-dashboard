import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../../public/kompas/app.js",import.meta.url),"utf8");
const begin=src.indexOf("function answerLines("), end=src.indexOf("function renderCard()",begin);
assert.ok(begin>=0&&end>begin);
const snippet=src.slice(begin,end);
function run(answer,desktop=true){
  const context={window:{kompasDesktop:desktop,KompasCorrect:null},sayAnswer:x=>x,PAUSE_MARK:"[pause]"};
  vm.runInNewContext(snippet+"\nresult=answerLines(input)",Object.assign(context,{input:answer}));
  return JSON.parse(JSON.stringify(context.result));
}
test("desktop displays fenced Python code",()=>assert.deepEqual(run("Approach\n\`\`\`python\nprint(1)\n\`\`\`\nComplexity"),[{t:"Approach",kind:"passage"},{t:"print(1)",kind:"code",lang:"python"},{t:"Complexity",kind:"passage"}]));
test("browser retains code",()=>assert.equal(run("\`\`\`js\nconst a = 1;\n\`\`\`",false)[0].kind,"code"));
test("desktop retains code indentation",()=>assert.equal(run("\`\`\`py\n  if x:\n    pass\n\`\`\`")[0].t,"  if x:\n    pass"));
test("plain desktop answers stay passages",()=>assert.equal(run("A normal answer")[0].kind,"passage"));
test("unclosed fence is shown as code",()=>assert.equal(run("\`\`\`sql\nSELECT 1")[0].t,"SELECT 1"));
