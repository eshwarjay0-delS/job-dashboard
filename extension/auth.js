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

// The dashboard the extension is set up for. Same default as background.js; a developer can point it at a local
// dashboard through the popup's Settings (the development build is what lets that local page reach the extension).
const DEFAULT_APP_URL = 'https://job-dashboard-fawn.vercel.app';

function originOf(url) {
  try {
    const origin = new URL(url).origin;
    return origin && origin !== 'null' ? origin : null;
  } catch {
    return null;
  }
}

/** The origin of the configured dashboard (chrome.storage.sync appUrl), or null if it is not a usable URL. */
export function dashboardOrigin() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['appUrl'], (s) => resolve(originOf((s && s.appUrl) || DEFAULT_APP_URL)));
  });
}

/**
 * True only for a message from this extension's own web-bridge.js running on the configured dashboard.
 * Only the MarketFit dashboard can hand the extension a sign-in or sign it out.
 */
export function isDashboardSender(sender, origin) {
  if (!origin || !sender || sender.id !== chrome.runtime.id) return false;
  return originOf(sender.url || sender.tab?.url) === origin;
}

/**
 * Listen for auth state messages relayed from the MarketFit web app (via its
 * web-bridge.js content script). The web app posts { type: 'MF_AUTH', session }
 * on login, logout, and token refresh — session is null on logout, in which
 * case the stored session is cleared instead of set. A message from anywhere
 * other than the configured dashboard is ignored and the stored session is left
 * exactly as it was.
 */
export function listenForWebAuth(onAuth) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'MF_AUTH') return;
    dashboardOrigin().then((origin) => {
      if (!isDashboardSender(sender, origin)) {
        sendResponse({ ok: false });
        return;
      }
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
    }, () => sendResponse({ ok: false }));
    return true; // async
  });
}
