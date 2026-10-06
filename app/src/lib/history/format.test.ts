import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { fillSlots, formatDate } from "./format.ts";

test("fill: named slots are replaced, unknown keys stay visible, and the template is never changed", () => {
  assert.equal(fillSlots("وقفت عند {stop} بدرجة {depth}.", { stop: "٣", depth: "المفردات" }), "وقفت عند ٣ بدرجة المفردات.");
  assert.equal(fillSlots("زرت {visited} من {total}.", { visited: "٢" }), "زرت ٢ من {total}.");
  assert.equal(fillSlots("بلاslots", {}), "بلاslots");
});

test("date: an instant gives the Arabic medium date, and anything else gives nothing", () => {
  const shown = formatDate(Date.UTC(2026, 9, 6));
  assert.equal(shown.length > 0, true);
  assert.match(shown, /٢٠٢٦/);
  assert.equal(formatDate(0), "");
  assert.equal(formatDate(NaN), "");
});
