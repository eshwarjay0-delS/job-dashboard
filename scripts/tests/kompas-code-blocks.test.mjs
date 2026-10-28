import test from "node:test";
import assert from "node:assert/strict";
import {splitAnswerCodeBlocks} from "../../public/kompas/code-blocks.mjs";
test("preserves walkthrough and code",()=>assert.deepEqual(splitAnswerCodeBlocks("Approach\n\`\`\`python\nprint(1)\n\`\`\`\nEdge cases"),[{type:"text",text:"Approach\n"},{type:"code",language:"python",text:"print(1)"},{type:"text",text:"\nEdge cases"}]));
test("plain answer remains text",()=>assert.deepEqual(splitAnswerCodeBlocks("Use a queue"),[{type:"text",text:"Use a queue"}]));
test("no code execution",()=>assert.equal(splitAnswerCodeBlocks("\`\`\`js\nprocess.exit()\n\`\`\`")[0].text,"process.exit()"));
test("invalid input",()=>assert.deepEqual(splitAnswerCodeBlocks(null),[]));
test("language metadata sanitized",()=>assert.equal(splitAnswerCodeBlocks("\`\`\`js<script>\n1\n\`\`\`")[0].language,"jsscript"));

test("two independent code blocks",()=>assert.equal(splitAnswerCodeBlocks("```js\na()\n``` and ```sql\nSELECT 1\n```").filter(x=>x.type==="code").length,2));
test("empty answer",()=>assert.deepEqual(splitAnswerCodeBlocks(""),[]));
test("unclosed fence remains text",()=>assert.deepEqual(splitAnswerCodeBlocks("```python\nprint(1)"),[{type:"text",text:"```python\nprint(1)"}]));
test("code preserves indentation",()=>assert.equal(splitAnswerCodeBlocks("```python\n  if x:\n    pass\n```")[0].text,"  if x:\n    pass"));
test("text after code preserved",()=>assert.equal(splitAnswerCodeBlocks("```py\n1\n```\nComplexity O(n)")[1].text,"\nComplexity O(n)"));
