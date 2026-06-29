# svgMap compatibility — Phase 1

Phase 1 adds dom-pan-zoom APIs needed to replace svg-pan-zoom in [svgMap](https://github.com/stephanwagner/svgMap). Changes are on branch `feat/svgMap-compatibility-high-relevance` as seven atomic commits (highest relevance first).

---

## 1. `resize()` + `adjustMinZoomForBounds()` (`85d1cf1`)

**Problem:** svg-pan-zoom had `resize()`. svgMap calls it when `resetZoomOnResize` is true — a `ResizeObserver` on the map wrapper triggers `mapPanZoom.resize()` then reset. dom-pan-zoom had no equivalent, and its init logic permanently overwrote `options.minZoom` when `bounds` was set, so there was no way to recalculate on layout change.

**What changed:**

- **`baseMinZoom` / `baseMaxZoom`** — store the user's original limits before bounds adjustment.
- **`adjustMinZoomForBounds()`** — extracted the init-time math that raises `minZoom` so the content fits the wrapper (`contain` vs `cover`).
- **`resize()`** — re-runs that calculation, clamps the current zoom to the new limits, and reapplies the transform instantly.

**Why it matters for svgMap:** Without this, resizing the map container would leave stale zoom limits and broken pan bounds.

---

## 2. `reset()` (`430cde3`)

**Problem:** svg-pan-zoom's `reset()` restores the initial view. svgMap uses it for the zoom-reset button, continent "World" selection, and as the first step before continent zoom.

**What changed:** New method that restores initial zoom and pan:

```javascript
reset(true)                          // instant reset to defaults
reset({ zoom: 1.9, instant: true })  // override zoom/pan
```

It reads from constructor options (`initialZoom`, `initialPanX/Y`, `center`), applies zoom first, then centers or pans, then calls `setPosition`. Fires `onZoom` and `onPan`.

**Why it matters for svgMap:** Direct replacement for `this.mapPanZoom.reset()` in `zoomMap('reset')` and `zoomContinent()`.

---

## 3. `zoomToAt()` + `getContentPointOffsetToCenter()` (`54fa992`)

**Problem:** svg-pan-zoom's `zoomAtPoint(zoom, { x, y })` zooms to a level while keeping a point fixed on screen. svgMap uses this for:

- **Continent selector** — e.g. Africa at `{ x: 454, y: 250 }` in SVG viewBox space
- **`initialPan`** — `zoomAtPointBy(initialZoom, initialPan)`

dom-pan-zoom only had `zoomTo()`, which zooms toward the **center** of the wrapper, not an arbitrary point.

**What changed:**

- **`getContentPointOffsetToCenter(contentX, contentY)`** — same math as wheel zoom (`getEventOffsetToCenter`), but for a point in the panZoom element's coordinate space (pixels from top-left of the unscaled element).
- **`zoomToAt(zoom, point, instant)`** — zooms to `zoom` while keeping that point fixed, using the existing `adjustPositionByZoom()` logic.

Supports two coordinate modes:

```javascript
zoomToAt(1.9, { x: 454, y: 250 })                // pixels in content space
zoomToAt(1.9, { x: 22.7, y: 25, percent: true }) // percent of content size
```

**Why it matters for svgMap:** Continent presets and `initialPan` can be mapped from SVG viewBox coords to content pixels, then passed here instead of svg-pan-zoom's `zoomAtPoint`.

---

## 4. `panEnabled` and `zoomEnabled` (`73d7ae8`)

**Problem:** svg-pan-zoom has `panEnabled` and `zoomEnabled`. svgMap maps `allowInteraction: false` to both, disabling user drag/wheel while keeping programmatic zoom (buttons) working.

**What changed:**

- Two new options, both default `true`.
- **Event gating only** — drag, wheel, and pinch handlers check these flags; `zoomIn()`, `zoomTo()`, `reset()`, etc. are **not** blocked.
- **`updateInteractionCursor()`** — sets `cursor: grab` only when `panEnabled` is true; restores default cursor otherwise.

**Why it matters for svgMap:** One-line mapping: `panEnabled: allowInteraction, zoomEnabled: allowInteraction`.

---

## 5. `mouseWheelRequiresKey` (`627576e`)

**Problem:** svgMap's `mouseWheelZoomWithKey` option shows a "press ALT/COMMAND to zoom" notice and only allows wheel zoom when a modifier key is held. svg-pan-zoom didn't handle this natively either — svgMap layered its own key tracking via a `svgMap-zoom-key-pressed` body class — but dom-pan-zoom's wheel handler always called `preventDefault()`, which would block page scroll even when zoom wasn't intended.

**What changed:**

- New option `mouseWheelRequiresKey`, default `false`.
- **`isMouseWheelZoomAllowed(ev)`** helper:
  - `false` → wheel zoom always allowed (existing behavior)
  - `true` → requires alt, control, meta, or shift on the event
  - **function** → custom check, e.g. `() => document.body.classList.contains('svgMap-zoom-key-pressed')`
- When not allowed, the wheel handler **returns early without `preventDefault`**, so the page can scroll normally.

**Why it matters for svgMap:** svgMap can pass a function that checks its existing key UI, without duplicating wheel logic.

---

## 6. `dblClickZoomEnabled` (`e8e440b`)

**Problem:** svgMap exposes `dblClickZoomEnabled` (default `true`) and passes it to svg-pan-zoom. dom-pan-zoom had no double-click handler.

**What changed:**

- New option `dblClickZoomEnabled`, default `false` (conservative default for generic dom-pan-zoom users).
- `dblclick` listener on the wrapper: when enabled and `zoomEnabled` is true, zooms in by one `zoomStep` at the cursor position (same focal-point math as wheel zoom).

**Why it matters for svgMap:** Direct mapping: `dblClickZoomEnabled: this.options.dblClickZoomEnabled`.

---

## 7. README documentation (`76093ee`)

**Problem:** The new API wasn't documented; the README also had a few inaccuracies (`zoomWheelSpeed` vs actual `zoomSpeedWheel`, `bounds` default listed as `cover` vs code's `'contain'`).

