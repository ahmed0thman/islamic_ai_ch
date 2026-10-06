import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node tests require explicit source extensions.
import { clearOwnKey, clearProviderOwnKey, getOwnKey, getOwnKeys, keyWithinShape, OWN_KEY_CHANGE_EVENT, ownKeyFromHeaders, ownKeyHeaders, ownTranscribeHeaders, setActiveOwnKey, setOwnKey, setProviderOwnKey } from "./own-key.ts";
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
    for (const provider of ["openai", "gemini"] as const) {
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
    assert.equal(changes, 3);
  } finally { fixture.restore(); }
});

test("storage corruption and unsupported or malformed keys are ignored", () => {
  const fixture = browser();
  try {
    for (const raw of ["{", "null", "[]", JSON.stringify({ provider: "anthropic", key: "x".repeat(20) }), JSON.stringify({ provider: "opencode-go", key: "x".repeat(20) }),
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
    for (const provider of ["openai", "gemini"] as const) {
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


test("provider keys coexist, only the active Ask pair travels with Ask, and the Groq key only with transcription", () => {
  const fixture = browser();
  try {
    const keys = { openai: "y".repeat(20), gemini: "z".repeat(20), groq: "x".repeat(20) };
    assert.deepEqual(ownTranscribeHeaders(), {});
    assert.equal(setProviderOwnKey({ provider: "groq", key: keys.groq }), true);
    assert.equal(getOwnKey(), null, "a transcription key is never the Ask key");
    assert.deepEqual(ownKeyHeaders(), {});
    assert.deepEqual(ownTranscribeHeaders(), { "x-huda-provider": "groq", "x-huda-key": keys.groq });
    for (const provider of ["openai", "gemini"] as const) assert.equal(setProviderOwnKey({ provider, key: keys[provider] }), true);
    assert.deepEqual(getOwnKeys(), { keys, active: "openai" });
    assert.equal(setActiveOwnKey("gemini"), true);
    assert.equal(getOwnKey()?.provider, "gemini");
    assert.deepEqual(Object.keys(ownKeyHeaders()).sort(), ["x-huda-key", "x-huda-provider"]);
    assert.equal(ownKeyHeaders()["x-huda-key"] === keys.gemini, true);
    assert.equal(ownTranscribeHeaders()["x-huda-key"] === keys.groq, true);
    assert.equal(setOwnKey({ provider: "groq", key: "w".repeat(20) }), true);
    assert.equal(getOwnKey()?.provider, "gemini", "saving the Groq key does not change the active Ask key");
    assert.equal(clearProviderOwnKey("openai"), true);
    assert.equal(getOwnKey()?.provider, "gemini");
    assert.equal(clearProviderOwnKey("gemini"), true);
    assert.equal(getOwnKey(), null);
    assert.deepEqual(ownKeyHeaders(), {});
    assert.equal(ownTranscribeHeaders()["x-huda-key"] === "w".repeat(20), true);
    assert.equal(clearProviderOwnKey("groq"), true);
    assert.deepEqual(ownTranscribeHeaders(), {});
    assert.equal(setActiveOwnKey("openai"), false);
    assert.equal(setActiveOwnKey("groq" as unknown as "openai"), false);
  } finally { fixture.restore(); }
});

test("server header parser: one helper, purpose-bound; any header opts out of the project's keys", () => {
  const key = "test-only-sentinel-header";
  const headers = (provider: string | null, value: string | null) => new Headers({ ...(provider ? { "x-huda-provider": provider } : {}), ...(value ? { "x-huda-key": value } : {}) });
  assert.deepEqual(ownKeyFromHeaders(new Headers(), "ask"), { present: false });
  assert.deepEqual(ownKeyFromHeaders(headers("openai", key), "ask"), { present: true, own: { provider: "openai", key } });
  assert.deepEqual(ownKeyFromHeaders(headers("gemini", key), "ask"), { present: true, own: { provider: "gemini", key } });
  assert.deepEqual(ownKeyFromHeaders(headers("groq", key), "transcribe"), { present: true, own: { provider: "groq", key } });
  for (const [provider, purpose] of [["groq", "ask"], ["openai", "transcribe"], ["gemini", "transcribe"], ["anthropic", "ask"], ["opencode-go", "ask"], ["unknown", "transcribe"]] as const) {
    assert.deepEqual(ownKeyFromHeaders(headers(provider, key), purpose), { present: true });
  }
  assert.deepEqual(ownKeyFromHeaders(headers("openai", null), "ask"), { present: true });
  assert.deepEqual(ownKeyFromHeaders(headers(null, key), "ask"), { present: true });
  assert.deepEqual(ownKeyFromHeaders(headers("openai", "short"), "ask"), { present: true });
});

test("legacy storage is read without data loss and upgraded on a provider save", () => {
  const fixture = browser();
  try {
    const legacy = { provider: "openai", key: "x".repeat(20) };
    fixture.sessionStorage.setItem("huda-own-key", JSON.stringify(legacy));
    assert.equal(getOwnKey()?.provider, "openai");
    assert.equal(getOwnKey()?.key === legacy.key, true);
    assert.equal(setProviderOwnKey({ provider: "gemini", key: "y".repeat(20) }), true);
    assert.equal(getOwnKey()?.provider, "openai");
    assert.deepEqual(Object.keys(getOwnKeys().keys).sort(), ["gemini", "openai"]);
    const stored = JSON.parse(fixture.sessionStorage.getItem("huda-own-key")!);
    assert.deepEqual(Object.keys(stored).sort(), ["active", "keys"]);
    assert.equal(stored.keys.openai === legacy.key, true);
  } finally { fixture.restore(); }
});

test("new storage rejects invalid keys and cannot select an unsaved provider", () => {
  const fixture = browser();
  try {
    fixture.sessionStorage.setItem("huda-own-key", JSON.stringify({
      keys: { openai: "x".repeat(20), gemini: "short", groq: 42, unknown: "y".repeat(20) }, active: "gemini",
    }));
    assert.deepEqual(Object.keys(getOwnKeys().keys), ["openai"]);
    assert.equal(getOwnKey(), null);
    assert.deepEqual(ownKeyHeaders(), {});
    assert.equal(setActiveOwnKey("gemini"), false);
    assert.equal(setProviderOwnKey({ provider: "gemini", key: "short" }), false);
    assert.equal(setActiveOwnKey("openai"), true);
    assert.equal(getOwnKey()?.provider, "openai");
    assert.equal(clearOwnKey(), true);
    assert.deepEqual(getOwnKeys(), { keys: {} });
  } finally { fixture.restore(); }
});

test("stored keys of the removed providers are ignored without a crash; the rest of the storage still reads", () => {
  const fixture = browser();
  try {
    for (const removed of ["opencode-go", "anthropic"]) {
      fixture.sessionStorage.setItem("huda-own-key", JSON.stringify({ provider: removed, key: "x".repeat(20) }));
      assert.deepEqual(getOwnKeys(), { keys: {} });
      assert.equal(getOwnKey(), null);
      assert.deepEqual(ownKeyHeaders(), {});
      assert.deepEqual(ownTranscribeHeaders(), {});
    }
    fixture.sessionStorage.setItem("huda-own-key", JSON.stringify({
      keys: { "opencode-go": "a".repeat(20), anthropic: "b".repeat(20), gemini: "c".repeat(20), groq: "d".repeat(20) }, active: "anthropic",
    }));
    assert.deepEqual(getOwnKeys(), { keys: { gemini: "c".repeat(20), groq: "d".repeat(20) } });
    assert.equal(getOwnKey(), null, "an active value naming a removed provider selects nothing");
    assert.equal(setActiveOwnKey("gemini"), true);
    assert.equal(ownKeyHeaders()["x-huda-provider"], "gemini");
    // A legacy single record holding the Groq key does not become an Ask key.
    fixture.sessionStorage.setItem("huda-own-key", JSON.stringify({ provider: "groq", key: "x".repeat(20) }));
    assert.equal(getOwnKey(), null);
    assert.equal(ownTranscribeHeaders()["x-huda-provider"], "groq");
  } finally { fixture.restore(); }
});
