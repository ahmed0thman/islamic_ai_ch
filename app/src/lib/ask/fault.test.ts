import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { answer } from "./answer.ts";
// @ts-expect-error -- Node requires source extensions.
import { classifyAnthropicFault, classifyFault, faultStopsRequest, ProviderError, retryAfterMs } from "./fault.ts";
// @ts-expect-error -- Node requires source extensions.
import { fetchRetry, runStage, StageFailed } from "./runtime.ts";
// @ts-expect-error -- Node requires source extensions.
import { openaiProvider, providersFromEnv, providersFromKey } from "./providers.ts";
// @ts-expect-error -- Node requires source extensions.
import { anthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./select.ts";
import type { Atom, ChoiceProvider } from "./types";

// The words below are the ones OpenAI sent for the cases in the names (shortened); the code only ever keeps the fixed fault they map to.
const RPM = "Rate limit reached for gpt-6-luna in organization org-x on requests per min (RPM): Limit 10, Used 10, Requested 1. Please try again in 6s. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.";
const RPD = "Rate limit reached for gpt-6-luna in organization org-x on requests per day (RPD): Limit 50, Used 50, Requested 1. Please try again in 28m48s. Visit https://platform.openai.com/account/rate-limits.";
const CREDIT = '{"error":{"message":"You have no credits remaining. Add credits to continue using the API.","type":"insufficient_quota","code":"credit_balance_exhausted"}}';

test("a refusal is classified into one fixed fault: a per-minute cap is not a daily cap, and the billing link in a rate-limit message is not a missing credit", () => {
  assert.equal(classifyFault(429, RPM), "rate_limit");
  assert.equal(classifyFault(429, ""), "rate_limit");
  assert.equal(classifyFault(429, RPD), "quota");
  assert.equal(classifyFault(429, CREDIT), "quota");
  assert.equal(classifyFault(401, "Incorrect API key provided: sk-xxxx"), "key_rejected");
  assert.equal(classifyFault(400, "Incorrect API key provided"), "key_rejected");
  assert.equal(classifyFault(403, "Forbidden"), "key_rejected");
  assert.equal(classifyFault(404, '{"error":{"code":"model_not_found","message":"The model `x` does not exist or you do not have access to it."}}'), "model_unavailable");
  assert.equal(classifyFault(403, "Project does not have access to model `x`"), "model_unavailable");
  assert.equal(classifyFault(400, "Invalid schema for response_format"), "other");
  assert.equal(classifyFault(500, "oops"), "other");
  assert.equal(faultStopsRequest("other"), false);
  assert.equal(faultStopsRequest(undefined), false);
  for (const fault of ["rate_limit", "quota", "key_rejected", "model_unavailable"] as const) assert.equal(faultStopsRequest(fault), true);
});

test("how long the provider asks to wait is read from retry-after-ms, retry-after, or the words of the message", () => {
  assert.equal(retryAfterMs(new Headers({ "retry-after-ms": "250" }), ""), 250);
  assert.equal(retryAfterMs(new Headers({ "retry-after": "7" }), ""), 7000);
  assert.equal(retryAfterMs(new Headers(), RPM), 6000);
  assert.equal(retryAfterMs(new Headers(), RPD), 28 * 60_000 + 48_000);
  assert.equal(retryAfterMs(new Headers(), "Please try again in 1.5s."), 1500);
  assert.equal(retryAfterMs(new Headers(), "try again in 20ms"), 20);
  assert.equal(retryAfterMs(new Headers(), "no hint here"), undefined);
});

/** Replaces fetch with a script of responses and counts the calls; always restored. */
async function withFetch(script: () => Response, run: () => Promise<void>) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return script(); };
  try { await run(); } finally { globalThis.fetch = original; }
  return calls;
}
const limited = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 429, headers });

