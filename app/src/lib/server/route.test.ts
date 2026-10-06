import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { createRoute, readJson } from "./route.ts";
// @ts-expect-error -- Node requires source extensions.
import { PayloadTooLargeError, ValidationError } from "./errors.ts";

const call = async (run: (request: Request) => Promise<Response>): Promise<Response> =>
  createRoute(run)(new Request("https://huda.test/api/test/", { method: "POST" }));

test("a handled request passes through untouched", async () => {
  const reply = await call(async () => Response.json({ fine: true }));
  assert.equal(reply.status, 200);
  assert.deepEqual(await reply.json(), { fine: true });
});

test("a typed error becomes its status and code, never cached", async () => {
  const reply = await call(async () => { throw new ValidationError("bad"); });
  assert.equal(reply.status, 400);
  assert.equal(reply.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await reply.json(), { error: { code: "validation", message: "bad" } });
});

test("an untyped error becomes 500 internal with no message leaked", async () => {
  const reply = await call(async () => { throw new Error("secret"); });
  assert.equal(reply.status, 500);
  assert.deepEqual(await reply.json(), { error: { code: "internal" } });
});

test("readJson parses a body within the limit", async () => {
  const request = new Request("https://huda.test/", { method: "POST", body: "{\"a\":1}", headers: { "Content-Type": "application/json" } });
  assert.deepEqual(await readJson(request), { a: 1 });
});

test("readJson rejects a declared size over the limit before reading", async () => {
  const request = new Request("https://huda.test/", { method: "POST", body: "{}", headers: { "Content-Length": "99999" } });
  await assert.rejects(() => readJson(request), (error: PayloadTooLargeError) => error.code === "payload_too_large");
});

test("readJson rejects a body that is too large or unparsable", async () => {
  const big = new Request("https://huda.test/", { method: "POST", body: "x".repeat(8 * 1024 + 1) });
  await assert.rejects(() => readJson(big), (error: PayloadTooLargeError) => error.code === "payload_too_large");
  const broken = new Request("https://huda.test/", { method: "POST", body: "{" });
  await assert.rejects(() => readJson(broken), (error: ValidationError) => error.code === "validation");
});
