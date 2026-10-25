// Where a small menu goes so a person can actually read and tap it.
//
// The bug this fixes, reported 24 Oct 2026 from two Android screenshots of
// /dashboard/mail: the recruiter "..." menu opened as a blank white card,
// with only a fragment of an item ("s.com is my") peeking out. The menu
// was position:absolute right:0 inside a thread fold, and the button sits
// near the left edge of that fold. So the menu stretched left, past the
// fold, and the fold's overflow-y:auto (which computes overflow-x to
// auto) clipped it to the fold box. The left part of every item, where
// the words start, was outside the fold and invisible.
//
// The fix is to place the menu against the viewport, not the fold: it is
// positioned fixed, clamped inside the viewport with a 12px margin, and
// flipped above the button when it would run off the bottom. The menu
// stays a DOM child of its button, so outside-click closing still works,
// but no scroll container can clip it any more.

export type Rect = { left: number; top: number; bottom: number; width: number }
export type Viewport = { width: number; height: number }
export type MenuSize = { width: number; height: number }
export type MenuPosition = { left: number; top: number; width: number }

export const MENU_MARGIN = 12

export function clampMenuPosition(anchor: Rect, viewport: Viewport, menu: MenuSize): MenuPosition {
  const width = Math.max(0, Math.min(menu.width, viewport.width - MENU_MARGIN * 2))
  const left = Math.max(MENU_MARGIN, Math.min(anchor.left, viewport.width - width - MENU_MARGIN))
  const below = anchor.bottom + 6
  const above = anchor.top - menu.height - 6
  const top = below + menu.height <= viewport.height - MENU_MARGIN
    ? below
    : Math.max(MENU_MARGIN, above)
  return { left, top, width }
}
