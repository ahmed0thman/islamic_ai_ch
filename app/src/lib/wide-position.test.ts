import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node tests use explicit source extensions.
import { captureWidePosition, currentWideAyah, restoreWideAyah, restoreWidePosition } from "../components/wide/wide-position.ts";

function withReader(run: (setHeights: (heights: number[]) => void, window: { scrollY: number }) => void) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  let heights = [190, 77, 193, 77, 190, 286, 77, 190, 77, 190, 77];
  const window = { scrollY: 191, innerHeight: 900, scrollTo: ({ top }: { top: number }) => { window.scrollY = top; } };
  const nodes = Array.from({ length: 11 }, (_, index) => ({
    dataset: { stationKey: `93:${index + 1}` }, parentElement: null,
    getBoundingClientRect: () => ({ top: 303 + heights.slice(0, index).reduce((a, b) => a + b, 0) - window.scrollY, height: heights[index] }),
  }));
  const document = { querySelector: () => ({ querySelectorAll: () => nodes }), querySelectorAll: () => nodes };
  Object.defineProperty(globalThis, "window", { configurable: true, value: window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  try { run((next) => { heights = next; }, window); }
  finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
  }
}

test("switching depth repeatedly without scrolling keeps the same map ayah", () => {
  withReader((setHeights) => {
    restoreWideAyah("93:3");
    const ayah = currentWideAyah();
    assert.equal(ayah, "93:3");
    for (const depth of [2, 1, 2, 1, 3, 1, 0, 1]) {
      const position = captureWidePosition();
      setHeights(Array.from({ length: 11 }, (_, index) => 77 + ((index + depth) % 3) * 57));
      restoreWidePosition(position);
      assert.equal(currentWideAyah(), ayah);
    }
  });
});

test("depth or view changes at the top keep the surah title in view", () => {
  withReader((setHeights, window) => {
    window.scrollY = 0;
    const position = captureWidePosition();
    assert.equal(position.atTop, true);
    setHeights(Array(11).fill(77)); restoreWidePosition(position);
    assert.equal(window.scrollY, 0);
  });
});

test("changing from a scene restores its ayah even if the scene was at the page top", () => {
  withReader((_, window) => {
    window.scrollY = 0;
    const position = captureWidePosition("93:4");
    assert.equal(position.atTop, false); restoreWidePosition(position);
    assert.equal(currentWideAyah(), "93:4");
  });
});
