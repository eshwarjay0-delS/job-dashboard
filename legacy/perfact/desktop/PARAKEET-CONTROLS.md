# Parakeet controls, observed 30 Sep 2026

What a real mouse click did, and what could not be clicked. Nothing here is inferred from a screenshot alone.

The window was `ParakeetAI` (process file name is U+2800, a blank). First look, display affinity 0x0, so the screen capture showed the panel. The OS window was nearly the full work area, about (15,15) 1890×990, with the panel drawn in the top left of that window.

## Seen, then clicked

- Title row, left to right after the parrot and wordmark: infinity, a shrink-arrows icon, a four-way move icon, a vertical ellipsis, a red close button.
- Under that: a search field ("Search by title or description"), a sort button, two session cards (each with a card menu, Interview, Transcript, Start Session), then View in Dashboard and Create Session.

Click at the shrink-arrows icon (about 452,55 physical). The panel left the screen capture. The OS window rectangle did not change. A small box was not found in the following full-screen capture. Within the same minute the process exited and `ParakeetAI-Setup-3.9.97.exe` was running (an update already downloaded at 14:20). The click and the updater happened together, so this does not prove the shrink icon is what quit the app.

## Could not click

After relaunch the window came back with display affinity 0x11, so screen capture and PrintWindow showed nothing, and UI Automation exposed no controls inside the window. `SetWindowDisplayAffinity` from another process returned false (Windows only allows that call on a window the caller owns), so the protection could not be turned off to look again. Further launches did not stay up long enough for a second pass.

Not clicked, because of that: the infinity icon, the move icon and whatever blur it opens, the ellipsis menu and its items, search, sort, a session card menu, Start Session, View in Dashboard, Create Session, and the close button. The six-section layout was not measured. Kompas uses two rows of three because that is the layout he described, not because this scan confirmed it.
