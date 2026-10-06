import type { GuideUi } from "./types";
// @ts-expect-error -- Node tests require explicit source extensions.
import { widePopoverPosition } from "./wide-popover.ts";

export type GuideSurface = "phone" | "wide";
export type GuideStep = { id: string; targets: string[]; title: string; body: string };
export const GUIDE_OPEN_EVENT = "huda:guide-open";
export const guideStorageKey = (surface: GuideSurface): string => `huda:guide-seen:${surface}:v1`;

type GuideText = { title: string; body: string };
type StepSpec = { readonly id: string; readonly targets: readonly string[]; readonly text: (guide: GuideUi) => GuideText };

const PHONE_SELECTORS = {
  depth: ".huda-reader .depth-dial",
  stop: [".huda-reader .hero-question", ".huda-reader .surah-thread .stop-door"],
  marks: '.reader-appbar [data-guide="legend"]',
  views: ".huda-reader .view-toggle",
  ask: ".huda-reader .ask-dock .ask-fab",
  menu: ".huda-reader .menu-trigger",
} as const;

const WIDE_SELECTORS = {
  depth: ".wide-reader .wide-depths",
  index: [".wide-reader .wide-index", ".wide-reader .wide-toc-toggle"],
  reading: ".wide-reader .wide-view-row",
  panel: [".wide-reader .wide-panel", ".wide-reader .wide-panel-show"],
  ask: ".wide-reader .wide-ask-open",
  tools: ".wide-reader .wide-bar-end",
} as const;

const step = (id: string, targets: readonly string[], text: (guide: GuideUi) => GuideText): StepSpec => ({ id, targets, text });

/** The welcome step has no target and reads the same on both surfaces, so it is defined once. */
const WELCOME = step("welcome", [], (guide) => guide.shared.welcome);
const DEPTH = (targets: readonly string[]): StepSpec => step("depth", targets, (guide) => guide.shared.depth);

const PHONE_STEPS: readonly StepSpec[] = [
  WELCOME,
  DEPTH([PHONE_SELECTORS.depth]),
  step("stop", PHONE_SELECTORS.stop, (guide) => guide.phone.stop),
  step("marks", [PHONE_SELECTORS.marks], (guide) => guide.phone.marks),
  step("views", [PHONE_SELECTORS.views], (guide) => guide.phone.views),
  step("ask", [PHONE_SELECTORS.ask], (guide) => guide.phone.ask),
  step("menu", [PHONE_SELECTORS.menu], (guide) => guide.phone.menu),
];

const WIDE_STEPS: readonly StepSpec[] = [
  WELCOME,
  DEPTH([WIDE_SELECTORS.depth]),
  step("index", WIDE_SELECTORS.index, (guide) => guide.wide.index),
  step("reading", [WIDE_SELECTORS.reading], (guide) => guide.wide.reading),
  step("panel", WIDE_SELECTORS.panel, (guide) => guide.wide.panel),
  step("ask", [WIDE_SELECTORS.ask], (guide) => guide.wide.ask),
  step("tools", [WIDE_SELECTORS.tools], (guide) => guide.wide.tools),
];

/** The phone tour walks every phone surface; the wide tour walks the wide layout's regions. */
export function guideSteps(guide: GuideUi, surface: GuideSurface): GuideStep[] {
  const specs = surface === "wide" ? WIDE_STEPS : PHONE_STEPS;
  return specs.map((spec) => {
    const text = spec.text(guide);
    return { id: spec.id, targets: [...spec.targets], title: text.title, body: text.body };
  });
}

type Rect = { left: number; right: number; top: number; bottom: number };
type Size = { width: number; height: number };

/**
 * Physical placement of the wide guide card beside a tall target (index, panel) or under a short one.
 * A null result means the card is centered in the viewport. Coordinates are for an RTL-agnostic fixed box.
 */
export function wideGuideCardPosition(target: Rect, card: Size, viewport: Size): { left: number; top: number } | null {
  const margin = 12, gap = 12, topOffset = 24;
  const clamped: Rect = {
    left: Math.max(0, Math.min(target.left, viewport.width)),
    right: Math.max(0, Math.min(target.right, viewport.width)),
    top: Math.max(0, Math.min(target.top, viewport.height)),
    bottom: Math.max(0, Math.min(target.bottom, viewport.height)),
  };
  if (clamped.bottom - clamped.top > viewport.height / 2) {
    const need = card.width + gap + margin;
    const top = Math.max(margin, Math.min(clamped.top + topOffset, Math.max(margin, viewport.height - card.height - margin)));
    const sides = [
      { space: viewport.width - clamped.right, left: clamped.right + gap },
      { space: clamped.left, left: clamped.left - gap - card.width },
    ].sort((a, b) => b.space - a.space);
    for (const side of sides) if (side.space >= need) return { left: side.left, top };
    return null;
  }
  return widePopoverPosition(clamped, card, viewport, true);
}

/**
 * Whether the tour should open on a surface. An explicit request (`?guide=1`, the help button) always opens,
 * on either layout; otherwise the first visit to that surface opens it once. The rule is layout-independent:
 * the `surface` is an input only so both layouts are decided by the same call.
 */
export function shouldGuideOpen(input: { seen: boolean; requested: boolean; surface: GuideSurface }): boolean {
  return input.requested || !input.seen;
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
