"use strict";

// Screen Answer prefers the Windows Live Captions window, then another
// window, then the primary screen. Call audio does not use this order:
// WASAPI loopback stays on a screen source in the display-media handler.

function isWindowsLiveCaption(name) {
  return /^(?:windows\s+)?live[\s-]*captions?(?:$|[\s—-])/i.test(String(name || "").trim());
}

function sourceKind(src) {
  if (!src || typeof src !== "object") return "";
  if (src.kind === "window" || src.kind === "screen") return src.kind;
  const id = String(src.id || "");
  if (id.startsWith("window:")) return "window";
  if (id.startsWith("screen:")) return "screen";
  return "";
}

function usable(src) {
  const thumb = src && src.thumbnail;
  if (!thumb || typeof thumb.isEmpty !== "function") return true;
  return !thumb.isEmpty();
}

function chooseCaptureSource(sources, options = {}) {
  const list = Array.isArray(sources) ? sources.filter(Boolean) : [];
  const windows = list.filter(src =>
    sourceKind(src) === "window" && src.id && src.name && !/^Kompas(?:\s|$)/i.test(String(src.name)));
  const captions = windows.filter(src => isWindowsLiveCaption(src.name) && usable(src));
  if (captions.length === 1) return { source: captions[0], kind: "caption" };
  const rest = windows.filter(src => !isWindowsLiveCaption(src.name) && usable(src));
  if (rest.length) return { source: rest[0], kind: "window" };
  const screens = list.filter(src => sourceKind(src) === "screen" && src.id && usable(src));
  const preferred = options.primaryDisplayId != null && options.primaryDisplayId !== ""
    ? screens.find(src => String(src.display_id) === String(options.primaryDisplayId))
    : null;
  const screen = preferred || screens[0] || null;
  return screen ? { source: screen, kind: "screen" } : { source: null, kind: "none" };
}

module.exports = { isWindowsLiveCaption, chooseCaptureSource };