test("fetchRetry: no credit or a daily cap is never retried, and the refusal is handed back with its body intact", async () => {
  for (const body of [CREDIT, RPD]) {
    let status = 0, text = "";
    const calls = await withFetch(() => limited(body), async () => { const response = await fetchRetry("https://example.test", {}); status = response.status; text = await response.text(); });
    assert.equal(calls, 1);
    assert.equal(status, 429);
    assert.equal(text, body);
  }
});
test("fetchRetry: a per-minute cap is waited out for as long as the provider asks when that fits, and handed back at once when it does not", async () => {
  let n = 0;
  const started = Date.now();
  const calls = await withFetch(() => ++n === 1 ? limited(RPM, { "retry-after-ms": "100" }) : Response.json({ ok: true }), async () => {
    assert.equal((await fetchRetry("https://example.test", {})).status, 200);
  });
  assert.equal(calls, 2);
  const waited = Date.now() - started;
  assert.ok(waited >= 340 && waited < 700, `waited ${waited} ms: the asked 100 ms and a quarter second`);
  // Longer than the cap on any wait: not waited for.
  assert.equal(await withFetch(() => limited(RPM, { "retry-after": "60" }), async () => { assert.equal((await fetchRetry("https://example.test", {})).status, 429); }), 1);
  // Shorter than the cap but longer than the stage's deadline allows: not waited for either.
  assert.equal(await withFetch(() => limited(RPM, { "retry-after": "6" }), async () => {
    assert.equal((await fetchRetry("https://example.test", {}, 3, Date.now() + 4_000)).status, 429);
  }), 1);
});

test("runStage tells the fault of a refusal in the event and in the error it ends with, and nothing the provider said", async () => {
  const refuse = (fault: ConstructorParameters<typeof ProviderError>[1]): ChoiceProvider => ({ name: "scripted", async choose() { throw new ProviderError(429, fault); } });
  const events: { outcome: string; fault?: string }[] = [];
  await assert.rejects(runStage({ system: "s", message: "m", stage: "compose" }, [refuse("quota")], 1000, (event: { outcome: string; fault?: string }) => events.push(event)),
    (error: unknown) => error instanceof StageFailed && error.fault === "quota" && error.message === "stage_failed");
  assert.deepEqual(events.map(({ outcome, fault }) => ({ outcome, fault })), [{ outcome: "http_429", fault: "quota" }]);
  // The fault is that of the last provider: a plain failure after a refusal says nothing.
  await assert.rejects(runStage({ system: "s", message: "m", stage: "compose" }, [refuse("quota"), { name: "b", async choose() { throw new Error("x"); } }], 1000, () => {}),
    (error: unknown) => error instanceof StageFailed && error.fault === undefined);
  // The deadline is handed to the provider.
  let seen: number | undefined;
  await runStage({ system: "s", message: "m", stage: "compose" }, [{ name: "d", async choose(request) { seen = request.deadline; return {}; } }], 1000, () => {});
  assert.ok(seen !== undefined && seen > Date.now() && seen <= Date.now() + 1000);
});

const atoms: Atom[] = [{ id: "a", text: "verified sentence", segments: [{ t: "text", v: "verified sentence" }], records: ["r"], role: "claim", level: 0 }];

test("a refusal that asking again cannot cure ends the question at the first call: no second try, no extractive fallback", async () => {
  for (const fault of ["quota", "rate_limit", "key_rejected", "model_unavailable"] as const) {
    let calls = 0;
    const provider: ChoiceProvider = { name: "scripted", async choose() { calls++; throw new ProviderError(429, fault); } };
    const events: { stage: string; outcome: string; fault?: string }[] = [];
    const result = await answer("ما معنى سجى؟", atoms, undefined, [provider], { observe: (event: { stage: string; outcome: string; fault?: string }) => events.push(event), log: () => {} });
    assert.deepEqual(result, { status: "unavailable", atoms: [] }, fault);
    assert.equal(calls, 1, `${fault}: one call only`);
    assert.equal(events.find((event) => event.fault)?.fault, fault);
  }
  // An ordinary hiccup still gets its one more try, as before.
  let calls = 0;
  await answer("ما معنى سجى؟", atoms, undefined, [{ name: "scripted", async choose() { calls++; throw new Error("boom"); } }], { log: () => {} });
  assert.ok(calls > 2, `a hiccup is retried (${calls} calls)`);
});

