(function(root){
  'use strict';
  let session=null, draft=[];
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const button=(text,fn)=>{const n=el('button',text);n.type='button';n.className='btn';n.onclick=fn;return n;};
  async function crop(image,bounds){
    const img=new Image();img.src=image;await img.decode();
    const [l,t,r,b]=bounds,canvas=document.createElement('canvas');
    const x=Math.floor(img.naturalWidth*l/1000),y=Math.floor(img.naturalHeight*t/1000);
    const w=Math.max(1,Math.ceil(img.naturalWidth*r/1000)-x),h=Math.max(1,Math.ceil(img.naturalHeight*b/1000)-y);
    canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('Image preview unavailable');ctx.drawImage(img,x,y,w,h,0,0,w,h);
    return canvas.toDataURL('image/jpeg',0.85);
  }
  root.KompasScreenReset=()=>{session=null;draft=[];};
  root.KompasScreenReview=async function({image,tasks,sessionId}){
    if(document.querySelector('dialog.screen-review[open]')) throw Error('Finish the current screen review first.');
    if(session!==sessionId){session=sessionId;draft=[];}
    const previousFocus=document.activeElement;
    const dialog=el('dialog');dialog.className='screen-review';dialog.setAttribute('aria-label','Review captured questions');
    const title=el('h2','Choose the questions to answer');dialog.append(title,el('p','Keep the question, its code or diagram, and all options. Scroll the shared window and capture again to collect more sections before answering.'));
    const prior=el('p',draft.length?`${draft.length} question(s) already collected.`:'No earlier sections collected.');dialog.append(prior);
    if(draft.length){const details=el('details');details.append(el('summary','Review collected text'),el('pre',root.KompasScreenCore.format(draft)));dialog.append(details);}
    const rows=[];
    for(const task of tasks){
      const row=el('section'),label=el('label'),input=el('input');input.type='checkbox';input.checked=true;label.append(input,document.createTextNode(' '+task.kind+' · '+(task.complete?'Visible section complete':'More context may be needed')));row.append(label);
      const preview=el('img');preview.alt='Detected question region';row.append(preview);
      crop(image,task.bounds).then(src=>{if(dialog.isConnected)preview.src=src;}).catch(()=>{preview.replaceWith(el('p','Preview unavailable. Review the extracted text below.'));});
      const text=el('pre',root.KompasScreenCore.format([task]));row.append(text);dialog.append(row);rows.push({input,task});
    }
    const continuation=el('input');continuation.type='checkbox';continuation.disabled=!draft.length;
    const contLabel=el('label');contLabel.append(continuation,document.createTextNode(' Attach the selected section to the last collected question'));dialog.append(contLabel);
    const complete=el('input');complete.type='checkbox';const completeLabel=el('label');completeLabel.append(complete,document.createTextNode(' I have checked that all necessary sections and options are captured'));dialog.append(completeLabel);
    const error=el('p');error.setAttribute('role','alert');dialog.append(error);
    const footer=el('div');footer.className='screen-review-actions';dialog.append(footer);document.body.append(dialog);
    return new Promise(resolve=>{
      const finish=result=>{dialog.close();dialog.remove();if(previousFocus?.isConnected)previousFocus.focus();resolve(result);};
      const collect=answer=>{
        try {
          const chosen=rows.filter(r=>r.input.checked).map(r=>r.task);
          const combined=root.KompasScreenCore.append(draft,chosen,continuation.checked);
          if(!combined.length)throw Error('Select at least one question.');
          if(answer && combined.some(t=>!t.complete) && !complete.checked)throw Error('Capture the missing sections first, or confirm you have reviewed the complete question.');
          if(answer){const question=root.KompasScreenCore.format(combined);draft=[];finish({action:'answer',question});}
          else {draft=combined;finish({action:'collect'});}
        }catch(e){error.textContent=e.message;}
      };
      footer.append(button('Discard collected sections',()=>{draft=[];finish({action:'cancel'});}),button('Cancel',()=>finish({action:'cancel'})),button('Keep sections; capture more',()=>collect(false)),button('Answer selected',()=>collect(true)));
      dialog.addEventListener('cancel',e=>{e.preventDefault();finish({action:'cancel'});});dialog.showModal();rows[0]?.input.focus();
    });
  };
})(window);
