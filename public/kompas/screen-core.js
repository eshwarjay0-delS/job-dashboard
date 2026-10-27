/* Screen drafts are task text in memory; screenshots are never persisted here. */
(function (root) {
  'use strict';
  const key = t => JSON.stringify([t.question, t.kind, t.options, t.choiceMode]);
  function joinText(a,b) {
    if(a===b || a.endsWith(b)) return a;
    const left=a.split('\n'), right=b.split('\n');
    for(let n=Math.min(left.length,right.length);n>=2;n--) {
      if(left.slice(-n).join('\n')===right.slice(0,n).join('\n')) return a+'\n'+right.slice(n).join('\n');
    }
    return a+'\n\n'+b;
  }
  function format(tasks) {
    return tasks.map((t,i)=>`Question ${i+1} (${t.kind}; ${t.choiceMode} choice):\n${t.question}`+
      (t.options.length?'\nOptions:\n'+t.options.map(o=>`${o.label}: ${o.text}`).join('\n'):'')).join('\n\n');
  }
  function append(previous, incoming, continuation) {
    const result=previous.map(t=>({...t,options:t.options.map(o=>({...o}))}));
    if(continuation && (result.length===0 || incoming.length!==1)) throw Error('Select one continuation and keep a previous question to attach it to.');
    for(const task of incoming) {
      if(result.some(t=>key(t)===key(task))) continue;
      if(continuation) {
        const last=result[result.length-1];
        if(last.kind!==task.kind) throw Error('These sections have different question types. Add this as a separate question.');
        if(last.choiceMode!=='unknown' && task.choiceMode!=='unknown' && last.choiceMode!==task.choiceMode) throw Error('The choice instructions conflict. Review the captured sections.');
        last.question=joinText(last.question,task.question);
        for(const option of task.options) {
          const old=last.options.find(o=>o.label.toLowerCase()===option.label.toLowerCase());
          if(old && old.text!==option.text) throw Error('The same option label has different text. Recapture the full question.');
          if(!old)last.options.push({...option});
        }
        last.choiceMode=task.choiceMode==='unknown'?last.choiceMode:task.choiceMode;
        // An incomplete earlier section requires explicit review even after the final capture.
        last.complete=last.complete && task.complete;
      } else result.push({...task,options:task.options.map(o=>({...o}))});
    }
    if(result.length>8 || format(result).length>12000) throw Error('This set is too large. Answer a smaller selection first.');
    return result;
  }
  root.KompasScreenCore={append,format,joinText};
})(typeof window==='undefined'?globalThis:window);
