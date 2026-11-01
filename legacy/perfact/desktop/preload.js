// Bridge and chrome for the copilot page. Prevents Kompas from looking like a website inside a window: the page
// gets one title bar (Kompas, the session, its timer and tools, Private, Keep on top, Hide, Quit), edge grips
// that resize the window, and a small mark for Hide. The live screen's own header controls move into that bar
// rather than stacking a second header under it.
// The page can reach nothing but its own window: no file system, no keys. systemAudio is true so the speaker
// control stays visible: the microphone is You, and the computer's output mix (answered in main.js) is Them.
const { contextBridge, ipcRenderer } = require("electron");

let screenName = "", bar = null;

contextBridge.exposeInMainWorld("kompasDesktop", {
  version: "0.8.3",
  systemAudio: true,
  captureCaptionOnce: () => ipcRenderer.invoke("kompas:caption-once"),
  setScreen: (name) => { screenName = String(name); ipcRenderer.send("kompas:screen", screenName); paintScreen(); },
  setLive: (on) => ipcRenderer.send("kompas:live", !!on),
  getPrivate: () => ipcRenderer.invoke("kompas:get-private"),
  setPrivate: (on) => ipcRenderer.invoke("kompas:set-private", !!on),
  onPrivate: (fn) => { ipcRenderer.on("kompas:private", (_e, on) => fn(!!on)); },
  takeSession: () => ipcRenderer.invoke("kompas:take-session"),
  onSession: (fn) => { ipcRenderer.on("kompas:session", (_e, s) => fn(s)); },
});

const ICON = {
  pin: '<svg viewBox="0 0 16 16"><path d="M6 2h4l-.5 4 2.5 2.5H4L6.5 6z"/><path d="M8 8.5V14"/></svg>',
  mic: '<svg viewBox="0 0 16 16"><rect x="6" y="2" width="4" height="7" rx="2"/><path d="M4.5 7.5a3.5 3.5 0 0 0 7 0M8 11.5V14M5.5 14h5"/></svg>',
  speaker: '<svg viewBox="0 0 16 16"><path d="M2.5 6.2h2.2L8.2 3.2v9.6L4.7 9.8H2.5z"/><path d="M10.2 6a2.6 2.6 0 0 1 0 4M11.8 4.4a4.6 4.6 0 0 1 0 7.2"/></svg>',
  hide: '<svg viewBox="0 0 16 16"><path d="M9.5 2.5v4h4M6.5 13.5v-4h-4M9.5 6.5l4.5-4.5M6.5 9.5L2 14"/></svg>',
  move: '<svg viewBox="0 0 16 16"><path d="M8 1.5v13M1.5 8h13M8 1.5L6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2"/></svg>',
  close: '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
};

function el(tag, attrs = {}, html = "") {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (html) n.innerHTML = html;
  return n;
}

function paintScreen() {
  if (!bar) return;
  document.documentElement.dataset.kdScreen = screenName;
  bar.classList.toggle("kd-live", screenName === "copilot");
}

function applyFade(opacity) {
  const a = Math.min(1, Math.max(0.15, Number(opacity) || 1));
  document.documentElement.style.setProperty("--panel-a", String(a));
  const input = document.getElementById("kdFade");
  if (input && document.activeElement !== input) input.value = String(Math.round(a * 100));
}

function paintState(s) {
  document.documentElement.classList.toggle("kd-collapsed", !!s.collapsed);
  const tgl = document.getElementById("kdPrivate"), pin = document.getElementById("kdPin");
  if (tgl) tgl.checked = !!s.isPrivate;
  if (pin) { pin.classList.toggle("on", !!s.onTop); pin.setAttribute("aria-pressed", String(!!s.onTop)); }
  if (s && typeof s.opacity === "number") applyFade(s.opacity);
}