test("a judge's OpenAI key: its own model setting, and the backup model only when the first is not open to the key", async () => {
  const original = globalThis.fetch;
  const models: string[] = [];
  let first = () => new Response('{"error":{"code":"model_not_found","message":"The model does not exist or you do not have access to it."}}', { status: 404 });
  const ok = () => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"status":"insufficient","atom_ids":[]}' }] }] });
  globalThis.fetch = async (_url, options) => {
    const model = JSON.parse(String(options!.body)).model;
    models.push(model);
    return model === "gpt-6-luna" ? first() : ok();
  };
  const request = { system: "s", message: "m", signal: new AbortController().signal };
  try {
    assert.deepEqual(await providersFromKey("openai", "test-only-sentinel-fallback", {})[0].choose(request), { status: "insufficient", atom_ids: [] });
    assert.deepEqual(models, ["gpt-6-luna", "gpt-5-mini"]);
    models.length = 0;
    await providersFromKey("openai", "test-only-sentinel-fallback", { HUDA_ASK_OPENAI_FALLBACK_MODEL: "backup-x" })[0].choose(request);
    assert.deepEqual(models, ["gpt-6-luna", "backup-x"]);
    // Switched off: the refusal stands.
    models.length = 0;
    await assert.rejects(providersFromKey("openai", "test-only-sentinel-fallback", { HUDA_ASK_OPENAI_FALLBACK_MODEL: "" })[0].choose(request), (error: unknown) => error instanceof ProviderError && error.fault === "model_unavailable");
    assert.deepEqual(models, ["gpt-6-luna"]);
    // A missing credit would be the same on any model: no backup is tried.
    models.length = 0;
    first = () => new Response(CREDIT, { status: 429 });
    await assert.rejects(providersFromKey("openai", "test-only-sentinel-fallback", {})[0].choose(request), (error: unknown) => error instanceof ProviderError && error.fault === "quota");
    assert.deepEqual(models, ["gpt-6-luna"]);
    // The project's own OpenAI provider is unchanged by all this.
    models.length = 0;
    await openaiProvider("project-key", "gpt-6-luna").choose(request).catch(() => {});
    assert.deepEqual(models, ["gpt-6-luna"]);
  } finally { globalThis.fetch = original; }
});

// What Anthropic sends for each case in the names (the credit-balance wording is the real one, shortened); only the fixed fault they map to is ever kept.
const ANTHROPIC_CREDIT = '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}';
const anthropicRefusals = [
  [401, '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}', "key_rejected"],
  [403, '{"type":"error","error":{"type":"permission_error","message":"Your API key does not have permission to use the specified resource."}}', "key_rejected"],
  [400, ANTHROPIC_CREDIT, "quota"],
  [429, '{"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}', "rate_limit"],
  [404, '{"type":"error","error":{"type":"not_found_error","message":"model: x"}}', "model_unavailable"],
  [400, '{"type":"error","error":{"type":"invalid_request_error","message":"messages: text content blocks must be non-empty"}}', "other"],
  [500, '{"type":"error","error":{"type":"api_error","message":"Internal server error"}}', "other"],
  [529, '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}', "other"],
] as const;

test("Anthropic refusals: the status says the fault, a 400 only when it is the credit balance, and anything else is other", () => {
  for (const [status, body, fault] of anthropicRefusals) assert.equal(classifyAnthropicFault(status, body), fault, `${status}`);
  assert.equal(classifyAnthropicFault(400, ""), "other");
  assert.equal(classifyAnthropicFault(200, ANTHROPIC_CREDIT), "other");
});

