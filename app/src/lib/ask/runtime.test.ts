import assert from "node:assert/strict";
import test, { mock } from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { MAX_QUESTION_CHARS, questionWithinLimit, requestAllowed, responseFor, runStage } from "./runtime.ts";
import type { ChoiceProvider } from "./types";

/** Only the headers are read, so a bare object stands in for a request: ten thousand real ones would be slow for no gain. */
const from = (headers: Record<string, string>) => ({ headers: new Headers(headers) }) as unknown as Request;
const forwarded = (ip: string) => from({ "x-forwarded-for": ip });
const burn = (request: Request, times: number) => { for (let i = 0; i < times; i++) requestAllowed(request); };

test("a question may have 300 characters, counted as characters and not as UTF-16 units, and no more", () => {
  assert.equal(MAX_QUESTION_CHARS, 300);
  assert.equal(questionWithinLimit(""), true);
  assert.equal(questionWithinLimit("x".repeat(300)), true);
  assert.equal(questionWithinLimit("x".repeat(301)), false);
  assert.equal(questionWithinLimit("\u{1F600}".repeat(300)), true, "an emoji is one character though it is two UTF-16 units");
  assert.equal(questionWithinLimit("\u{1F600}".repeat(301)), false);
});

test("the quota is ten requests a minute for each address, and one address's use does not count against another's", () => {
  const first = forwarded("quota-first"), second = forwarded("quota-second");
  for (let i = 0; i < 10; i++) assert.equal(requestAllowed(first), true, `request ${i + 1}`);
  assert.equal(requestAllowed(first), false, "the eleventh");
  assert.equal(requestAllowed(first), false, "and every one after it");
  assert.equal(requestAllowed(second), true, "another address starts its own count");
});
test("the address is the first of the forwarded list, trimmed; without it the real-ip header; without both, one shared address", () => {
  burn(forwarded("list-a , list-b, list-c"), 10);
  assert.equal(requestAllowed(forwarded("list-a")), false, "the first entry is the address, spaces around it do not matter");
  assert.equal(requestAllowed(forwarded("list-b")), true, "the later entries are proxies, not the reader");
  burn(from({ "x-real-ip": "real-a" }), 10);
  assert.equal(requestAllowed(from({ "x-real-ip": "real-a" })), false);
  assert.equal(requestAllowed(from({ "x-real-ip": "real-a", "x-forwarded-for": "real-other" })), true, "the forwarded list wins over the real-ip header");
  assert.equal(requestAllowed(from({ "x-real-ip": "real-b" })), true, "another real address has its own count");
  burn(from({}), 10);
  assert.equal(requestAllowed(from({})), false, "requests with no address at all share one count");
  assert.equal(requestAllowed(from({ "x-forwarded-for": "" })), false, "so does an empty forwarded list");
});
test("the count starts again a minute after the first request of its window", () => {
  mock.timers.enable({ apis: ["Date"], now: Date.now() });
  try {
    const request = forwarded("window-ip");
    burn(request, 10);
    assert.equal(requestAllowed(request), false);
    mock.timers.tick(59_999);
    assert.equal(requestAllowed(request), false, "still inside the minute");
    mock.timers.tick(2);
    assert.equal(requestAllowed(request), true, "a new window");
    burn(request, 9);
    assert.equal(requestAllowed(request), false, "with its own ten");
  } finally { mock.timers.reset(); }
});
test("the table of addresses is bounded: with ten thousand addresses being counted a new one is refused, while one already counted still is", () => {
  mock.timers.enable({ apis: ["Date"], now: Date.now() });
  try {
    // Three minutes on, every address counted by the tests above has expired, so the table holds exactly what this test puts in it.
    mock.timers.tick(180_000);
    const first = Array.from({ length: 10_000 }, (_, i) => requestAllowed(forwarded(`flood-${i}`)));
    assert.ok(first.every(Boolean), "all ten thousand fit");
    assert.equal(requestAllowed(forwarded("a-new-address")), false, "no room for the next one");
    assert.equal(requestAllowed(forwarded("flood-0")), true, "an address that is already counted is not turned away by the cap");
    mock.timers.tick(60_001);
    assert.equal(requestAllowed(forwarded("a-new-address")), true, "when the windows end the table empties and there is room again");
  } finally { mock.timers.reset(); }
});

// --- Why a stage failed is told by a fixed code, never by what the provider said ----------------------------------------------------------

const failing = (thrown: unknown): ChoiceProvider => ({ name: "scripted", async choose() { throw thrown; } });
const request = { system: "s", message: "m", stage: "compose" as const };
async function outcomes(provider: ChoiceProvider) {
  const events: { stage: string; provider: string; outcome: string }[] = [];
  await assert.rejects(runStage(request, [provider], 1000, (event: { stage: string; provider: string; outcome: string }) => events.push(event)), { message: "stage_failed" });
  return events;
}
test("a failed stage is logged with a fixed code (http_ and three digits, provider_output, or provider_error), and nothing else the provider said", async () => {
  assert.deepEqual((await outcomes(failing(new Error("http_429")))).map((event) => event.outcome), ["http_429"]);
  assert.deepEqual((await outcomes(failing(new Error("provider_output")))).map((event) => event.outcome), ["provider_output"]);
  for (const said of [new Error("http_42"), new Error("http_4290"), new Error("http_429 secret-key-sk-123"), new Error("secret-key-sk-123"), new Error("timeout"), "http_429", { message: "http_429" }, undefined]) {
    const events = await outcomes(failing(said));
    assert.deepEqual(events.map((event) => event.outcome), ["provider_error"], String(said));
    assert.ok(!JSON.stringify(events).includes("secret"), "what the provider said reached the log");
  }
});
test("a stage that works is logged as ok, with the stage and the provider's name", async () => {
  const events: { stage: string; provider: string; outcome: string }[] = [];
  const value = await runStage(request, [{ name: "scripted", async choose() { return { fine: true }; } }], 1000, (event: { stage: string; provider: string; outcome: string }) => events.push(event));
  assert.deepEqual(value, { fine: true });
  assert.deepEqual(events.map(({ stage, provider, outcome }) => ({ stage, provider, outcome })), [{ stage: "compose", provider: "scripted", outcome: "ok" }]);
});

test("a fixed reply carries the status and no atoms, is never cacheable, and takes the HTTP status it is given", async () => {
  for (const status of ["answer", "insufficient", "fatwa", "out_of_scope", "not_arabic", "unavailable"] as const) {
    const reply = responseFor(status);
    assert.equal(reply.status, 200);
    assert.equal(reply.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await reply.json(), { status, atoms: [] });
  }
  for (const code of [400, 404, 429]) {
    const reply = responseFor("insufficient", code);
    assert.equal(reply.status, code);
    assert.equal(reply.headers.get("Cache-Control"), "no-store");
  }
});
