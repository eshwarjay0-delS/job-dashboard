// Kompas desktop, main process. Prevents the desktop app from being a website in a frame or a second, thinner
// copilot: one window shows the web copilot itself (perfACT/copilot: sessions, wizard, transcripts, resume,
// documents, live call) as a single panel, with one title bar that preload.js and panel.css draw inside it.
//
// The window shows the live site (https://perfact-ten.vercel.app). It does not serve a second copy
// from this folder. A deploy is the change; the page reloads itself when /version.json moves.
// /api/* is forwarded to that same site. No model credential is ever in this process or the page.
//
// Private is setContentProtection on this window (Windows display affinity 0x11, WDA_EXCLUDEFROMCAPTURE): one
// saved flag, default on, applied at creation and again whenever the switch changes.
// The window goes where the user puts it and is the size they make it, like Parakeet's: drag the title bar,
// press Ctrl+Shift+arrows, or pick one of six screen sections from the move icon; drag any edge or corner to
// resize. Place and size are saved and restored on the next launch.
// Computer audio is the Windows output mix (WASAPI loopback): a call, a video, a browser tab — whatever the
// speakers are playing. The process is always Kompas.exe. Still not here: a blank process name, meeting detection.
// Every launch asks whether to keep the window off the taskbar; the answer holds until Kompas quits (askTaskbar).
// Pinned means above everything, the taskbar included, and the window cannot be lost: see holdOnTop and bringBack.
const { app, BrowserWindow, ipcMain, screen, shell, Menu, session, protocol, net, desktopCapturer, powerMonitor, globalShortcut, dialog, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const { createMarketFitDesktopAuth } = require("./marketfit-auth.cjs");
const { ticketFromArgv, redeemTicket } = require("./desktop-handoff.cjs");

app.setName("Kompas");
// Preserve the existing perfACT desktop while MarketFit gets its own native
// instance and local session store. Both use the same installed Electron source,
// but a preexisting standalone app must not intercept a MarketFit deep link.
const MARKETFIT_SCHEME = "marketfit-kompas";
const startedForMarketFit = !process.argv.some(arg =>
  typeof arg === "string" && /^kompas:\/\/open(?:[/?#]|$)/i.test(arg));
if (startedForMarketFit) {
  // Electron requires the destination to exist before app.setPath().
  // New installations have no MarketFit profile yet.
  const marketFitProfile = path.join(app.getPath("appData"), "Kompas MarketFit");
  fs.mkdirSync(marketFitProfile, { recursive: true });
  app.setPath("userData", marketFitProfile);
}
if (process.platform === "win32") app.setAppUserModelId(startedForMarketFit ? "Kompas.MarketFit" : "Kompas");
// The website's Desktop mode opens this installed exe. kompas://app/ stays the in-window page;
// kompas://open?d= is the launch link and is never loaded as a page.
if (process.defaultApp) {
  if (process.argv.length >= 2) app.setAsDefaultProtocolClient("kompas", process.execPath, [path.resolve(process.argv[1])]);
} else app.setAsDefaultProtocolClient("kompas");
if (process.defaultApp) {
  if (process.argv.length >= 2) app.setAsDefaultProtocolClient(MARKETFIT_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
} else app.setAsDefaultProtocolClient(MARKETFIT_SCHEME);
if (process.env.KOMPAS_DEBUG_PORT) app.commandLine.appendSwitch("remote-debugging-port", String(process.env.KOMPAS_DEBUG_PORT));

const PERFACT_API_ORIGIN = (process.env.KOMPAS_API_URL || "https://perfact-ten.vercel.app").replace(/\/+$/, "");
const MARKETFIT_API_ORIGIN = "https://job-dashboard-fawn.vercel.app";
const desktopAuth = createMarketFitDesktopAuth({ net, safeStorage, fs, profileDir: () => app.getPath("userData"), origin: MARKETFIT_API_ORIGIN });
let lastChromeSignIn = 0;
function beginChromeSignIn() {
  if (Date.now() - lastChromeSignIn < 8000) return;
  lastChromeSignIn = Date.now();
  const state = desktopAuth.issueState();
  // User credentials stay in the existing Chrome account. The callback is one-use
  // and must match a state this desktop issued, never an unsolicited deep link.
  void shell.openExternal(MARKETFIT_API_ORIGIN + "/auth/desktop?state=" + encodeURIComponent(state)).catch(() => {});
}
let activeSite = "marketfit";
const siteFor = (s) => s && s.site === "perfact" ? "perfact" : "marketfit";
const appPathFor = () => activeSite === "marketfit" ? "/kompas/index.html" : "/index.html";
const targetOrigin = () => activeSite === "marketfit" ? MARKETFIT_API_ORIGIN : PERFACT_API_ORIGIN;
const ORIGIN = "kompas://app";
const FORWARD_HEADERS = ["content-type", "accept", "x-audio-mime", "x-whisper-prompt", "x-speech-hint", "x-speech-lang", "x-speech-for", "x-kompas-app"];
const PANEL_CSS = fs.readFileSync(path.join(__dirname, "panel.css"), "utf8");

protocol.registerSchemesAsPrivileged([
  { scheme: "kompas", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const MIN = { width: 360, height: 280 };
const DEFAULT_SIZE = { width: 820, height: 720 };
const MARK = { width: 184, height: 38 };
const NUDGE = 20;

const CONFIG_FILE = () => path.join(app.getPath("userData"), "desktop.json");
function readConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_FILE(), "utf8")); } catch { return {}; } }
function writeConfig() { try { fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true }); fs.writeFileSync(CONFIG_FILE(), JSON.stringify(config, null, 2)); } catch {} }
let config = { onTop: true, isPrivate: true, bounds: null };

let win = null, collapsed = false, resizing = null, saveTimer = null, pendingSession = null, hideTaskbar = true;

// Asked on every launch, never saved (owner, 7 Oct 2026: "Give a dialog before whether would you like hide this from
// taskbar. If they say yes then work it out."). Closing the box with Esc or X is a No: the button stays, so a window
// that might be lost behind others always has a way back.
async function askTaskbar() {
  const { response } = await dialog.showMessageBox({
    type: "question",
    title: "Kompas",
    message: "Hide Kompas from the taskbar?",
    detail: "Yes keeps Kompas off the taskbar, Alt+Tab and Task Manager's Apps list until you quit; Kompas.exe still runs under Background processes. Opening the Kompas shortcut again brings the window back.",
    buttons: ["Yes, hide it", "No, show it"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  return response === 0;
}

// kompas://open?d=<base64url json> is the session the website just started. kompas://app/ is the page itself.
async function sessionFromTicketArgv(argv) {
  const ticket = ticketFromArgv(argv);
  if (!ticket) return null;
  const handed = await redeemTicket((url, options) => net.fetch(url, options), MARKETFIT_API_ORIGIN, ticket);
  // The server minted this one-use ticket for the authenticated account.
  // The ownerId is server-attested and MUST be checked before the native
  // renderer receives the session. Do not lose a redeemed interview just
  // because Chrome's short-lived access bearer has expired in transit.
  if (typeof handed.ownerId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(handed.ownerId))
    throw Error("Saved interview ticket has no verified account owner");
  if (handed.token) {
    const valid = await desktopAuth.acceptCallback({
      access_token: handed.token, expires_at: handed.tokenExp
    }, handed.ownerId);
    if (!valid && desktopAuth.ownerId() !== handed.ownerId) beginChromeSignIn();
  } else if (desktopAuth.ownerId() !== handed.ownerId || !desktopAuth.token()) {
    beginChromeSignIn();
  }
  // Keep this transfer pending until a verified Chrome callback proves the
  // exact same account; no account-agnostic local import or cookie fallback.
  return handed;
}
function sessionFromArgv(argv) {
  const raw = (argv || []).find(a => typeof a === "string" && /^(?:kompas|marketfit-kompas):/i.test(a) && !/^kompas:\/\/app\b/i.test(a));
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const d = u.searchParams.get("d");
    if (!d) return null;
    const json = Buffer.from(d.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const s = JSON.parse(json);
    // MarketFit transfers must use the server's one-use ticket, never raw
    // base64 session content that any untrusted URL can manufacture.
    if (u.protocol === "marketfit-kompas:") return null;
    return s && typeof s === "object" && s.id ? s : null;
  } catch { return null; }
}
function takeVerifiedSession() {
  if (!pendingSession) return null;
  // All MarketFit sessions must be redeemed from server-issued one-use
  // tickets and bound to their authenticated owner. Never accept arbitrary
  // desktop://open?d= data as a trusted account session.
  if (pendingSession.site !== "perfact" &&
      (!pendingSession.ownerId || !desktopAuth.token() ||
       desktopAuth.ownerId() !== pendingSession.ownerId)) return null;
  const verified = { ...pendingSession };
  for (const key of ["token", "refreshToken", "tokenExp", "access_token", "refresh_token", "ownerId"]) delete verified[key];
  pendingSession = null;
  return verified;
}
function deliverSession() {
  if (!win || win.isDestroyed()) return;
  const s = takeVerifiedSession();
  if (s) win.webContents.send("kompas:session", s);
  else if (pendingSession) beginChromeSignIn();
}

// A saved place is used only if enough of it is still on some screen to grab; otherwise, as on a first launch,
// the panel opens at the centre of the top of the primary work area.
const onSomeScreen = (b, width, height) => screen.getAllDisplays().some(({ workArea: w }) =>
  Math.min(b.x + (width || b.width), w.x + w.width) - Math.max(b.x, w.x) >= Math.min(120, width || b.width) && Math.min(b.y + Math.min(42, height || b.height), w.y + w.height) - Math.max(b.y, w.y) >= 20);
function startBounds() {
  const b = config.bounds;
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
    const width = Math.max(MIN.width, Math.round(b.width)), height = Math.max(MIN.height, Math.round(b.height));
    const visible = onSomeScreen(b, width, height);
    if (visible) {
      const spot = { x: Math.round(b.x), y: Math.round(b.y), width, height };
      const docked = config.dock && applyDock(config.dock, spot, screen.getDisplayMatching(spot).workArea);
      return docked || spot;
    }
  }
  const wa = screen.getPrimaryDisplay().workArea;
  const width = Math.min(DEFAULT_SIZE.width, wa.width), height = Math.min(DEFAULT_SIZE.height, wa.height);
  return { x: Math.round(wa.x + (wa.width - width) / 2), y: wa.y, width, height };
}

function rememberBounds() {
  if (!win || win.isDestroyed() || collapsed || win.isMinimized()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (win && !collapsed) { config.bounds = win.getBounds(); writeConfig(); } }, 250);
}

// A drag that comes within 24px of a side, a corner, or the top centre attaches there. Pulling further away
// lets go. Programmatic moves (the six-section placer, Hide) opt out with suppressMagnet.
const SNAP = 24;
let suppressMagnet = 0;
function magnetOf(b) {
  const wa = screen.getDisplayMatching(b).workArea;
  const close = (d) => Math.abs(d) <= SNAP;
  const nearL = close(b.x - wa.x), nearR = close(b.x + b.width - (wa.x + wa.width));
  const nearT = close(b.y - wa.y), nearB = close(b.y + b.height - (wa.y + wa.height));
  const mid = wa.x + wa.width / 2, nearC = close(b.x + b.width / 2 - mid);
  let x = b.x, y = b.y, dock = "";
  if (nearL) { x = wa.x; dock += "l"; }
  else if (nearR) { x = wa.x + wa.width - b.width; dock += "r"; }
  else if (nearT && nearC) { x = Math.round(mid - b.width / 2); dock += "c"; }
  if (nearT) { y = wa.y; dock += "t"; }
  else if (nearB) { y = wa.y + wa.height - b.height; dock += "b"; }
  return { x, y, width: b.width, height: b.height, dock: dock || null };
}
function applyDock(dock, size, wa) {
  if (!dock || !wa) return null;
  let x = size.x, y = size.y;
  if (dock.includes("l")) x = wa.x;
  else if (dock.includes("r")) x = wa.x + wa.width - size.width;
  else if (dock.includes("c")) x = Math.round(wa.x + (wa.width - size.width) / 2);
  if (dock.includes("t")) y = wa.y;
  else if (dock.includes("b")) y = wa.y + wa.height - size.height;
  return { x, y, width: size.width, height: size.height };
}
// Snap when the drag is released, not on every move. Snapping mid-drag eats the gesture: each tiny step is
// still inside the 24px zone, so the window can never be pulled off the edge it just stuck to.
function onMoved() {
  if (suppressMagnet || collapsed || resizing || !win || win.isDestroyed()) { rememberBounds(); return; }
  const b = win.getBounds(), m = magnetOf(b);
  config.dock = m.dock;
  if (m.x !== b.x || m.y !== b.y) {
    suppressMagnet++;
    try { win.setBounds({ x: m.x, y: m.y, width: b.width, height: b.height }); } finally { suppressMagnet--; }
  }
  rememberBounds();
}

// Hide leaves a small mark at the top of where the panel was; the panel comes back where the mark is now.
function setCollapsed(on) {
  if (!win || win.isDestroyed() || !!on === collapsed) { sendState(); return; }
  if (on) {
    config.bounds = win.getBounds(); writeConfig();
    collapsed = true;
    const b = config.bounds;
    win.setMinimumSize(1, 1);
    win.setResizable(false);
    win.setBounds({ x: Math.round(b.x + (b.width - MARK.width) / 2), y: b.y, ...MARK });
  } else {
    const m = win.getBounds(), b = config.bounds || startBounds();
    collapsed = false;
    win.setResizable(true);
    win.setBounds({ x: Math.round(m.x - (b.width - MARK.width) / 2), y: m.y, width: b.width, height: b.height });
    win.setMinimumSize(MIN.width, MIN.height);
    rememberBounds();
  }
  win.webContents.focus();
  sendState();
}

function applyProtection() {
  const hidden = !!config.isPrivate;
  for (const w of [win, picker]) {
    if (!w || w.isDestroyed()) continue;
    w.setContentProtection(hidden);
    w.setSkipTaskbar(w === picker || hideTaskbar);
  }
}

// Place: six sections over the work area, two rows of three. Kompas keeps its size when it fits the section and
// shrinks to fit when it does not, and sits inside it, inset from the section's edges, aligned to its corner
// (left, centre or right; top or bottom), so it never touches the screen edge.
const INSET = 12;
function sectionRects(wa) {
  const cw = Math.floor(wa.width / 3), ch = Math.floor(wa.height / 2), out = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++)
    out.push({ x: wa.x + c * cw, y: wa.y + r * ch, width: c === 2 ? wa.width - 2 * cw : cw, height: r === 1 ? wa.height - ch : ch });
  return out;
}
function sectionOf(b, wa) {
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  return sectionRects(wa).findIndex(s => cx >= s.x && cx < s.x + s.width && cy >= s.y && cy < s.y + s.height);
}
function boundsIn(i, wa, size) {
  const s = sectionRects(wa)[i], col = i % 3, row = Math.floor(i / 3);
  const width = Math.max(MIN.width, Math.min(size.width, s.width - 2 * INSET));
  const height = Math.max(MIN.height, Math.min(size.height, s.height - 2 * INSET));
  const x = col === 0 ? s.x + INSET : col === 1 ? Math.round(s.x + (s.width - width) / 2) : s.x + s.width - INSET - width;
  const y = row === 0 ? s.y + INSET : s.y + s.height - INSET - height;
  return { x, y, width, height };
}

let picker = null;
function openPicker() {
  if (!win || win.isDestroyed() || collapsed || picker) return;
  const wa = screen.getDisplayMatching(win.getBounds()).workArea;
  picker = new BrowserWindow({
    ...wa,
    parent: win,                                // owned by Kompas: above it, and no taskbar button of its own
    frame: false,
    transparent: true,
    backgroundMaterial: "acrylic",              // Windows 11 blurs whatever is behind; the page adds a paper tint
    backgroundColor: "#00000000",
    resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, "picker-preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  applyProtection();
  picker.setAlwaysOnTop(true, "screen-saver");
  picker.loadFile(path.join(__dirname, "picker.html"), { query: { current: String(sectionOf(win.getBounds(), wa)) } });
  picker.once("ready-to-show", () => { picker.show(); picker.focus(); });
  picker.webContents.on("will-navigate", (e) => e.preventDefault());
  picker.on("closed", () => { picker = null; });
  picker.placeArea = wa;
}
function closePicker() { if (picker && !picker.isDestroyed()) picker.close(); }
function place(i) {
  if (!picker || !win || !(i >= 0 && i < 6)) return closePicker();
  const wa = picker.placeArea;
  closePicker();
  suppressMagnet++;
  try { win.setBounds(boundsIn(i, wa, win.getBounds())); } finally { suppressMagnet--; }
  config.dock = null;
  config.section = i;
  config.bounds = win.getBounds();
  writeConfig();
  win.focus();
}

function prefs() { return { onTop: !!config.onTop, isPrivate: !!config.isPrivate, opacity: config.opacity, version: app.getVersion() }; }

function sendState() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("kompas:state", { collapsed, ...prefs() });
  win.webContents.send("kompas:private", !!config.isPrivate);
}

// Always on top, with no switch to turn it off (owner, 5 Oct 2026: "There shouldn't be a pin toggle at all").
// Electron's default "floating" level parks a Windows window just behind the taskbar, and on his Windows 11 the
// taskbar is not topmost, so Windows took the topmost flag away at the first click into a meeting. From
// "pop-up-menu" up it sits above the taskbar. Re-asserted on blur, show, restore, wake and every 250 ms, because
// another always-on-top window opened later (a meeting toolbar, another overlay) lands above it otherwise.
const PIN_LEVEL = "screen-saver";
function holdOnTop() {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(true, PIN_LEVEL);
  if (win.isVisible() && !win.isMinimized() && !picker) win.moveTop();
}
// Nothing may leave the panel unreachable: minimised with no taskbar button (Private), stranded off every screen
// after a monitor or resolution change, or a see-through window painting nothing after its page or the GPU died.
function ensureOnScreen() {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  if (onSomeScreen(b)) return;
  const wa = screen.getDisplayNearestPoint({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y) }).workArea;
  const width = Math.min(b.width, wa.width), height = Math.min(b.height, wa.height);
  suppressMagnet++;
  try { win.setBounds({ x: Math.round(wa.x + (wa.width - width) / 2), y: wa.y, width, height }); } finally { suppressMagnet--; }
  rememberBounds();
}
function bringBack() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.showInactive();
  ensureOnScreen();
  win.webContents.invalidate();
  holdOnTop();
}

function setPrefs(p) {
  if (typeof p.isPrivate === "boolean") { config.isPrivate = p.isPrivate; applyProtection(); }
  if (typeof p.opacity === "number" && p.opacity >= 0.15 && p.opacity <= 1) config.opacity = p.opacity;
  writeConfig();
  sendState();
  return prefs();
}

function openExternal(url) {
  try { if (new URL(url).protocol === "https:") shell.openExternal(url); } catch {}
}

function nudge(dx, dy) {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  win.setPosition(b.x + dx, b.y + dy);
}

// Ctrl+Enter is AI Answer from any window while the live call screen is open (owner, 5 Oct 2026: "Create a shortcut
// as Ctrl+Enter for Answer … in the Desktop version"): during a call the meeting app has the focus, not Kompas. It is
// held system-wide only while that screen is open, because while held no other app receives Ctrl+Enter (a chat's
// send key in Teams, Slack or Meet). The press is handed to the page's own Ctrl+Enter handler, so a typed question
// still wins over AI Answer.
const ANSWER_KEY = "CommandOrControl+Enter";
function holdAnswerKey(on) {
  const held = globalShortcut.isRegistered(ANSWER_KEY);
  if (on && !held) globalShortcut.register(ANSWER_KEY, () => {
    if (!win || win.isDestroyed()) return;
    win.webContents.executeJavaScript('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", ctrlKey: true, bubbles: true, cancelable: true }))').catch(() => {});
  });
  else if (!on && held) globalShortcut.unregister(ANSWER_KEY);
}
// Other keys only while Kompas is focused, never globalShortcuts, so the meeting app keeps its own: Ctrl+H hides
// or brings back, Ctrl+Shift+arrows move the window.
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
function watchKeys(wc) {
  wc.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown" || !input.control || input.alt || input.meta) return;
    if (!input.shift && String(input.key).toLowerCase() === "h") { e.preventDefault(); setCollapsed(!collapsed); }
    else if (input.shift && ARROWS[input.key]) { e.preventDefault(); nudge(ARROWS[input.key][0] * NUDGE, ARROWS[input.key][1] * NUDGE); }
  });
}