**What changed:** Documented all new options and methods (`resize`, `reset`, `zoomToAt`, `panEnabled`, `zoomEnabled`, `mouseWheelRequiresKey`, `dblClickZoomEnabled`) and corrected the existing option names/defaults.

---

## Summary: svg-pan-zoom → dom-pan-zoom mapping

| svgMap / svg-pan-zoom | dom-pan-zoom (Phase 1) |
|-----------------------|------------------------|
| `resize()` | `resize()` |
| `reset()` | `reset()` |
| `zoomAtPoint(z, point)` | `zoomToAt(z, point)` |
| `zoomAtPointBy(z, point)` | `zoomToAt(z, point)` after computing target zoom |
| `panEnabled` / `zoomEnabled` | same option names |
| `mouseWheelZoomWithKey` | `mouseWheelRequiresKey: () => …` |
| `dblClickZoomEnabled` | same option name |

---

## svgMap integration preview (Phase 2)

```javascript
this.mapPanZoom = new domPanZoom({
  wrapperElement: this.mapWrapper,
  panZoomElement: this.mapImage,
  minZoom: this.options.minZoom,
  maxZoom: this.options.maxZoom,
  bounds: 'contain',
  center: true,
  initialZoom: this.options.initialZoom,
  zoomSpeedWheel: this.options.zoomScaleSensitivity,
  panEnabled: this.options.allowInteraction,
  zoomEnabled: this.options.allowInteraction,
  dblClickZoomEnabled: this.options.dblClickZoomEnabled,
  mouseWheelRequiresKey: this.options.mouseWheelZoomWithKey
    ? () => document.body.classList.contains('svgMap-zoom-key-pressed')
    : false,
  onZoom: () => this.setControlStatuses()
});

// Continent zoom (viewBox → content pixels)
this.mapPanZoom.reset(true);
this.mapPanZoom.zoomToAt(continent.zoom, {
  x: (continent.pan.x / 2000) * this.mapImage.clientWidth,
  y: (continent.pan.y / 1001) * this.mapImage.clientHeight
}, true);
```

Nothing in Phase 1 touched svgMap itself — these are upstream dom-pan-zoom changes, ready for Phase 2 integration.
