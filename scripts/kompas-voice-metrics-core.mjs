// Offline-only word alignment. No network, storage or transcript logging.
export const words = text => String(text).normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}+#'-]+/gu," ").trim().split(/\s+/u).filter(Boolean);
export function edits(reference,hypothesis){
  const a=words(reference),b=words(hypothesis);
  if(a.length>500||b.length>500)throw Error("Split clips longer than 500 words");
  const d=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for(let i=0;i<=a.length;i++)d[i][0]=i;
  for(let j=0;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)
    d[i][j]=Math.min(d[i-1][j-1]+Number(a[i-1]!==b[j-1]),d[i-1][j]+1,d[i][j-1]+1);
  let i=a.length,j=b.length,s=0,del=0,ins=0;
  while(i||j){
    if(i&&j&&a[i-1]===b[j-1]&&d[i][j]===d[i-1][j-1]){i--;j--}
    else if(i&&j&&d[i][j]===d[i-1][j-1]+1){s++;i--;j--}
    else if(i&&d[i][j]===d[i-1][j]+1){del++;i--}
    else{ins++;j--}
  }
  return {referenceWords:a.length,substitutions:s,deletions:del,insertions:ins};
}
export function termCounts(reference,hypothesis,terms=[]){
  const a=words(reference),b=words(hypothesis);
  const count=(hay,needle)=>hay.reduce((n,_,i)=>n+Number(needle.length>0&&needle.every((x,j)=>hay[i+j]===x)),0);
  let expected=0,recognized=0;
  for(const term of new Set(terms.map(t=>words(t).join(" ")).filter(Boolean))){
    const p=words(term),n=count(a,p);expected+=n;recognized+=Math.min(n,count(b,p));
  }
  return {expected,recognized};
}
export const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]:null;