function createWindow() {
  win = new BrowserWindow({
    ...startBounds(),
    minWidth: MIN.width,
    minHeight: MIN.height,
    title: "Kompas",
    transparent: true,                     // backgrounds fade in CSS; the window itself must not paint a solid sheet
    icon: path.join(__dirname, "icon-256.png"),
    frame: false,
    backgroundColor: "#00000000",
    resizable: true,
    minimizable: true,                    // only so Windows reports Win+D / Win+M; a minimise is never kept (see "minimize" below)
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: hideTaskbar,              // the launch dialog's answer; see askTaskbar
    // skipTaskbar alone only drops the taskbar button: Task Manager still listed Kompas under Apps (owner, 7 Oct
    // 2026: "Still appears"). A Windows tool window is left out of the taskbar, Alt+Tab and that Apps list.
    ...(hideTaskbar && process.platform === "win32" ? { type: "toolbar" } : {}),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,              // a live call keeps listening while another window has focus
    },
  });
  applyProtection();
  const wc = win.webContents;
  wc.on("dom-ready", () => wc.insertCSS(PANEL_CSS));
  wc.loadURL(ORIGIN + appPathFor());
  wc.on("will-navigate", (e, url) => { if (!url.startsWith(ORIGIN + "/")) { e.preventDefault(); openExternal(url); } });
  wc.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: "deny" }; });
  watchKeys(wc);
  win.once("ready-to-show", () => { applyProtection(); win.show(); holdOnTop(); });
  win.on("blur", () => { holdOnTop(); setTimeout(holdOnTop, 120); });
  win.on("show", holdOnTop);
  win.on("restore", holdOnTop);
  // Owner, 5 Oct 2026: no minimise; Win+D and Win+M work as Ctrl+H for Kompas. A window Windows may not minimise is
  // skipped by Win+M and never hears about it, so the window stays minimisable and every minimise becomes the box at once.
  win.on("minimize", () => setTimeout(() => { if (!win || win.isDestroyed()) return; win.restore(); setCollapsed(true); bringBack(); }, 0));
  // 250 ms: another always-on-top window (his Chrome is one, so is a meeting toolbar) covered Kompas for up to a second at 1000.
  const pinTimer = setInterval(() => { if (win && !win.isDestroyed() && !win.isFocused()) holdOnTop(); }, 250);
  wc.on("render-process-gone", (_e, d) => { if (d.reason !== "clean-exit") setTimeout(() => { if (win && !win.isDestroyed()) { wc.reload(); bringBack(); } }, 500); });
  win.on("page-title-updated", (e) => e.preventDefault());
  win.on("moved", onMoved);
  win.on("resized", rememberBounds);
  if (process.env.KOMPAS_DEVTOOLS === "1") wc.openDevTools({ mode: "detach" });
  let closing = false;
  win.on("close", (e) => {
    if (!collapsed && !win.isMinimized()) { config.bounds = win.getBounds(); writeConfig(); }
    if (closing) return;
    e.preventDefault();
    closing = true;
    const finish = () => { if (win && !win.isDestroyed()) win.destroy(); };
    try {
      const flushed = session.defaultSession.flushStorageData && session.defaultSession.flushStorageData();
      Promise.resolve(flushed).then(finish, finish);
    } catch { finish(); }
    setTimeout(finish, 1200);
  });
  win.on("closed", () => { clearInterval(pinTimer); win = null; });
}

