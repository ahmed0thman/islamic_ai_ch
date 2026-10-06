/** Navigation preserves the ayah, never assumes that stops at different depths are the same concept. */
/** Below the top bar and the sticky bead rail. */
export const WIDE_READING_LINE = 160;
export type WidePosition = { key: string | null; atTop: boolean };
export function captureWidePosition(key?: string): WidePosition {
  return { key: key || currentWideAyah(), atTop: !key && window.scrollY === 0 };
}
export function restoreWidePosition(position: WidePosition) {
  if (position.atTop) window.scrollTo({ top: 0, behavior: "instant" });
  else restoreWideAyah(position.key);
}
export function currentWideAyah(): string | null {
  const root = document.querySelector(".wide-reading");
  if (!root) return null;
  const line = WIDE_READING_LINE + 2;
  let key: string | null = null;
  for (const element of root.querySelectorAll<HTMLElement>("[data-station-key], [data-wide-ayah]")) {
    const rect = element.getBoundingClientRect();
    if (rect.height && rect.top <= line) key = element.dataset.stationKey ?? element.dataset.wideAyah ?? key;
  }
  return key;
}
export function restoreWideAyah(key: string | null) {
  if (!key) return;
  const nodes = document.querySelectorAll<HTMLElement>(".wide-reading [data-station-key], .wide-reading [data-wide-ayah]");
  const matching = Array.from(nodes).filter((item) => (item.dataset.stationKey ?? item.dataset.wideAyah) === key);
  const node = matching.find((item) => item.dataset.wideUnit) ?? matching[0];
  for (let parent = node?.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
  if (node) window.scrollTo({ top: Math.max(0, node.getBoundingClientRect().top + window.scrollY - WIDE_READING_LINE), behavior: "instant" });
}
