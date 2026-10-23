// MarketFit Extension — claude-key.js
// Keeps the user's own AI key on this computer only (chrome.storage.local), never in chrome.storage.sync, which
// copies its contents to every Chrome signed in to the same Google account. Installs from before this change kept
// the key in sync storage; the first popup open moves it across once and removes the synced copy.
// Loaded by popup.html as a plain script before popup.js; exposes globalThis.MarketFitClaudeKey.
;(function (root) {
  /** Move a key left in sync storage by an older version into local storage, once. True if anything was moved. */
  async function moveClaudeKeyToLocal(storage) {
    const synced = await storage.sync.get(["claudeKey"])
    if (!synced || !("claudeKey" in synced)) return false
    const local = await storage.local.get(["claudeKey"])
    // A key already saved on this computer is newer than the synced one, so it wins.
    if (synced.claudeKey && !(local && local.claudeKey)) await storage.local.set({ claudeKey: synced.claudeKey })
    await storage.sync.remove(["claudeKey"])
    return true
  }

  /** The stored key, or "" when none is set. */
  async function readClaudeKey(storage) {
    await moveClaudeKeyToLocal(storage)
    const local = await storage.local.get(["claudeKey"])
    return (local && local.claudeKey) || ""
  }

  /** Save a key on this computer. An empty value leaves the stored key as it is, as Settings always did. */
  async function saveClaudeKey(storage, key) {
    if (key) await storage.local.set({ claudeKey: key })
  }

  root.MarketFitClaudeKey = { moveClaudeKeyToLocal, readClaudeKey, saveClaudeKey }
})(globalThis)
