// MarketFit Extension — auth.js
// Handles session management and authentication state for the Chrome extension.
// Uses chrome.storage.local for session persistence — never localStorage.

/**
 * Retrieve the current session from chrome.storage.local.
 * Returns null if not logged in.
 */
export async function getSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['mf_session'], (result) => {
      resolve(result.mf_session || null);
    });
  });
}

/**
 * Get the Supabase access token from the current session.
 * Returns null if not authenticated.
 */
export async function getToken() {
  const session = await getSession();
  return session?.access_token || null;
}

/**
 * Check whether the user is currently logged in.
 */
export async function isLoggedIn() {
  const token = await getToken();
  return !!token;
}

/**
 * Sign out by clearing the stored session.
 */
export async function signOut() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['mf_session'], resolve);
  });
}

/**
 * Listen for auth state messages relayed from the MarketFit web app (via its
 * web-bridge.js content script). The web app posts { type: 'MF_AUTH', session }
 * on login, logout, and token refresh — session is null on logout, in which
 * case the stored session is cleared instead of set.
 */
export function listenForWebAuth(onAuth) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'MF_AUTH') return;
    if (message.session) {
      chrome.storage.local.set({ mf_session: message.session }, () => {
        onAuth?.(message.session);
        sendResponse({ ok: true });
      });
    } else {
      chrome.storage.local.remove(['mf_session'], () => {
        onAuth?.(null);
        sendResponse({ ok: true });
      });
    }
    return true; // async
  });
}
