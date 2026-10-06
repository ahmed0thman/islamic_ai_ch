import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node tests use explicit source extensions.
import { wideCommand, wideEscapeAction } from "./wide-keyboard.ts";

test("wide navigation follows RTL reading direction and both letter cases", () => {
  for (const key of ["ArrowLeft", "j", "J"]) assert.deepEqual(wideCommand({ key }, false), { kind: "step", direction: 1 });
  for (const key of ["ArrowRight", "k", "K"]) assert.deepEqual(wideCommand({ key }, false), { kind: "step", direction: -1 });
});
test("wide commands map four depths and reader controls", () => {
  for (let number = 1; number <= 4; number++) assert.deepEqual(wideCommand({ key: String(number) }, false), { kind: "depth", depth: number - 1 });
  for (const [key, kind] of [["/", "ask"], ["m", "view"], ["M", "view"], ["Escape", "escape"], ["?", "shortcuts"]]) assert.deepEqual(wideCommand({ key }, false), { kind });
  for (const key of ["0", "5", "Enter", "Tab", "a"]) assert.equal(wideCommand({ key }, false), null);
});
test("editing permits Escape only, while composition, modifiers and handled keys stay local", () => {
  for (const key of ["ArrowLeft", "ArrowRight", "j", "k", "1", "/", "m", "Escape", "?"]) {
    assert.deepEqual(wideCommand({ key }, true), key === "Escape" ? { kind: "escape" } : null);
    for (const flag of ["altKey", "metaKey", "ctrlKey", "isComposing", "defaultPrevented"]) assert.equal(wideCommand({ key, [flag]: true }, false), null);
  }
});

test("Escape blurs first, closes the open panel state, then returns a scene to the map", () => {
  const state = { editing: true, popover: false, drawer: true, detail: true, passage: false, scene: true };
  assert.equal(wideEscapeAction(state), "blur"); state.editing = false;
  state.popover = true;
  assert.equal(wideEscapeAction(state), "popover"); state.popover = false;
  assert.equal(wideEscapeAction(state), "drawer"); state.drawer = false;
  assert.equal(wideEscapeAction(state), "detail"); state.detail = false;
  assert.equal(wideEscapeAction(state), "passage"); state.passage = true;
  assert.equal(wideEscapeAction(state), "map"); state.scene = false;
  assert.equal(wideEscapeAction(state), null);
});

test("Escape closes a popover immediately even when its search or key field is focused", () => {
  assert.equal(wideEscapeAction({ editing: true, popover: true, drawer: false, detail: false, passage: false, scene: true }), "popover");
});