// Edge grips drawn by the page: a transparent frameless window cannot count on the OS resize border, so the
// drag is followed here from the cursor position until the pointer is released.
function resizeStart(edge) {
  if (!win || collapsed || !/^(n|s|e|w|ne|nw|se|sw)$/.test(edge)) return;
  resizing = { edge, start: win.getBounds(), cursor: screen.getCursorScreenPoint() };
}
function resizeMove() {
  if (!win || !resizing) return;
  const { edge, start, cursor } = resizing, p = screen.getCursorScreenPoint();
  const dx = p.x - cursor.x, dy = p.y - cursor.y;
  let { x, y, width, height } = start;
  if (edge.includes("e")) width = Math.max(MIN.width, start.width + dx);
  if (edge.includes("s")) height = Math.max(MIN.height, start.height + dy);
  if (edge.includes("w")) { width = Math.max(MIN.width, start.width - dx); x = start.x + start.width - width; }
  if (edge.includes("n")) { height = Math.max(MIN.height, start.height - dy); y = start.y + start.height - height; }
  win.setBounds({ x, y, width, height });
}
function resizeEnd() { if (resizing) { resizing = null; rememberBounds(); } }

// kompas://app/<file> is the live site. kompas://app/api/* goes to that same site, from this process,
// so the page never sees where the model lives and a cross-origin rule never gets in the way.
async function serve(req) {
  const url = new URL(req.url);
  if (url.host !== "app") return new Response("Not found", { status: 404 });
  if (url.pathname.includes("..")) return new Response("Not found", { status: 404 });
  const headers = {};
  for (const h of FORWARD_HEADERS) { const v = req.headers.get(h); if (v) headers[h] = v; }
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const rel = url.pathname === "/" ? "/index.html" : url.pathname;
  const isMarketFitApi = activeSite === "marketfit" && /^\/api\//.test(rel);
  if (isMarketFitApi && rel !== "/api/auth/refresh-token") {
    await desktopAuth.renew(false);
    const token = desktopAuth.token();
    if (token) headers.authorization = "Bearer " + token;
  }
  try {
    return await net.fetch(targetOrigin() + rel + url.search, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: isMarketFitApi ? "error" : "follow",
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Kompas could not reach " + targetOrigin() + ": " + (err && err.message || err) }),
      { status: 502, headers: { "content-type": "application/json" } });
  }
}

