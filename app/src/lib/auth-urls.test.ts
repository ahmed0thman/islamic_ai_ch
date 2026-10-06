import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { authUrls, pathOr } from "./auth-urls.ts";

test("with no env the paths are the app's own pages and the reading", () => {
  assert.deepEqual(authUrls({}), { signInUrl: "/sign-in", signUpUrl: "/sign-up", signInFallbackRedirectUrl: "/", signUpFallbackRedirectUrl: "/" });
});
test("an empty or blank env value counts as unset", () => {
  assert.deepEqual(authUrls({ signIn: "", signUp: "  ", signInAfter: "", signUpAfter: "" }), authUrls({}));
});
test("an env value overrides its own default only", () => {
  const urls = authUrls({ signIn: "/enter", signUpAfter: "/s/1/" });
  assert.equal(urls.signInUrl, "/enter");
  assert.equal(urls.signUpUrl, "/sign-up");
  assert.equal(urls.signInFallbackRedirectUrl, "/");
  assert.equal(urls.signUpFallbackRedirectUrl, "/s/1/");
});
test("pathOr trims the value it keeps", () => {
  assert.equal(pathOr(" /x ", "/y"), "/x");
  assert.equal(pathOr(undefined, "/y"), "/y");
});
