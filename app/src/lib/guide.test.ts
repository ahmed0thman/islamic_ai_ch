import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { GUIDE_OPEN_EVENT, guideSteps, guideStorageKey, readGuideSeen, writeGuideSeen } from "./guide.ts";
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
test("the wide tour starts with the two shared steps", () => {
  assert.deepEqual(guideSteps(guide, "wide").map((item) => item.id), ["welcome", "depth"]);
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
