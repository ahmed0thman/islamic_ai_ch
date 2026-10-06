import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { currentUserId } from "./auth.ts";

test("with the auth flag off nobody is signed in, and no Clerk code runs", async () => {
  delete process.env.NEXT_PUBLIC_HUDA_AUTH;
  assert.equal(await currentUserId(), null);
  process.env.NEXT_PUBLIC_HUDA_AUTH = "0";
  assert.equal(await currentUserId(), null);
  delete process.env.NEXT_PUBLIC_HUDA_AUTH;
});

test("with the flag on but Clerk unusable, the reader counts as signed out", async () => {
  process.env.NEXT_PUBLIC_HUDA_AUTH = "1";
  try {
    // Outside a Clerk request context `auth()` throws: the failure is the signed-out answer, never an exception.
    assert.equal(await currentUserId(), null);
  } finally { delete process.env.NEXT_PUBLIC_HUDA_AUTH; }
});
