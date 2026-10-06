type Rect = { left: number; right: number; top: number; bottom: number };
/** Physical coordinates work for both RTL and LTR anchors. Keep the bar uncovered. */
export function widePopoverPosition(anchor: Rect, size: { width: number; height: number }, viewport: { width: number; height: number }, centered = false) {
  const margin = 12, gap = 8, minTop = 64;
  const width = Math.min(size.width, viewport.width - margin * 2);
  const height = Math.min(size.height, Math.max(0, viewport.height - minTop - margin));
  const desiredLeft = centered ? (anchor.left + anchor.right - width) / 2 : anchor.right - width;
  const left = Math.max(margin, Math.min(desiredLeft, viewport.width - width - margin));
  const below = anchor.bottom + gap, above = anchor.top - height - gap;
  const top = below + height <= viewport.height - margin ? below : above >= minTop ? above : viewport.height - height - margin;
  return { left, top: Math.max(minTop, top) };
}
