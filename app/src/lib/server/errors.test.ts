import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { AppError, AuthRequiredError, ConflictError, ForbiddenError, NotFoundError, PayloadTooLargeError, UnavailableError, ValidationError, toFailure } from "./errors.ts";

test("each error class carries its code, status and message", () => {
  const cases: [AppError, string, number][] = [
    [new ValidationError("bad"), "validation", 400],
    [new AuthRequiredError(), "auth_required", 401],
    [new ForbiddenError(), "forbidden", 403],
    [new NotFoundError(), "not_found", 404],
    [new ConflictError(), "conflict", 409],
    [new PayloadTooLargeError(), "payload_too_large", 413],
    [new UnavailableError(), "unavailable", 503],
  ];
  for (const [error, code, status] of cases) {
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    assert.equal(error.expose, true);
    assert.ok(error.message.length > 0);
  }
});

test("a typed error maps to itself", () => {
  const failure = toFailure(new NotFoundError("gone"));
  assert.deepEqual(failure, { code: "not_found", status: 404, message: "gone" });
});

test("anything else maps to an internal failure with no message", () => {
  assert.deepEqual(toFailure(new Error("boom")), { code: "internal", status: 500 });
  assert.deepEqual(toFailure("boom"), { code: "internal", status: 500 });
  assert.deepEqual(toFailure(undefined), { code: "internal", status: 500 });
});
