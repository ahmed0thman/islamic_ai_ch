import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { arrayOf, int, literal, nullable, object, optional, text } from "./validate.ts";

const throwsValidation = (run: () => unknown): void => assert.throws(run, (error: { code?: string }) => error.code === "validation");

test("int accepts an integer inside the bounds only", () => {
  const between = int({ min: 1, max: 3 });
  assert.equal(between(2), 2);
  for (const raw of [0, 4, 1.5, "2", null, NaN]) throwsValidation(() => between(raw));
});

test("text counts characters, trims only when asked, and keeps the bounds", () => {
  const plain = text({ min: 1, max: 3 });
  assert.equal(plain("abc"), "abc");
  throwsValidation(() => plain("abcd"));
  throwsValidation(() => plain(""));
  throwsValidation(() => plain(5));
  const trimmed = text({ min: 1, max: 3, trim: true });
  assert.equal(trimmed(" ab "), "ab");
  throwsValidation(() => trimmed("    "));
});

test("arrayOf validates each item and the length", () => {
  const items = arrayOf(int({ min: 0, max: 9 }), { max: 2 });
  assert.deepEqual(items([1, 2]), [1, 2]);
  throwsValidation(() => items([1, 2, 3]));
  throwsValidation(() => items([10]));
  throwsValidation(() => items("no"));
});

test("nullable accepts null and passes the rest on", () => {
  const stop = nullable(int({ min: 0, max: 9 }));
  assert.equal(stop(null), null);
  assert.equal(stop(undefined), null);
  assert.equal(stop(3), 3);
  throwsValidation(() => stop(-1));
});

test("optional keeps undefined; literal matches one of its values", () => {
  const askedAt = optional(text({ min: 1, max: 5 }));
  assert.equal(askedAt(undefined), undefined);
  assert.equal(askedAt("now"), "now");
  const kind = literal("progress", "question");
  assert.equal(kind("progress"), "progress");
  throwsValidation(() => kind("other"));
});

test("object validates each field and ignores unknown ones", () => {
  const shape = object({ surah: int({ min: 1, max: 114 }), stop: nullable(int({ min: 0, max: 9 })) });
  assert.deepEqual(shape({ surah: 2, stop: null, extra: true }), { surah: 2, stop: null });
  throwsValidation(() => shape({ surah: 2, stop: -1 }));
  throwsValidation(() => shape({ stop: null })); // a missing required field
  throwsValidation(() => shape(null));
  throwsValidation(() => shape([1]));
});
