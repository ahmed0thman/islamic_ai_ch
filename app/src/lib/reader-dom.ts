export function jumpToAyah(key: string) {
  const node = Array.from(document.querySelectorAll<HTMLElement>("[data-station-key]")).find((element) => element.dataset.stationKey === key);
  for (let parent = node?.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
  const target = node ?? Array.from(document.querySelectorAll<HTMLElement>("[data-ayah-key]")).find((element) => element.dataset.ayahKey === key);
  target?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  node?.querySelector<HTMLElement>(".ayah-medal")?.focus({ preventScroll: true });
}
