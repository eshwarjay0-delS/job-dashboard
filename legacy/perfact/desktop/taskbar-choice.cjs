"use strict";

// Hide-from-taskbar is asked once unless the person checks Remember.
// A remembered choice is applied on the next launch with no dialog.

function rememberedTaskbar(saved) {
  if (saved && saved.hideTaskbarRemembered === true && typeof saved.hideTaskbar === "boolean") {
    return { ask: false, hide: saved.hideTaskbar };
  }
  return { ask: true, hide: null };
}

function taskbarAnswer(response, checkboxChecked) {
  return { hide: response === 0, remember: checkboxChecked === true };
}

module.exports = { rememberedTaskbar, taskbarAnswer };
