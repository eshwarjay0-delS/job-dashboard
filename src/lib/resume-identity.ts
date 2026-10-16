/** Compare every email, not just the first address parsed from a resume. */
export function sameResumeIdentity(source: string, output: string): boolean {
  const emails = (text: string) => [...new Set((text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(s => s.toLowerCase()))].sort().join("\n")
  return emails(source) === emails(output)
}