// The copilot page may use the microphone (audio only), hear the computer's output mix, and write to the
// clipboard. The camera stays off. Display capture exists only so Windows will open a loopback audio track;
// the handler answers it itself, so no share picker appears, and the page cannot choose a different source.
function lockDownSession() {
  const ses = session.defaultSession;
  const isCopilot = (wc) => !!win && !!wc && wc.id === win.webContents.id;
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    const types = (details && details.mediaTypes) || [];
    // getDisplayMedia on this Electron asks for "media" with no types. A microphone asks for audio.
    // A camera asks for video, and that stays denied.
    if (isCopilot(wc) && permission === "media") return cb(types.length === 0 || types.every(t => t === "audio"));
    if (isCopilot(wc) && permission === "display-capture") return cb(true);
    cb(isCopilot(wc) && permission === "clipboard-sanitized-write");
  });
  ses.setPermissionCheckHandler((wc, permission, _origin, details) => {
    if (!isCopilot(wc)) return false;
    if (permission === "display-capture") return true;
    return (permission === "media" && (details && details.mediaType) !== "video") || permission === "clipboard-sanitized-write";
  });
  ses.setDisplayMediaRequestHandler((_request, callback) => {
    if (!win || win.isDestroyed()) { callback({}); return; }
    desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((sources) => {
      const video = sources[0];
      // audio: "loopback" is the whole output mix. The screen source is only there because Windows will not
      // start that track without one; the page keeps the audio and labels it Them.
      callback(video ? { video, audio: "loopback" } : {});
    }).catch(() => callback({}));
  });
  ses.protocol.handle("kompas", serve);
}

