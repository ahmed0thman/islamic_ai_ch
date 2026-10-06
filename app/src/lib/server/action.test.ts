import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { createAction, setAuthResolver } from "./action.ts";
import type { ActionContext } from "./action";
// @ts-expect-error -- Node requires source extensions.
import { currentUserId } from "./auth.ts";
// @ts-expect-error -- Node requires source extensions.
import { NotFoundError, ValidationError } from "./errors.ts";

const identity = async (ctx: ActionContext, input: string): Promise<[string | null, string]> => [ctx.userId, input];

test("an optional action passes the signed-out reader through with a null user", async () => {
  setAuthResolver(async () => null);
  const action = createAction({ auth: "optional", input: (raw) => raw as string, handler: identity });
  assert.deepEqual(await action("x"), { ok: true, data: [null, "x"] });
});

test("an optional action hands the user id to the handler", async () => {
  setAuthResolver(async () => "user-1");
  const action = createAction({ auth: "optional", input: (raw) => raw as string, handler: identity });
  assert.deepEqual(await action("x"), { ok: true, data: ["user-1", "x"] });
});

test("a required action fails with auth_required when nobody is signed in", async () => {
  setAuthResolver(async () => null);
  const action = createAction({ auth: "required", input: (raw) => raw as string, handler: identity });
  assert.deepEqual(await action("x"), { ok: false, error: { code: "auth_required" } });
});

test("the input is validated at the wrapper, once", async () => {
  setAuthResolver(async () => "user-1");
  let called = 0;
  const action = createAction({
    auth: "optional",
    input: (raw) => { if (raw !== "good") throw new ValidationError("bad"); return raw; },
    handler: async () => { called += 1; return "ran"; },
  });
  assert.deepEqual(await action("bad"), { ok: false, error: { code: "validation", message: "bad" } });
  assert.equal(called, 0);
  assert.deepEqual(await action("good"), { ok: true, data: "ran" });
});

test("a typed error from the handler keeps its code", async () => {
  setAuthResolver(async () => null);
  const action = createAction({ auth: "optional", handler: async () => { throw new NotFoundError("gone"); } });
  assert.deepEqual(await action(undefined), { ok: false, error: { code: "not_found", message: "gone" } });
});

test("an untyped error from the handler becomes internal, with no message", async () => {
  setAuthResolver(async () => null);
  const action = createAction({ auth: "optional", handler: async () => { throw new Error("boom"); } });
  assert.deepEqual(await action(undefined), { ok: false, error: { code: "internal" } });
});

test("without a test seam the resolver is Clerk itself: flag off means signed out", async () => {
  setAuthResolver(currentUserId);
  delete process.env.NEXT_PUBLIC_HUDA_AUTH;
  const action = createAction({ auth: "optional", handler: async (ctx) => ctx.userId });
  assert.deepEqual(await action(undefined), { ok: true, data: null });
});
