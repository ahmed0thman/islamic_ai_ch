import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node tests use explicit source extensions.
import { widePopoverPosition } from "./wide-popover.ts";

test("a top-bar popover stays next to its opener on either viewport edge", () => {
  const viewport = { width: 1440, height: 900 }, size = { width: 320, height: 300 };
  assert.deepEqual(widePopoverPosition({ left: 1275, right: 1400, top: 10, bottom: 46 }, size, viewport), { left: 1080, top: 64 });
  assert.deepEqual(widePopoverPosition({ left: 20, right: 56, top: 10, bottom: 46 }, size, viewport), { left: 12, top: 64 });
});

test("a rail-foot popover opens above its trigger and a tall one stays in the viewport", () => {
  const anchor = { left: 1320, right: 1400, top: 810, bottom: 842 }, viewport = { width: 1440, height: 900 };
  assert.deepEqual(widePopoverPosition(anchor, { width: 320, height: 440 }, viewport), { left: 1080, top: 362 });
  assert.deepEqual(widePopoverPosition(anchor, { width: 320, height: 1500 }, viewport), { left: 1080, top: 64 });
});

test("popover placement clamps all edges across wide viewports", () => {
  for (const width of [1024, 1280, 1440]) for (const height of [768, 800, 900]) {
    for (const anchor of [{ left: 0, right: 36, top: 12, bottom: 48 }, { left: width - 36, right: width, top: height - 40, bottom: height - 4 }]) {
      const position = widePopoverPosition(anchor, { width: 320, height: 440 }, { width, height });
      assert.ok(position.left >= 12 && position.left + 320 <= width - 12);
      assert.ok(position.top >= 64 && position.top + 440 <= height - 12);
    }
  }
});
