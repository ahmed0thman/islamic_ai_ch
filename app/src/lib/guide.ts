import type { GuideUi } from "./types";

export type GuideSurface = "phone" | "wide";
export type GuideStep = { id: string; targets: string[]; title: string; body: string };
export const GUIDE_OPEN_EVENT = "huda:guide-open";
export const guideStorageKey = (surface: GuideSurface) => `huda:guide-seen:${surface}:v1`;

const step = (id: string, targets: string[], text: { title: string; body: string }): GuideStep => ({ id, targets, title: text.title, body: text.body });

/** The phone tour walks every surface; the wide tour is completed in step C. */
export function guideSteps(guide: GuideUi, surface: GuideSurface): GuideStep[] {
  if (surface === "wide") return [
    step("welcome", [], guide.shared.welcome),
    step("depth", [".wide-reader .wide-depths"], guide.shared.depth),
  ];
  return [
    step("welcome", [], guide.shared.welcome),
    step("depth", [".huda-reader .depth-dial"], guide.shared.depth),
    step("stop", [".huda-reader .hero-question", ".huda-reader .surah-thread .stop-door"], guide.phone.stop),
    step("marks", ['.reader-appbar [data-guide="legend"]'], guide.phone.marks),
    step("views", [".huda-reader .view-toggle"], guide.phone.views),
    step("ask", [".huda-reader .ask-dock .ask-fab"], guide.phone.ask),
    step("menu", [".huda-reader .menu-trigger"], guide.phone.menu),
  ];
}

/** A blocked storage must not make the guide open on every visit, so it reads as seen. */
export function readGuideSeen(surface: GuideSurface): boolean {
  try { return localStorage.getItem(guideStorageKey(surface)) === "1"; }
  catch { return true; }
}

export function writeGuideSeen(surface: GuideSurface): void {
  try { localStorage.setItem(guideStorageKey(surface), "1"); } catch { /* Storage may be blocked. */ }
}

export function requestGuide(): void {
  window.dispatchEvent(new Event(GUIDE_OPEN_EVENT));
}
