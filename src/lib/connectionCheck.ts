/** Verify one read without treating an HTTP error or malformed payload as success. */
export async function checkGmailRead(fetcher: typeof fetch = fetch): Promise<boolean> {
  const response = await fetcher("/api/gmail-sync", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) return false
  const body = await response.json()
  return body?.ok === true
}
