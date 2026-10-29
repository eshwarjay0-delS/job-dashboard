# Kompas Tab Capture (companion extension)

Screen Answer without a share picker. Tab capture needs no share dialog:
the extension captures a tab it may access, so the picker never appears.

Use (one-time install, then picker-free forever):
1. Load this folder unpacked in Chrome (Extensions → Developer mode → Load unpacked).
2. On the tab showing the question, click the extension button. That arms the tab.
3. In Kompas, press Screen Answer. The answer lands in the card, no dialog, no picker.

Rules: one frame, one use (the page consumes and clears it); frames older
than 10 minutes are dropped; the frame is a JPEG data URL, the same shape
the page's own capture returns, so the existing extraction and grounded
answer pipeline runs unchanged. Tab capture only: it captures a tab, not
the whole screen, and a protected tab comes back blank like any capture.

Status: logic is unit-pinned in the repo's screen suites, but it has NOT
been proven in a real Chrome yet — the first unpacked load is the proof.
