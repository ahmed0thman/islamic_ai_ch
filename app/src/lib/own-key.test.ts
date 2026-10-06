import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node tests require explicit source extensions.
import { clearOwnKey, clearProviderOwnKey, getOwnKey, getOwnKeys, keyWithinShape, OWN_KEY_CHANGE_EVENT, ownKeyHeaders, setActiveOwnKey, setOwnKey, setProviderOwnKey } from "./own-key.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { requestAsk } from "./ask-client.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { createWeaveClient } from "./weave-client.ts";
import type { OwnKey } from "./own-key";
import type { AskResponse } from "./ask/types";

function browser() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  const target = new EventTarget();
  const sessionStorage = {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => { values.set(name, value); },
    removeItem: (name: string) => { values.delete(name); },
  };
  Object.defineProperty(target, "sessionStorage", { configurable: true, value: sessionStorage });
  Object.defineProperty(target, "localStorage", { get() { assert.fail("Persistent storage must not be accessed"); } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: target });
  return { values, target, sessionStorage, restore: () => {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  } };
}

test("own keys round-trip in session storage only; change events carry no secret; clear removes headers", () => {
  const fixture = browser();
  try {
    assert.equal(getOwnKey(), null);
    assert.deepEqual(ownKeyHeaders(), {});
    let changes = 0;
    fixture.target.addEventListener(OWN_KEY_CHANGE_EVENT, (event) => {
      changes++;
      assert.equal("detail" in event, false);
    });
    for (const provider of ["opencode-go", "openai", "anthropic"] as const) {
      const own = { provider, key: "test-only-sentinel-" + provider };
      assert.equal(setOwnKey(own), true);
      assert.deepEqual(getOwnKey(), own);
      assert.deepEqual(ownKeyHeaders(), { "x-huda-provider": provider, "x-huda-key": own.key });
      assert.equal(fixture.values.size, 1);
    }
    assert.equal(clearOwnKey(), true);
    assert.equal(getOwnKey(), null);
    assert.deepEqual(ownKeyHeaders(), {});
    assert.equal(fixture.values.size, 0);
    assert.equal(changes, 4);
  } finally { fixture.restore(); }
});

test("storage corruption and unsupported or malformed keys are ignored", () => {
  const fixture = browser();
  try {
    for (const raw of ["{", "null", "[]", JSON.stringify({ provider: "gemini", key: "x".repeat(20) }),
      JSON.stringify({ provider: "openai", key: 42 }), JSON.stringify({ provider: "openai", key: "x".repeat(19) })]) {
      fixture.values.set("huda-own-key", raw);
      assert.equal(getOwnKey(), null);
      assert.deepEqual(ownKeyHeaders(), {});
    }
    for (const key of ["x".repeat(19), "x".repeat(301), "x".repeat(20) + " ", "x".repeat(20) + "\n", "x".repeat(20) + "\t", "x".repeat(20) + "\x7f", "x".repeat(20) + "\u00e9"]) {
      assert.equal(keyWithinShape(key), false);
      assert.equal(setOwnKey({ provider: "openai", key }), false);
    }
    assert.equal(setOwnKey({ provider: "unknown", key: "x".repeat(20) } as unknown as OwnKey), false);
    assert.equal(keyWithinShape("!".repeat(20)), true);
    assert.equal(keyWithinShape("~".repeat(300)), true);
  } finally { fixture.restore(); }
});