// One user action = one capture. The native desktop chooses ONLY a window,
// preferring the uniquely named Windows Live Captions panel; no background
// polling, recording, full-screen grab, or reuse of an old frame.
function isWindowsLiveCaption(name) {
  return /^(?:windows\s+)?live[\s-]*captions?(?:$|[\s—-])/i.test(String(name || "").trim());
}
async function captionSnapshotOnce() {
  const sources = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 1600, height: 900 }, fetchWindowIcons: false });
  const windows = sources.filter(src => src.id && src.name && !/^Kompas(?:\s|$)/i.test(src.name));
  if (!windows.length) throw new Error("No capturable window was found. Open Windows Live Captions and retry.");
  const matched = windows.filter(w => isWindowsLiveCaption(w.name));
  // Never capture arbitrary foreground windows. The only allowed subject is
  // the uniquely identified Windows Live Captions panel; if Windows does not
  // expose that panel, fail closed rather than sending another app to OCR.
  if (matched.length !== 1) throw new Error("Windows Live Captions was not uniquely detected. Open Live Captions and try again; no other window was captured.");
  const target = matched[0];
  if (!target.thumbnail || target.thumbnail.isEmpty()) throw new Error("The selected window is blank or protected from capture");
  const jpeg = target.thumbnail.toJPEG(78);
  if (!jpeg.length || jpeg.length > 2200000) throw new Error("The chosen window image exceeds capture limits");
  return { image: "data:image/jpeg;base64," + jpeg.toString("base64"),
    source: "window", name: target.name, capturedAt: Date.now() };
}
function wireIpc() {
  ipcMain.on("kompas:collapse", (_e, on) => setCollapsed(typeof on === "boolean" ? on : !collapsed));
  ipcMain.on("kompas:close", () => win && win.close());
  ipcMain.handle("kompas:prefs", () => ({ collapsed, ...prefs() }));
  ipcMain.handle("kompas:set-prefs", (_e, p) => setPrefs(p || {}));
  ipcMain.on("kompas:place", openPicker);
  ipcMain.on("kompas:place-pick", (_e, i) => place(Number(i)));
  ipcMain.on("kompas:place-cancel", closePicker);
  ipcMain.on("kompas:resize-start", (_e, edge) => resizeStart(String(edge)));
  ipcMain.on("kompas:resize-move", resizeMove);
  ipcMain.on("kompas:resize-end", resizeEnd);
  ipcMain.on("kompas:screen", () => {});
  ipcMain.on("kompas:live", (_e, on) => holdAnswerKey(!!on));
  ipcMain.handle("kompas:get-private", () => !!config.isPrivate);
  ipcMain.handle("kompas:set-private", (_e, on) => setPrefs({ isPrivate: !!on }).isPrivate);
  ipcMain.handle("kompas:take-session", (event) => {
    if (!win || event.sender.id !== win.webContents.id ||
        !/^kompas:\/\/app\//i.test(String(event.senderFrame?.url || ""))) return null;
    const verified = takeVerifiedSession();
    if (!verified && pendingSession) beginChromeSignIn();
    return verified;
  });
  ipcMain.handle("kompas:refresh-auth", (event) => {
    if (!win || event.sender.id !== win.webContents.id) throw Error("Invalid auth caller");
    return desktopAuth.renew(true);
  });
  ipcMain.on("kompas:open-signin", (event) => {
    if (win && event.sender.id === win.webContents.id) beginChromeSignIn();
  });
  ipcMain.handle("kompas:capture-screen", async (event) => {
    if (!win || event.sender.id !== win.webContents.id || !/^kompas:\/\/app\/kompas\//i.test(String(event.senderFrame?.url || ""))) throw Error("Invalid screen capture caller");
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1600, height: 1000 } });
    const preferred = String(screen.getPrimaryDisplay().id);
    const chosen = sources.find(x => String(x.display_id) === preferred) || sources[0];
    if (!chosen?.thumbnail || chosen.thumbnail.isEmpty()) throw Error("No screen capture was available");
    const bytes = chosen.thumbnail.toJPEG(76);
    if (bytes.length < 1000 || bytes.length > 2800000) throw Error("Screen frame was unreadable or too large");
    return "data:image/jpeg;base64," + bytes.toString("base64");
  });
  ipcMain.handle("kompas:caption-once", (event) => {
    if (!win || event.sender.id !== win.webContents.id || !/^kompas:\/\/app\/kompas\//i.test(String(event.senderFrame?.url || ""))) throw new Error("Invalid caption capture caller");
    return captionSnapshotOnce();
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", async (_e, argv) => {
    const callback = desktopAuth.callback(argv);
    if (callback) {
      const accepted = await desktopAuth.acceptCallback(callback, pendingSession?.ownerId || "");
      if (accepted && win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore();
        win.show(); bringBack(); win.focus();
        if (win.webContents.isLoading()) return;
        deliverSession();
        win.webContents.send("kompas:auth-ready");
      } else if (!accepted) beginChromeSignIn();
      return;
    }
    let handed = sessionFromArgv(argv);
    if (ticketFromArgv(argv)) {
      try { handed = await sessionFromTicketArgv(argv); }
      catch { handed = null; beginChromeSignIn(); }
    }
    if (handed) {
      pendingSession = handed;
      if (handed.ownerId && (!desktopAuth.token() || desktopAuth.ownerId() !== handed.ownerId)) beginChromeSignIn();
      const nextSite = siteFor(handed);
      if (nextSite !== activeSite) {
        activeSite = nextSite;
        if (win && !win.isDestroyed()) win.webContents.loadURL(ORIGIN + appPathFor()).catch(() => {});
      }
    }
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show(); bringBack(); win.focus();
    if (win.webContents.isLoading()) return;
    deliverSession();
  });
  app.whenReady().then(async () => {
    hideTaskbar = await askTaskbar();
    const saved = readConfig();
    const opacity = typeof saved.opacity === "number" ? Math.min(1, Math.max(0.15, saved.opacity)) : 1;
    config = { onTop: true, isPrivate: typeof saved.isPrivate === "boolean" ? saved.isPrivate : true,
      bounds: saved.bounds || null, section: Number.isInteger(saved.section) ? saved.section : null,
      opacity, dock: typeof saved.dock === "string" && saved.dock ? saved.dock : null };
    desktopAuth.load();
    pendingSession = sessionFromArgv(process.argv);
    if (ticketFromArgv(process.argv)) {
      try { pendingSession = await sessionFromTicketArgv(process.argv); }
      catch { pendingSession = null; /* Never adopt unverified raw ticket contents. */ }
    }
    // The installer page opens marketfit-kompas://open without an interview
    // payload. Route that first launch into MarketFit instead of perfACT.
    activeSite = pendingSession ? siteFor(pendingSession) : "marketfit";
    Menu.setApplicationMenu(null);
    lockDownSession();
    wireIpc();
    createWindow();
    // Reuse the browser login already present. On first install the shell has
    // no cookie jar, so initiate a state-bound handoff only when renewal fails.
    void desktopAuth.renew(false).then(ok => { if (!ok && !desktopAuth.token()) beginChromeSignIn(); });
    const later = () => setTimeout(bringBack, 400);
    for (const ev of ["display-removed", "display-added", "display-metrics-changed"]) screen.on(ev, later);
    for (const ev of ["resume", "unlock-screen"]) powerMonitor.on(ev, later);
    app.on("child-process-gone", (_e, d) => { if (d.type === "GPU") later(); });
  });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => globalShortcut.unregisterAll());
}
