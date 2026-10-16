/*! Pulse Monitor Live web client | (c) 2026 Radeal sp. z o.o. | MIT License */

/**
 * Chooses how many tiles go side by side and how big they are.
 *
 * Pure function: it only looks at the available area and the number of tiles,
 * so it works the same for landscape and portrait screens.
 *
 * - tries every number of columns that keeps tiles at least `minW` wide
 * - drops layouts whose tiles would be lower than `minH` (they would not fit without scrolling)
 * - among the rest picks the one with the biggest tiles; the tile shape is kept between `minAr` and `maxAr` (width / height)
 * - if nothing fits, uses minimum-size tiles and reports `scroll: true`
 *
 * `minSlots` (optional): minimum number of places in the grid, even when there are fewer tiles.
 *
 * Returns { cols, rows, tileW, tileH, scroll } in pixels, or null when there is nothing to lay out.
 */
export function computeLayout({ width, height, count, gap, minW, minH, minAr, maxAr, minSlots = 1 }) {
  if (count < 1 || width <= 0 || height <= 0) return null;

  // The grid always has at least `minSlots` places: with fewer participants the tiles keep the size
  // and position they would have in that grid, so a single tile does not grow to fill the whole screen.
  const slots = Math.max(count, minSlots);

  const maxCols = Math.max(1, Math.min(slots, Math.floor((width + gap) / (minW + gap))));
  let best = null;

  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(slots / cols);
    const cellW = (width - gap * (cols - 1)) / cols;
    const cellH = (height - gap * (rows - 1)) / rows;
    if (cellH < minH) continue;

    const { w, h } = fitShape(cellW, cellH, minAr, maxAr);
    if (!best || w * h > best.area) {
      best = { cols, rows, tileW: Math.floor(w), tileH: Math.floor(h), area: w * h, scroll: false };
    }
  }

  if (best) {
    const { area, ...layout } = best;
    return layout;
  }

  // Too many tiles for this screen: minimum height, as many columns as fit, the rest scrolls.
  const cols = maxCols;
  const cellW = (width - gap * (cols - 1)) / cols;
  const { w } = fitShape(cellW, minH, minAr, maxAr);
  return { cols, rows: Math.ceil(slots / cols), tileW: Math.floor(w), tileH: minH, scroll: true };
}

// Shrinks a cell to the allowed width / height ratio.
function fitShape(w, h, minAr, maxAr) {
  const ar = w / h;
  if (ar > maxAr) return { w: h * maxAr, h };
  if (ar < minAr) return { w, h: w / minAr };
  return { w, h };
}
