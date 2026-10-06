import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { fail, ok } from "./result.ts";
import type { Result } from "./result";

test("ok carries the data", () => {
  assert.deepEqual(ok(3), { ok: true, data: 3 });
});

test("fail carries the code and omits an absent message", () => {
  assert.deepEqual(fail("validation"), { ok: false, error: { code: "validation" } });
  assert.deepEqual(fail("not_found", "gone"), { ok: false, error: { code: "not_found", message: "gone" } });
});

test("a failed result is assignable wherever a result is expected", () => {
  const value: Result<number> = fail("internal");
  assert.equal(value.ok, false);
});
