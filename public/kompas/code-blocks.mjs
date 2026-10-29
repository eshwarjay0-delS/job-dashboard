// Safe presentation-only parsing for code produced by the existing Kompas answer engine.
// Does not execute generated code or request screen access.
export function splitAnswerCodeBlocks(answer) {
  if (typeof answer !== "string") return [];
  const sections = [];
  const re = /```([^\r\n`]*)\r?\n([\s\S]*?)\r?\n?```/g;
  let from = 0, match;
  while ((match = re.exec(answer))) {
    if (match.index > from) sections.push({type:"text", text:answer.slice(from,match.index)});
    const language = match[1].trim().toLowerCase().replace(/[^a-z0-9+#.-]/g,"").slice(0,32);
    sections.push({type:"code",language,text:match[2]});
    from = re.lastIndex;
  }
  if (from < answer.length) sections.push({type:"text",text:answer.slice(from)});
  return sections;
}
