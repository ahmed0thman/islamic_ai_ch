import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { opencodeGoProvider, openaiCompatibleProvider, providersFromEnv, lexicalProvider, geminiProvider } from "./providers.ts";
// @ts-expect-error -- Node requires source extensions.
import { fetchRetry, runStage } from "./runtime.ts";
// @ts-expect-error -- Node requires source extensions.
import { answer } from "./answer.ts";
// @ts-expect-error -- Node requires source extensions.
import { COMPOSE_SCHEMA } from "./compose.ts";
// @ts-expect-error -- Node requires source extensions.
import { SUPPORT_SCHEMA } from "./support.ts";
// @ts-expect-error -- Node requires source extensions.
import { CHOICE_SCHEMA, anthropicProvider } from "./select.ts";
import type { Atom, ChoiceProvider, SelectionRequest } from "./types";
const request: SelectionRequest = { system: "strict", message: "data", signal: new AbortController().signal, schema: COMPOSE_SCHEMA, stage: "compose" };
const output = { status: "insufficient", sentences: [] };
const responses = (value: unknown = output) => Response.json({ status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
const atoms: Atom[] = [{ id: "a", text: "alpha beta", role: "claim", level: 1, segments: [], records: [] }];
const noLog = { log: () => {}, mode: "composed" as const, support: true };

test("OpenCode Go Responses schema request, model override, JSON parsing and stable process session", async () => {
  const original = globalThis.fetch;
  let session: string | undefined;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://opencode.ai/zen/go/v1/responses");
    assert.equal(options!.method, "POST");
    assert.equal(options!.signal, request.signal);
    const headers = options!.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer fake");
    assert.equal(headers["content-type"], "application/json");
    assert.equal(headers["user-agent"], "huda-ask/1.0");
    assert.ok(headers["x-opencode-session"]);
    if (session) assert.equal(headers["x-opencode-session"], session);
    session = headers["x-opencode-session"];
    assert.deepEqual(JSON.parse(options!.body as string), { model: "custom", instructions: "strict", input: "data", text: { format: { type: "json_schema", name: "ask_response", strict: true, schema: COMPOSE_SCHEMA } } });
    return responses();
  };
  try {
    for (let i = 0; i < 2; i++) assert.deepEqual(await opencodeGoProvider("fake", "custom").choose(request), output);
  } finally { globalThis.fetch = original; }
});

test("Responses falls back to plain JSON instructions only on schema rejection", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    if (++calls === 1) return Response.json({ error: { message: "Unsupported JSON schema" } }, { status: 400 });
    assert.ok(!Object.hasOwn(body, "text"));
    assert.ok(body.instructions.includes(JSON.stringify(COMPOSE_SCHEMA)));
    assert.ok(body.instructions.startsWith(request.system));
    return responses();
  };
  try {
    assert.deepEqual(await opencodeGoProvider("fake").choose(request), output);
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: "MissingSessionID" }, { status: 400 }); };
    await assert.rejects(opencodeGoProvider("fake").choose(request));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("Responses incomplete, refusal, bad JSON, missing text and non-schema errors fail closed", async () => {
  const original = globalThis.fetch;
  try {
    for (const value of [{ status: "incomplete", output: [] }, { status: "completed", error: "error", output: [] },
      { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] },
      { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "invalid" }] }] },
      { status: "completed", output: [] }]) {
      globalThis.fetch = async () => Response.json(value);
      await assert.rejects(opencodeGoProvider("fake").choose(request));
    }
  } finally { globalThis.fetch = original; }
});

test("generic chat-completions provider retains exact structured output request and temperature zero", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://example.test/v1/chat/completions");
    assert.deepEqual(JSON.parse(options!.body as string), { model: "m", temperature: 0, messages: [{ role: "system", content: "strict" }, { role: "user", content: "data" }], response_format: { type: "json_schema", json_schema: { name: "ask_response", strict: true, schema: COMPOSE_SCHEMA } } });
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }] });
  };
  try { assert.deepEqual(await openaiCompatibleProvider({ baseUrl: "https://example.test/v1/", apiKey: "fake", model: "m" }).choose(request), output); }
  finally { globalThis.fetch = original; }
});

test("Gemini/Anthropic accept compose and support schemas, not only selection", async () => {
  const original = globalThis.fetch;
  try {
    for (const [schema, stage] of [[COMPOSE_SCHEMA, "compose"], [SUPPORT_SCHEMA, "support"]] as const) {
      globalThis.fetch = async (_url, options) => {
        const body = JSON.parse(options!.body as string);
        assert.deepEqual(body.generationConfig.responseJsonSchema, schema);
        return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(output) }] } }] });
      };
      assert.deepEqual(await geminiProvider("fake").choose({ ...request, schema, stage }), output);
      globalThis.fetch = async (_url, options) => {
        const body = JSON.parse(options!.body as string);
        assert.deepEqual(body.tools[0].input_schema, schema);
        return Response.json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "choose_sentences", input: output }] });
      };
      assert.deepEqual(await anthropicProvider("fake").choose({ ...request, schema, stage }), output);
    }
  } finally { globalThis.fetch = original; }
});

