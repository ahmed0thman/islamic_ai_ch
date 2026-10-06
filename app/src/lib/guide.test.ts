import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { GUIDE_OPEN_EVENT, guideSteps, guideStorageKey, readGuideSeen, shouldGuideOpen, wideGuideCardPosition, writeGuideSeen } from "./guide.ts";
import type { GuideUi } from "./types";

const titled = (id: string) => ({ title: `${id}-title`, body: `${id}-body` });
const guide = {
  title: "title", reopen: "reopen", next: "next", previous: "previous", skip: "skip", done: "done", progress: "{current} of {total}",
  shared: { welcome: titled("welcome"), depth: titled("depth") },
  phone: { stop: titled("stop"), marks: titled("marks"), views: titled("views"), ask: titled("ask"), menu: titled("menu") },
  wide: { index: titled("index"), reading: titled("reading"), panel: titled("panel"), ask: titled("wide-ask"), tools: titled("tools") },
} satisfies GuideUi;

test("the phone tour is the seven steps in order", () => {
  assert.deepEqual(guideSteps(guide, "phone").map((item) => item.id), ["welcome", "depth", "stop", "marks", "views", "ask", "menu"]);
});
test("the wide tour is the seven steps in order", () => {
  assert.deepEqual(guideSteps(guide, "wide").map((item) => item.id), ["welcome", "depth", "index", "reading", "panel", "ask", "tools"]);
});
test("a step with two selectors keeps them in resolution order", () => {
  const index = guideSteps(guide, "wide").find((item) => item.id === "index")!;
  assert.deepEqual(index.targets, [".wide-reader .wide-index", ".wide-reader .wide-toc-toggle"]);
});
test("step text and targets come from the object passed in", () => {
  const stop = guideSteps(guide, "phone").find((item) => item.id === "stop")!;
  assert.equal(stop.title, "stop-title");
  assert.equal(stop.body, "stop-body");
  assert.deepEqual(stop.targets, [".huda-reader .hero-question", ".huda-reader .surah-thread .stop-door"]);
  assert.deepEqual(guideSteps(guide, "phone")[0].targets, []);
});
test("the storage key is per surface", () => {
  assert.equal(guideStorageKey("phone"), "huda:guide-seen:phone:v1");
  assert.equal(guideStorageKey("wide"), "huda:guide-seen:wide:v1");
});
test("the reopen event name is stable", () => assert.equal(GUIDE_OPEN_EVENT, "huda:guide-open"));
test("an explicit request opens the tour on both layouts even when already seen", () => {
  for (const surface of ["phone", "wide"] as const) assert.equal(shouldGuideOpen({ seen: true, requested: true, surface }), true);
});
test("the first visit opens the tour on both layouts", () => {
  for (const surface of ["phone", "wide"] as const) assert.equal(shouldGuideOpen({ seen: false, requested: false, surface }), true);
});
test("a seen layout stays closed without an explicit request", () => {
  for (const surface of ["phone", "wide"] as const) assert.equal(shouldGuideOpen({ seen: true, requested: false, surface }), false);
});
test("a tall wide target puts the card on the side with more free width", () => {
  const card = { width: 384, height: 200 }, viewport = { width: 1280, height: 800 };
  assert.deepEqual(wideGuideCardPosition({ left: 0, right: 256, top: 64, bottom: 800 }, card, viewport), { left: 268, top: 88 });
  assert.deepEqual(wideGuideCardPosition({ left: 1024, right: 1280, top: 64, bottom: 800 }, card, viewport), { left: 628, top: 88 });
});
test("a tall wide target centers when neither side has room", () => {
  assert.equal(wideGuideCardPosition({ left: 100, right: 500, top: 0, bottom: 400 }, { width: 400, height: 200 }, { width: 600, height: 400 }), null);
});
test("a short wide target uses the shared popover placement", () => {
  assert.deepEqual(wideGuideCardPosition({ left: 500, right: 700, top: 100, bottom: 130 }, { width: 384, height: 180 }, { width: 1280, height: 800 }), { left: 408, top: 138 });
});
test("an unavailable storage reads as seen and writes without throwing", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  try {
    assert.equal(readGuideSeen("phone"), true);
    assert.doesNotThrow(() => writeGuideSeen("phone"));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
