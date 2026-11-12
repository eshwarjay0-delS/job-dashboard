"use strict";

// A yes is stored and the next launch does not ask again.
// A no is not stored. The next launch asks again.

function rememberedTaskbar(saved) {
  if (saved && saved.hideTaskbarRemembered === true && saved.hideTaskbar === true) {
    return { ask: false, hide: true };
  }
  return { ask: true, hide: null };
}

function taskbarAnswer(response, _checkboxChecked) {
  const hide = response === 0;
  return { hide, remember: hide === true };
}

module.exports = { rememberedTaskbar, taskbarAnswer };