test("all retryable statuses retry; 700/1800 backoffs cap attempts at three", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [429, 500, 502, 503, 504]) {
      let calls = 0;
      globalThis.fetch = async () => ++calls === 1 ? new Response(null, { status }) : Response.json({ ok: true });
      assert.equal((await fetchRetry("https://example.test", { signal: request.signal })).status, 200);
      assert.equal(calls, 2);
    }
    let calls = 0;
    const start = Date.now();
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 503 }); };
    assert.equal((await fetchRetry("https://example.test", { signal: request.signal })).status, 503);
    assert.equal(calls, 3);
    assert.ok(Date.now() - start >= 2450);
    calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 401 }); };
    assert.equal((await fetchRetry("https://example.test", {})).status, 401);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("aborting during retry backoff prevents another HTTP call", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 503 }); };
  const timer = setTimeout(() => controller.abort(), 5);
  try { await assert.rejects(fetchRetry("https://example.test", { signal: controller.signal })); assert.equal(calls, 1); }
  finally { clearTimeout(timer); globalThis.fetch = original; }
});

test("provider chain defaults and explicit order; exhausted retries move same stage to next provider", async () => {
  const env = { OPENCODE_GO_API_KEY: "fake", GEMINI_API_KEY: "fake", ANTHROPIC_API_KEY: "fake" };
  assert.deepEqual(providersFromEnv(env).map((provider) => provider.name), ["opencode-go", "gemini", "anthropic"]);
  assert.deepEqual(providersFromEnv({ ...env, HUDA_ASK_PROVIDER: "gemini,opencode-go,gemini" }).map((provider) => provider.name), ["gemini", "opencode-go"]);
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (url, options) => {
    urls.push(String(url));
    if (String(url).includes("opencode")) return new Response(null, { status: 503 });
    assert.deepEqual(JSON.parse(options!.body as string).generationConfig.responseJsonSchema, COMPOSE_SCHEMA);
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(output) }] } }] });
  };
  try {
    assert.deepEqual(await runStage(request, providersFromEnv({ ...env, HUDA_ASK_PROVIDER: "opencode-go,gemini" }), 8000, () => {}), output);
    assert.equal(urls.filter((url) => url.includes("opencode")).length, 3);
    assert.equal(urls.length, 4);
  } finally { globalThis.fetch = original; }
});

test("chain timeouts reserve next provider time and parent cancellation halts the chain", async () => {
  const hung: ChoiceProvider = { name: "hung", choose: () => new Promise(() => {}) };
  const next: ChoiceProvider = { name: "next", async choose() { return output; } };
  assert.deepEqual(await runStage(request, [hung, next], 30, () => {}), output);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5);
  try { await assert.rejects(runStage(request, [hung, next], 100, () => {}, controller.signal)); }
  finally { clearTimeout(timer); }
});

test("fake-fetch flow exercises compose/support parsing and all three fallback stages", async () => {
  const original = globalThis.fetch;
  try {
    for (const failure of [undefined, "compose", "verify", "support", "all"]) {
      globalThis.fetch = async (_url, options) => {
        const schema = JSON.parse(options!.body as string).generationConfig.responseJsonSchema;
        let result: unknown;
        if (schema.properties.sentences) result = failure === "compose" || failure === "all" ? {} : { status: "answer", sentences: [{ text: failure === "verify" ? "Invented 999" : "alpha beta", cites: ["a"] }] };
        else if (schema.properties.verdicts) result = { verdicts: [{ index: 0, supported: failure !== "support" }] };
        else { assert.deepEqual(schema.required, CHOICE_SCHEMA.required); result = failure === "all" ? {} : { status: "answer", atom_ids: ["a"] }; }
        return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(result) }] } }] });
      };
      const result = await answer("q", atoms, undefined, geminiProvider("fake"), noLog);
      // Every stage returned an output with no shape: the chain failed, which is not "nothing in our sources".
      assert.equal(result.status, failure === "all" ? "unavailable" : "answer");
      assert.equal(result.mode, failure === "all" ? undefined : failure ? "extractive" : "composed");
    }
    const result = await answer("alpha beta", atoms, undefined, lexicalProvider(), noLog);
    assert.equal(result.mode, "extractive");
  } finally { globalThis.fetch = original; }
});
