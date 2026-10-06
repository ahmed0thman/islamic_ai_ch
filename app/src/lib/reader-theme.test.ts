import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
// @ts-expect-error -- Node tests use explicit source extensions.
import { parseTheme, resolveTheme, THEME_BOOT_SCRIPT } from "./reader-theme.ts";

test("theme parsing accepts explicit choices and falls back to system for stale data", () => {
  assert.equal(parseTheme("light"), "light"); assert.equal(parseTheme("dark"), "dark");
  for (const value of ["system", null, undefined, "", "Dark", {}, 1]) assert.equal(parseTheme(value), "system");
});
test("explicit theme always wins over either system setting", () => {
  for (const systemDark of [false, true]) {
    assert.equal(resolveTheme("light", systemDark), "light");
    assert.equal(resolveTheme("dark", systemDark), "dark");
    assert.equal(resolveTheme("system", systemDark), systemDark ? "dark" : "light");
  }
});
test("the prepaint script applies saved choices, including unavailable storage", () => {
  for (const value of ["light", "dark", "system", "broken", null]) {
    const document = { documentElement: { dataset: {} as Record<string, string> } };
    vm.runInNewContext(THEME_BOOT_SCRIPT, { document, localStorage: { getItem: () => value } });
    assert.equal(document.documentElement.dataset.theme, parseTheme(value));
  }
  const document = { documentElement: { dataset: {} as Record<string, string> } };
  vm.runInNewContext(THEME_BOOT_SCRIPT, { document, localStorage: { getItem: () => { throw new Error("Storage disabled"); } } });
  assert.equal(document.documentElement.dataset.theme, "system");
});