function build() {
  document.documentElement.classList.add("kd");
  bar = el("header", { id: "kdBar", class: "kd-bar" });
  const left = el("div", { class: "kd-left" });
  const live = el("div", { class: "kd-livetools" });
  // the live screen's header controls, moved here so there is one header; app.js still finds them by id
  const back = document.getElementById("exitCopilot");
  if (back) left.append(back);
  left.append(el("span", { class: "brand-dot" }), el("span", { class: "kd-word" }, "Kompas"));
  const chip = document.getElementById("personaChip");
  if (chip) left.append(chip);
  for (const sel of [".bar-top .rec", ".bar-top .more-wrap"]) {
    const n = document.querySelector(sel);
    if (n) live.append(n);
  }
  // Desktop mode: microphone and computer audio sit on the live row, next to Start.
  // They are this computer's microphone and this computer's speakers. Nothing to pick.
  const actions = document.querySelector("#overlay .bar-actions");
  const mic = document.getElementById("micBtn"), sys = document.getElementById("sysBtn");
  function sourceIcon(btn, svg) {
    if (!btn) return;
    const lvl = btn.querySelector(".lvl");
    btn.innerHTML = svg;
    if (lvl) btn.append(lvl);
    btn.classList.remove("hidden");
  }
  sourceIcon(mic, ICON.mic);
  sourceIcon(sys, ICON.speaker);
  if (mic) mic.title = "Microphone — this computer";
  if (sys) sys.title = "Computer audio — this computer's speakers";
  if (actions) {
    if (sys) actions.insertBefore(sys, actions.firstChild);
    if (mic) actions.insertBefore(mic, actions.firstChild);
  }
  const right = el("div", { class: "kd-right" });
  const fade = el("label", { class: "kd-fade", title: "Opacity. The panel fades. The letters stay dark. Double-click to make it solid again." },
    '<span>Opacity</span><input type="range" id="kdFade" min="15" max="100" step="5" value="100" />');
  const priv = el("label", { class: "kd-private", title: "Private: Zoom, Teams, Meet, OBS and screenshots cannot see this window" },
    '<span>Private</span><input type="checkbox" class="tgl" id="kdPrivate" />');
  const hide = el("button", { class: "kd-ico", id: "kdHide", title: "Hide to a small box (Ctrl+H)" }, ICON.hide);
  const move = el("button", { class: "kd-ico", id: "kdMove", title: "Place Kompas: pick one of six screen sections" }, ICON.move);
  const close = el("button", { class: "kd-ico kd-close", id: "kdClose", title: "Quit Kompas" }, ICON.close);
  right.append(fade, priv, hide, move, close);   // no pin: Kompas is always on top (owner, 5 Oct 2026)
  bar.append(left, live, el("span", { class: "kd-spacer" }), right);
  document.body.prepend(bar);

  const mark = el("div", { id: "kdMark", class: "kd-mark" },
    '<button id="kdMarkOpen" title="Bring Kompas back (Ctrl+H)"><span class="brand-dot"></span><span class="kd-word">Kompas</span></button>');
  document.body.append(mark);

  for (const edge of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
    const g = el("div", { class: "kd-grip kd-grip-" + edge, "data-edge": edge });
    g.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      ipcRenderer.send("kompas:resize-start", edge);
      let queued = false;
      const move = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; ipcRenderer.send("kompas:resize-move"); }); };
      const end = () => { g.removeEventListener("pointermove", move); ipcRenderer.send("kompas:resize-end"); };
      g.addEventListener("pointermove", move);
      g.addEventListener("pointerup", end, { once: true });
      g.addEventListener("lostpointercapture", end, { once: true });
    });
    document.body.append(g);
  }

  document.title = "Kompas";
  const fadeInput = document.getElementById("kdFade");
  const setFade = (opacity) => { applyFade(opacity); ipcRenderer.invoke("kompas:set-prefs", { opacity }); };
  fadeInput.addEventListener("input", (e) => setFade(Number(e.target.value) / 100));
  fade.addEventListener("dblclick", () => { fadeInput.value = "100"; setFade(1); });
  document.getElementById("kdPrivate").addEventListener("change", (e) => ipcRenderer.invoke("kompas:set-prefs", { isPrivate: e.target.checked }));
  hide.addEventListener("click", () => ipcRenderer.send("kompas:collapse", true));
  move.addEventListener("click", () => ipcRenderer.send("kompas:place"));
  close.addEventListener("click", () => ipcRenderer.send("kompas:close"));
  document.getElementById("kdMarkOpen").addEventListener("click", () => ipcRenderer.send("kompas:collapse", false));

  ipcRenderer.on("kompas:state", (_e, s) => paintState(s));
  ipcRenderer.invoke("kompas:prefs").then(paintState);
  paintScreen();
}

window.addEventListener("DOMContentLoaded", build);