test("the Anthropic provider throws the classified ProviderError for each refusal, with none of the provider's words in it, and does not retry what a retry cannot cure", async () => {
  const original = globalThis.fetch;
  const request = { system: "s", message: "m", signal: new AbortController().signal };
  try {
    // A 429 with a long retry-after is handed back at once; a 500 is retried by fetchRetry (2.5 s of backoff), so its class is checked above and not here.
    for (const [status, body, fault] of anthropicRefusals.filter(([status]) => status !== 500)) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response(body, { status, headers: status === 429 ? { "retry-after": "60" } : {} }); };
      await assert.rejects(anthropicProvider("test-only-sentinel-anthropic", "m").choose(request), (error: unknown) => {
        assert.ok(error instanceof ProviderError);
        assert.equal(error.fault, fault);
        assert.equal(error.status, status);
        assert.equal(error.message, `http_${status}`);
        assert.equal(error.message.includes("credit"), false);
        return true;
      }, `${status}`);
      assert.equal(calls, 1, `${status}: one call`);
    }
  } finally { globalThis.fetch = original; }
});

test("a judge's Anthropic key that is refused ends the question at the first call: no second try, no extractive fallback", async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, body, fault] of anthropicRefusals.filter(([, , kind]) => kind !== "other")) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response(body, { status, headers: status === 429 ? { "retry-after": "60" } : {} }); };
      const events: { stage: string; provider: string; outcome: string; fault?: string }[] = [];
      const result = await answer("question", atoms, undefined, providersFromKey("anthropic", "test-only-sentinel-anthropic", {}),
        { observe: (event: { stage: string; provider: string; outcome: string; fault?: string }) => events.push(event), log: () => {} });
      assert.deepEqual(result, { status: "unavailable", atoms: [] }, `${status}`);
      assert.equal(calls, 1, `${status}: one provider call`);
      assert.deepEqual(events.filter((event) => event.provider === "anthropic").map(({ fault: why }) => why), [fault]);
    }
  } finally { globalThis.fetch = original; }
});

test("a judge's Anthropic key is composed through a tool_use answer, with the model of its own setting and no effort or thinking parameter", async () => {
  const original = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(String(options!.body)));
    return Response.json({ stop_reason: "tool_use", content: [{ type: "text", text: "prose that is never used" },
      { type: "tool_use", name: "choose_sentences", input: { status: "answer", sentences: [{ kind: "claim", text: "a verified sentence", cites: ["a"] }] } }] });
  };
  try {
    const result = await answer("question", atoms, undefined, providersFromKey("anthropic", "test-only-sentinel-anthropic", { HUDA_ASK_MODEL: "project-model" }),
      { support: false, log: () => {} });
    assert.equal(result.status, "answer");
    assert.equal(result.mode, "composed");
    assert.deepEqual(result.composed, [{ text: "a verified sentence", atom_ids: ["a"] }]);
    assert.equal(bodies.length, 1);
    // HUDA_ASK_MODEL names a model of the project's own chain; a judge's key never takes it.
    assert.equal(bodies[0].model, DEFAULT_ANTHROPIC_MODEL);
    assert.deepEqual(Object.keys(bodies[0]).sort(), ["max_tokens", "messages", "model", "system", "tool_choice", "tools"]);
    bodies.length = 0;
    await providersFromKey("anthropic", "test-only-sentinel-anthropic", { HUDA_ASK_ANTHROPIC_MODEL: "claude-custom" })[0].choose({ system: "s", message: "m", signal: new AbortController().signal });
    assert.equal(bodies[0].model, "claude-custom");
    // The project's own Anthropic provider reads the same variable first, then HUDA_ASK_MODEL, then the default.
    for (const [env, model] of [[{ HUDA_ASK_ANTHROPIC_MODEL: "claude-custom", HUDA_ASK_MODEL: "other" }, "claude-custom"], [{ HUDA_ASK_MODEL: "other" }, "other"], [{}, DEFAULT_ANTHROPIC_MODEL]] as const) {
      bodies.length = 0;
      await providersFromEnv({ HUDA_ASK_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "project-only-anthropic", ...env })[0].choose({ system: "s", message: "m", signal: new AbortController().signal });
      assert.equal(bodies[0].model, model);
    }
  } finally { globalThis.fetch = original; }
});