test("server rendering, denied storage access and storage-operation failures never throw", () => {
  const fixture = browser();
  const own = { provider: "openai" as const, key: "test-only-sentinel-storage" };
  try {
    Object.defineProperty(fixture.target, "sessionStorage", { configurable: true, get() { throw new Error("denied"); } });
    assert.equal(getOwnKey(), null);
    assert.deepEqual(ownKeyHeaders(), {});
    assert.equal(setOwnKey(own), false);
    assert.equal(clearOwnKey(), false);
    Object.defineProperty(fixture.target, "sessionStorage", { configurable: true, value: {
      getItem() { throw new Error("read"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("remove"); },
    } });
    assert.equal(getOwnKey(), null);
    assert.equal(setOwnKey(own), false);
    assert.equal(clearOwnKey(), false);
    Reflect.deleteProperty(globalThis, "window");
    assert.equal(getOwnKey(), null);
    assert.deepEqual(ownKeyHeaders(), {});
    assert.equal(setOwnKey(own), false);
    assert.equal(clearOwnKey(), false);
  } finally { fixture.restore(); }
});

test("Ask and weave send the current key only in headers; own-key weave requests bypass answer caches", async () => {
  const fixture = browser();
  const seen: { url: string; options: RequestInit }[] = [];
  const response: AskResponse = { status: "answer", mode: "composed", atoms: [{ id: "a", records: ["r"], role: "claim", level: 1, segments: [] }],
    composed: [{ text: "first", atom_ids: ["a"] }, { text: "second", atom_ids: ["a"] }] };
  const send: typeof fetch = async (url, options) => { seen.push({ url: String(url), options: options! }); return Response.json(response); };
  const weave = createWeaveClient(send);
  const input = { surah: 108, depth: 1 as const, stop: 1, questions: ["question"] };
  try {
    await requestAsk({ surah: 108, depth: 1, question: "question" }, undefined, send);
    assert.equal(new Headers(seen[0].options.headers).has("x-huda-key"), false);
    await weave(input);
    await weave(input);
    assert.equal(seen.length, 2);
    for (const provider of ["openai", "anthropic"] as const) {
      const own = { provider, key: "test-only-sentinel-" + provider };
      setOwnKey(own);
      await requestAsk({ surah: 108, depth: 1, question: "question" }, undefined, send);
      await weave(input);
      await weave(input);
      for (const request of seen.slice(-3)) {
        const headers = new Headers(request.options.headers);
        assert.equal(headers.get("x-huda-key"), own.key);
        assert.equal(headers.get("x-huda-provider"), provider);
        assert.equal(request.options.cache, "no-store");
        assert.equal(request.url.includes(own.key), false);
        assert.equal(String(request.options.body).includes(own.key), false);
      }
    }
    clearOwnKey();
    await requestAsk({ surah: 108, depth: 1, question: "question" }, undefined, send);
    assert.equal(new Headers(seen.at(-1)!.options.headers).has("x-huda-key"), false);
  } finally { fixture.restore(); }
});


test("provider keys coexist and only the active pair is used", () => {
  const fixture = browser();
  try {
    const keys = { "opencode-go": "x".repeat(20), openai: "y".repeat(20), anthropic: "z".repeat(20) };
    for (const provider of ["opencode-go", "openai", "anthropic"] as const) {
      assert.equal(setProviderOwnKey({ provider, key: keys[provider] }), true);
    }
    assert.deepEqual(getOwnKeys(), { keys, active: "opencode-go" });
    assert.equal(setActiveOwnKey("anthropic"), true);
    assert.equal(getOwnKey()?.provider, "anthropic");
    assert.deepEqual(Object.keys(ownKeyHeaders()).sort(), ["x-huda-key", "x-huda-provider"]);
    assert.equal(ownKeyHeaders()["x-huda-key"] === keys.anthropic, true);
    assert.equal(clearProviderOwnKey("openai"), true);
    assert.equal(getOwnKey()?.provider, "anthropic");
    assert.equal(clearProviderOwnKey("anthropic"), true);
    assert.equal(getOwnKey()?.provider, "opencode-go");
    assert.equal(clearProviderOwnKey("opencode-go"), true);
    assert.equal(getOwnKey(), null);
    assert.deepEqual(ownKeyHeaders(), {});
    assert.equal(setActiveOwnKey("openai"), false);
  } finally { fixture.restore(); }
});

test("legacy storage is read without data loss and upgraded on a provider save", () => {
  const fixture = browser();
  try {
    const legacy = { provider: "openai", key: "x".repeat(20) };
    fixture.sessionStorage.setItem("huda-own-key", JSON.stringify(legacy));
    assert.equal(getOwnKey()?.provider, "openai");
    assert.equal(getOwnKey()?.key === legacy.key, true);
    assert.equal(setProviderOwnKey({ provider: "anthropic", key: "y".repeat(20) }), true);
    assert.equal(getOwnKey()?.provider, "openai");
    assert.deepEqual(Object.keys(getOwnKeys().keys).sort(), ["anthropic", "openai"]);
    const stored = JSON.parse(fixture.sessionStorage.getItem("huda-own-key")!);
    assert.deepEqual(Object.keys(stored).sort(), ["active", "keys"]);
    assert.equal(stored.keys.openai === legacy.key, true);
  } finally { fixture.restore(); }
});

test("new storage rejects invalid keys and cannot select an unsaved provider", () => {
  const fixture = browser();
  try {
    fixture.sessionStorage.setItem("huda-own-key", JSON.stringify({
      keys: { openai: "x".repeat(20), anthropic: "short", "opencode-go": 42, unknown: "y".repeat(20) }, active: "anthropic",
    }));
    assert.deepEqual(Object.keys(getOwnKeys().keys), ["openai"]);
    assert.equal(getOwnKey(), null);
    assert.deepEqual(ownKeyHeaders(), {});
    assert.equal(setActiveOwnKey("anthropic"), false);
    assert.equal(setProviderOwnKey({ provider: "anthropic", key: "short" }), false);
    assert.equal(setActiveOwnKey("openai"), true);
    assert.equal(getOwnKey()?.provider, "openai");
    assert.equal(clearOwnKey(), true);
    assert.deepEqual(getOwnKeys(), { keys: {} });
  } finally { fixture.restore(); }
});
