/* Kompas follows MarketFit's theme when it is opened on MarketFit's address.

   The owner, 12 Oct 2026, with a screenshot of MarketFit in its night theme: "make sure the night mode follows to the
   kompas in job dashboard as well. And even in the session of kompas give the option of paper & ink."

   THE MISTAKE THIS FILE PREVENTS. He chose night in MarketFit because a bright page hurts his eyes, clicked Kompas in the
   same sidebar, and got a paper-white page: Kompas kept its own setting and never looked at MarketFit's. The opposite
   mistake would be as bad: forcing MarketFit's theme on every load, so the choice he makes inside Kompas never holds.

   So the theme is carried over when MarketFit's theme CHANGES, once. After that the choice made inside Kompas (the
   session's menu has Light and Dark) stays until MarketFit's theme changes again.

   It runs before the page paints and before app.js. It writes the same setting app.js already reads ("perfact.theme"),
   so nothing in app.js changes. On Kompas's own address there is no MarketFit setting, and this file does nothing. */
(() => {
  const MF_KEY = "jd_theme_v3", KOMPAS_KEY = "perfact.theme", SEEN_KEY = "perfact.themeFrom";

  // What MarketFit is showing, by its own rule (job-dashboard: src/app/theme-provider.tsx). "" when there is no MarketFit here.
  function marketFitTheme(raw, deviceDark) {
    let s = null;
    try { s = JSON.parse(raw || "null"); } catch { return ""; }
    if (!s || typeof s !== "object" || Array.isArray(s)) return "";
    if (s.template === "pro") return "dark";                        // that layout is dark whatever the mode
    if (s.mode === "dark") return "dark";
    if (s.mode === "system") return deviceDark ? "dark" : "light";
    return "light";
  }
  // Carried once for each change of MarketFit's theme. `seen` is the MarketFit theme last carried; `own` is Kompas's choice.
  function carry(mfTheme, seen, own) {
    const mine = own === "dark" ? "dark" : "light";
    if (mfTheme !== "dark" && mfTheme !== "light") return { theme: mine, seen: seen || "", changed: false };
    return mfTheme !== seen ? { theme: mfTheme, seen: mfTheme, changed: true } : { theme: mine, seen, changed: false };
  }
  // What the switch in the sidebar writes: Kompas's own choice, and MarketFit's setting when MarketFit is on this address
  // (its accent and layout are kept; only the mode changes). `seen` is set so the next load has nothing left to carry.
  function switched(mfRaw, dark) {
    const out = { kompas: JSON.stringify(dark ? "dark" : "light"), mf: null, seen: null };
    if (!marketFitTheme(mfRaw, false)) return out;
    const s = JSON.parse(mfRaw); s.mode = dark ? "dark" : "light";
    out.mf = JSON.stringify(s); out.seen = marketFitTheme(out.mf, false);
    return out;
  }
  globalThis.KompasThemeFollow = { MF_KEY, KOMPAS_KEY, SEEN_KEY, marketFitTheme, carry, switched };
  if (typeof document === "undefined" || typeof localStorage === "undefined") return;

  function run() {
    try {
      const root = document.documentElement;
      const mf = marketFitTheme(localStorage.getItem(MF_KEY), !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches));
      root.classList.toggle("mf", !!mf);                            // on MarketFit's address the night is MarketFit's night (mf-night.css)
      if (!mf) return;
      let own = "light";
      try { own = JSON.parse(localStorage.getItem(KOMPAS_KEY) || '"light"') === "dark" ? "dark" : "light"; } catch {}
      const next = carry(mf, localStorage.getItem(SEEN_KEY) || "", own);
      if (next.changed) { localStorage.setItem(KOMPAS_KEY, JSON.stringify(next.theme)); localStorage.setItem(SEEN_KEY, next.seen); }
      if (!window.kompasDesktop) root.classList.toggle("theme-dark", next.theme === "dark");   // before the first paint; app.js sets the same when it loads
      if (typeof window.applyLook === "function") window.applyLook();
    } catch { /* a blocked store: Kompas keeps the look it has */ }
  }
  run();
  window.addEventListener("storage", (e) => { if (e.key === MF_KEY) run(); });   // MarketFit's theme changed in another tab
  window.addEventListener("pageshow", (e) => { if (e.persisted) run(); });       // came back with the Back button

  /* The switch, beside the name in the sidebar. Owner, 12 Oct 2026, with a picture of that corner: "Give me that option
     as well. to toggle." MarketFit has its switch in the same corner; Kompas had none outside the session's menu.
     On MarketFit's address it is the same switch: it changes MarketFit's theme too, so the two never disagree.
     Not shown in the desktop window, where app.js keeps the paper theme and a switch would do nothing. */
  const SUN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const CSS = ".theme-tgl{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--line-strong);border-radius:9px;background:var(--surface);color:var(--gold);cursor:pointer}" +
    ".theme-tgl:hover{background:var(--surface-2);color:var(--gold-deep)}.theme-tgl:focus-visible{outline:2px solid var(--spot);outline-offset:2px}.side-brand{padding-right:14px}";
  function set(dark) {
    const root = document.documentElement;
    try {
      const next = switched(localStorage.getItem(MF_KEY), dark);
      localStorage.setItem(KOMPAS_KEY, next.kompas);
      if (next.mf) { localStorage.setItem(MF_KEY, next.mf); localStorage.setItem(SEEN_KEY, next.seen); }   // MarketFit is on this address: its theme changes with this one
    } catch { /* a blocked store: the page still changes for this visit */ }
    root.classList.toggle("theme-dark", dark);
    if (typeof window.applyLook === "function") window.applyLook();
  }
  function mount() {
    const brand = document.querySelector(".side-brand");
    if (!brand || window.kompasDesktop || document.getElementById("themeToggle")) return;
    const style = document.createElement("style"); style.textContent = CSS; document.head.append(style);
    const button = document.createElement("button");
    button.type = "button"; button.id = "themeToggle"; button.className = "theme-tgl";
    const paint = () => {
      const dark = document.documentElement.classList.contains("theme-dark");
      button.innerHTML = dark ? SUN : MOON;
      button.title = dark ? "Paper theme" : "Night theme";
      button.setAttribute("aria-label", dark ? "Switch to Paper theme" : "Switch to Night theme");
    };
    button.addEventListener("click", () => set(!document.documentElement.classList.contains("theme-dark")));
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });   // the session's menu changes it too
    paint(); brand.append(button);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
