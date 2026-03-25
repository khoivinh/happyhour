# 2026-03-25 — Drag-and-Drop Investigation

## Problem

Touch drag on mobile is unreliable. The same tile can be easy to drag once, then nearly impossible to drag again. The issue persists after fixing state-update interference (cloud sync, clock tick, SortableContext array refs).

## Git history of drag-related changes

| Commit | Date | What changed | Result |
|--------|------|-------------|--------|
| `9df39e9` | early | PointerSensor + TouchSensor (350ms delay, 15px tolerance) | Unpredictable drag on mobile |
| `fa4ffc9` | 2026-02-22 | **Removed listeners from wrapper**, grip handle only. PointerSensor (8px) + TouchSensor (150ms). Added `touch-none` to grip handle. | Scrolling improved, but lost tile-body drag |
| `7a97b0b` | 2026-03-21 | **Re-added listeners to wrapper** intentionally. Created `HandleTouchSensor` (150ms, grip only) + `TileTouchSensor` (350ms, tile body excl. `data-no-drag`). Kept PointerSensor. | Tile-body drag restored but still unreliable |
| `371382a` | 2026-03-24 | **Replaced PointerSensor with MouseSensor** to fix "touch/mouse event conflicts causing unpredictable drag." Raised TileTouchSensor delay to 500ms. Added `touch-action: manipulation` to tiles in index.css. | MouseSensor avoids PointerSensor issues but introduces synthetic mouse event problem |
| `092bfbc` | 2026-03-25 | Paused clock tick during drag, stabilized zones array ref, cloud sync equality checks. | State-update interference fixed, but core activation problem remains |

## Key design decisions (intentional, do NOT revert)

1. **Listeners on both wrapper AND grip handle** — enables two drag activation methods:
   - Grip handle: `HandleTouchSensor` (150ms delay) via `data-drag-handle`
   - Tile body: `TileTouchSensor` (500ms delay) excl. `data-no-drag` elements
   - Reverting to grip-handle-only was tried in `fa4ffc9` and lost tile-body drag

2. **MouseSensor instead of PointerSensor** — PointerSensor was tried and caused "unpredictable drag on mobile" (replaced in `371382a`). Cannot simply switch back.

3. **`touch-none` on grip handle** — added in `fa4ffc9` to prevent browser from fighting dnd-kit. May need to be reconsidered (see root cause below).

4. **`touch-action: manipulation` on tiles** — added in `371382a` via index.css. Allows taps/gestures but prevents browser panning during touch.

## Root cause analysis

The primary issue is **MouseSensor's `onMouseDown` handler fires on mobile** due to synthetic mouse events:

1. User touches tile → browser fires `touchstart`
2. HandleTouchSensor/TileTouchSensor start their 150ms/500ms delay timers
3. Browser fires synthetic `mousedown` (~0-100ms after touch)
4. MouseSensor starts tracking pointer distance (8px threshold)
5. If finger wobbles ≥8px during the hold period, MouseSensor activates first
6. dnd-kit cancels pending TouchSensor activations
7. MouseSensor's drag doesn't work properly on touch (no `touchmove` tracking)
8. Drag fails silently

The intermittent nature ("works once then stops") is because:
- After a successful touch drag, body `touch-action` is reset to `""` in `handleDragEnd`
- The timing of synthetic mouse events varies by browser/OS
- Whether the user's finger wobbles 8px during the hold is random

## Additional issues found

- **`touch-none` on grip handle** conflicts with tile's `touch-action: manipulation` — may prevent browser from properly routing touch events
- **~60-70% of mobile tile is `data-no-drag`** (city name + time display) — intentional, but means TileTouchSensor only activates on margins and gaps
- **SVG inside grip handle** — `target.closest("[data-drag-handle]")` should still work (closest() traverses up from SVG to parent div), but worth monitoring

## Proposed fix (not yet implemented)

Create a `DesktopMouseSensor` that suppresses activation when a recent touch event was detected:

```ts
let recentTouchTimestamp = 0;

class DesktopMouseSensor extends MouseSensor {
  static activators = [{
    eventName: "onMouseDown" as const,
    handler: ({ nativeEvent }: { nativeEvent: MouseEvent }) => {
      // Synthetic mouse events from touch fire within ~500ms of touchstart
      if (Date.now() - recentTouchTimestamp < 1000) return false;
      return true;
    },
  }];
}
```

Plus a passive `touchstart` listener to track the timestamp. This preserves:
- Desktop mouse drag via DesktopMouseSensor
- Mobile grip drag via HandleTouchSensor (150ms)
- Mobile tile body drag via TileTouchSensor (500ms)

Also remove `touch-none` from grip handle — let tile's `touch-action: manipulation` apply uniformly.

## Files involved

- `client/src/components/time-zone-converter.tsx` — sensor config, custom sensors, SortableClockItem listeners
- `client/src/components/digital-clock.tsx` — grip handle DOM, `data-drag-handle`, `touch-none`, `data-no-drag` placement
- `client/src/index.css` — `touch-action: manipulation` on `[data-testid^="draggable-zone-"]`
