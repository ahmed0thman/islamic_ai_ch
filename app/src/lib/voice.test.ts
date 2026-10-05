import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { acceptFix, contextFor, DEFAULT_FIX_MODEL, DEFAULT_STT_MODEL, GROQ_BASE_URL, HINT_MAX_CHARS, hintSentence, plainQuranWords, shortAuthor, transcribeQuestion } from "./voice.ts";
// @ts-expect-error -- Node requires source extensions.
import { buildQuranTrigrams } from "./ask/verify.ts";
// @ts-expect-error -- Node requires source extensions.
import { readerUnits } from "./ask/atoms.ts";
import type { HintText, VoiceContext } from "./voice";
import type { Surah } from "./types";

const ar = (...points: number[]) => String.fromCodePoint(...points);
const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
const hint: HintText = { intro: "Q {surah}.", stop: "S {stop}.", scholars: "A {list}.", terms: "T {list}.", words: "W {list}." };
const context: VoiceContext = { surahName: "SurahName", terms: [], authors: [], words: ["beta"], stopAyahs: [] };
const base = (env: Record<string, string>, fetchImpl: typeof fetch, extra: object = {}) =>
  ({ audio, filename: "q.webm", context, hintText: hint, live: false, env, fetchImpl, ...extra });

/** A fetch stub that records calls and replays scripted replies in order. */
function scriptFetch(replies: ((options: RequestInit) => Promise<Response>)[], ) {
  const calls: { url: string; options: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (actual, options) => {
    calls.push({ url: String(actual), options: options! });
    if (calls.length > replies.length) throw new Error("unexpected network call");
    return replies[calls.length - 1](options!);
  };
  return { calls, fetchImpl };
}
const times = (n: number, text: string) => Array.from({ length: n }, () => text).join(" ");

test("no key means the voice path is unavailable and nothing is fetched", async () => {
  const fetchImpl: typeof fetch = async () => { throw new Error("unexpected network call"); };
  assert.deepEqual(await transcribeQuestion(base({}, fetchImpl)), { status: "unavailable" });
});

test("a local STT url transcribes with no Groq key and skips repair", async () => {
  const transcript = "\u0645\u0631\u062d\u0628\u0627 \u0639\u0627\u0644\u0645";
  const { calls, fetchImpl } = scriptFetch([async () => Response.json({ text: transcript })]);
  assert.deepEqual(await transcribeQuestion(base({ HUDA_VOICE_STT_URL: "http://127.0.0.1:8178/v1/" }, fetchImpl)),
    { status: "ok", text: transcript, corrected: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:8178/v1/audio/transcriptions");
  assert.equal((calls[0].options.headers as Record<string, string>).authorization, undefined);
});

test("speech request shape: url, bearer, verified fields, and a natural-sentence prompt", async () => {
  const { calls, fetchImpl } = scriptFetch([async () => Response.json({ text: "alpha beta gamma" })]);
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, fetchImpl, { live: true })),
    { status: "ok", text: "alpha beta gamma", corrected: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${GROQ_BASE_URL}/audio/transcriptions`);
  assert.equal(calls[0].options.method, "POST");
  assert.equal((calls[0].options.headers as Record<string, string>).authorization, "Bearer k");
  const form = calls[0].options.body as FormData;
  const file = form.get("file") as File;
  assert.ok(file instanceof Blob);
  assert.equal(file.name, "q.webm");
  assert.equal(form.get("model"), DEFAULT_STT_MODEL);
  assert.equal(form.get("language"), "ar");
  assert.equal(form.get("response_format"), "verbose_json");
  assert.equal(form.get("temperature"), "0");
  const prompt = String(form.get("prompt"));
  assert.ok(prompt.length >= 1 && [...prompt].length <= HINT_MAX_CHARS);
  // A sentence naming the reading context, never a bare word list.
  assert.ok(prompt.includes("Q SurahName.") && prompt.includes("W beta."));
  const later = scriptFetch([async () => Response.json({ text: "alpha beta gamma" })]);
  assert.equal((await transcribeQuestion(base({ GROQ_API_KEY: "k", HUDA_VOICE_STT_MODEL: "custom-stt" }, later.fetchImpl, { live: true }))).status, "ok");
  assert.equal((later.calls[0].options.body as FormData).get("model"), "custom-stt");
});

test("HTTP 400 retries once without the prompt, then errors; 429 is busy; 500 is error", async () => {
  const retry = scriptFetch([
    async () => new Response("bad prompt", { status: 400 }),
    async () => Response.json({ text: "alpha beta gamma" }),
  ]);
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, retry.fetchImpl, { live: true })),
    { status: "ok", text: "alpha beta gamma", corrected: false });
  assert.equal(retry.calls.length, 2);
  assert.equal((retry.calls[1].options.body as FormData).get("prompt"), null);
  const still400 = scriptFetch([
    async () => new Response("bad", { status: 400 }),
    async () => new Response("bad", { status: 400 }),
  ]);
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, still400.fetchImpl, { live: true })), { status: "error" });
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, async () => Response.json({}, { status: 429 }), { live: true })), { status: "busy" });
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, async () => Response.json({}, { status: 500 }), { live: true })), { status: "error" });
  const down: typeof fetch = async () => { throw new Error("down"); };
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, down, { live: true })), { status: "error" });
});

test("invented text on silence or an empty transcript is empty", async () => {
  const quiet = Response.json({ text: "something imagined", segments: [{ no_speech_prob: 0.9 }, { no_speech_prob: 0.95 }] });
  for (const reply of [quiet, Response.json({ text: "" }), Response.json({ text: "  " })]) {
    assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, async () => reply, { live: true })), { status: "empty" });
  }
  const loud = Response.json({ text: "alpha beta gamma", segments: [{ no_speech_prob: 0.1 }] });
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, async () => loud, { live: true })),
    { status: "ok", text: "alpha beta gamma", corrected: false });
});

test("a transcript longer than 300 characters is cut at the last whitespace before 300", async () => {
  const word = "a".repeat(30);
  const fetchImpl: typeof fetch = async () => Response.json({ text: `${times(10, word)} ${word}` });
  const result = await transcribeQuestion(base({ GROQ_API_KEY: "k" }, fetchImpl, { live: true }));
  assert.equal(result.status, "ok");
  assert.ok(result.status === "ok" && result.text.length === 278 && result.text.startsWith(word) && result.text.endsWith(word));
});

test("a provisional request never reaches the repair model", async () => {
  const { calls, fetchImpl } = scriptFetch([async () => Response.json({ text: "alpha beta gamma" })]);
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k", HUDA_VOICE_FIX_MODEL: "fixer" }, fetchImpl, { live: true })),
    { status: "ok", text: "alpha beta gamma", corrected: false });
  assert.equal(calls.length, 1);
});

test("repair switched off by env on a final request", async () => {
  const { calls, fetchImpl } = scriptFetch([async () => Response.json({ text: "alpha beta gamma" })]);
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k", HUDA_VOICE_FIX_MODEL: "0" }, fetchImpl)),
    { status: "ok", text: "alpha beta gamma", corrected: false });
  assert.equal(calls.length, 1);
});

test("the default final request gets a repair call with its exact shape", async () => {
  const { calls, fetchImpl } = scriptFetch([
    async () => Response.json({ text: "alpha one two" }),
    async () => Response.json({ choices: [{ message: { content: JSON.stringify({ text: "alpha one two" }) } }] }),
  ]);
  const result = await transcribeQuestion(base({ GROQ_API_KEY: "k" }, fetchImpl));
  assert.deepEqual(result, { status: "ok", text: "alpha one two", corrected: false });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, `${GROQ_BASE_URL}/chat/completions`);
  const body = JSON.parse(calls[1].options.body as string);
  assert.equal(body.model, DEFAULT_FIX_MODEL);
  assert.equal(body.temperature, 0);
  assert.equal(body.reasoning_effort, "low");
  assert.equal(body.include_reasoning, false);
  assert.equal(body.max_tokens, 400);
  assert.deepEqual(body.response_format, { type: "json_object" });
  const user = JSON.parse(body.messages[1].content);
  assert.deepEqual(user, { transcript: "alpha one two", surah: "SurahName", stop_title: null, stop_ayahs: [], terms: [], scholars: [], surah_words: ["beta"] });
});

test("an accepted repair sets corrected and keeps the repaired text", async () => {
  // The hint names the replaced word, so the substitution passes its closeness check.
  const { calls, fetchImpl } = scriptFetch([
    async () => Response.json({ text: "alpha one two" }),
    async () => Response.json({ choices: [{ message: { content: JSON.stringify({ text: "alpha beta two" }) } }] }),
  ]);
  const filled: VoiceContext = { ...context, words: ["beta", "alpha"] };
  const result = await transcribeQuestion({ audio, filename: "q.webm", context: filled, hintText: hint, live: false, env: { GROQ_API_KEY: "k" }, fetchImpl });
  assert.deepEqual(result, { status: "ok", text: "alpha beta two", corrected: true });
  assert.equal(calls.length, 2);
});

test("a repair HTTP 400 retries once without the reasoning fields", async () => {
  const { calls, fetchImpl } = scriptFetch([
    async () => Response.json({ text: "alpha one two" }),
    async () => new Response("bad option", { status: 400 }),
    async () => Response.json({ choices: [{ message: { content: JSON.stringify({ text: "alpha one two" }) } }] }),
  ]);
  const result = await transcribeQuestion(base({ GROQ_API_KEY: "k" }, fetchImpl));
  assert.deepEqual(result, { status: "ok", text: "alpha one two", corrected: false });
  assert.equal(calls.length, 3);
  const retried = JSON.parse(calls[2].options.body as string);
  assert.equal(Object.hasOwn(retried, "reasoning_effort"), false);
  assert.equal(Object.hasOwn(retried, "include_reasoning"), false);
});

test("a repair that drifts too far is rejected and the raw transcript is kept", async () => {
  const drift = scriptFetch([
    async () => Response.json({ text: "w1 w2 w3 w4 w5" }),
    async () => Response.json({ choices: [{ message: { content: JSON.stringify({ text: "q1 q2 q3 w4 w5" }) } }] }),
  ]);
  assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, drift.fetchImpl)),
    { status: "ok", text: "w1 w2 w3 w4 w5", corrected: false });
});

test("every repair failure mode keeps the raw transcript without erroring", async () => {
  const replies: ((options?: RequestInit) => Promise<Response>)[] = [
    async () => { throw new Error("network"); },
    async () => Response.json({ choices: [{ message: { content: "not json" } }] }),
    async () => Response.json({ choices: [{ message: { content: JSON.stringify({ wrong: 1 }) } }] }),
    async () => Response.json({ choices: [] }),
    async () => Response.json({ choices: [{ message: { content: JSON.stringify({ text: "     " }) } }] }),
  ];
  for (const reply of replies) {
    const { calls, fetchImpl } = scriptFetch([
      async () => Response.json({ text: "alpha one two" }),
      reply as () => Promise<Response>,
    ]);
    assert.deepEqual(await transcribeQuestion(base({ GROQ_API_KEY: "k" }, fetchImpl)),
      { status: "ok", text: "alpha one two", corrected: false });
    assert.equal(calls.length, 2);
  }
});

test("acceptFix covers length, count, distance, quran trigrams and digits", () => {
  const grams = buildQuranTrigrams(["alpha beta gamma delta"]);
  assert.deepEqual(acceptFix("alpha one two", "alpha beta two", "beta"), { ok: true });
  assert.deepEqual(acceptFix("alpha one two", "alpha one two", ""), { ok: true });
  assert.deepEqual(acceptFix("alpha one two", `${times(40, "longword")}`, ""), { ok: false, reason: "length" });
  assert.deepEqual(acceptFix("alpha one two", "alpha one two delta epsilon zeta eta", ""), { ok: false, reason: "count" });
  assert.deepEqual(acceptFix("w1 w2 w3 w4 w5", "q1 q2 q3 w4 w5", ""), { ok: false, reason: "distance" });
  assert.deepEqual(acceptFix("alpha beta jazz", "alpha beta gamma", "gamma", grams), { ok: false, reason: "quran" });
  assert.deepEqual(acceptFix("alpha beta", "alpha beta \uFD3E x", ""), { ok: false, reason: "quran" });
  assert.deepEqual(acceptFix("one two three", "one two three 4", ""), { ok: false, reason: "digits" });
  // One near miss inside the allowed edit budget passes.
  assert.deepEqual(acceptFix("alpha alo two", "alpha alw two", ""), { ok: true });
});

// Surah 93: keep/skip behaviour is checked against the exported Uthmani text.
const surah = JSON.parse(await readFile(new URL("../../../content/export/surah-93.json", import.meta.url), "utf8")) as Surah;
const ownTexts = surah.ayahs.filter((ayah) => ayah.key.startsWith("93:")).map((ayah) => ayah.text);
const kept = [
  [0x648, 0x627, 0x644, 0x636, 0x62d, 0x649],
  [0x633, 0x62c, 0x649], [0x648, 0x62f, 0x639, 0x643], [0x642, 0x644, 0x649],
  [0x627, 0x644, 0x623, 0x648, 0x644, 0x649], [0x648, 0x644, 0x633, 0x648, 0x641],
  [0x64a, 0x639, 0x637, 0x64a, 0x643], [0x641, 0x62a, 0x631, 0x636, 0x649],
  [0x64a, 0x62a, 0x64a, 0x645, 0x627], [0x636, 0x627, 0x644, 0x627],
  [0x641, 0x647, 0x62f, 0x649], [0x639, 0x627, 0x626, 0x644, 0x627],
  [0x641, 0x623, 0x63a, 0x646, 0x649], [0x62a, 0x642, 0x647, 0x631],
  [0x627, 0x644, 0x633, 0x627, 0x626, 0x644], [0x62a, 0x646, 0x647, 0x631],
  [0x628, 0x646, 0x639, 0x645, 0x629], [0x641, 0x62d, 0x62f, 0x62b],
].map((points) => ar(...points));
const skipped = [
  [0x627, 0x644, 0x64a, 0x644],
  [0x641, 0x640, 0x627, 0x648, 0x649],
  [0x648, 0x644, 0x644, 0x623, 0x62e, 0x631, 0x629],
].map((points) => ar(...points));

test("plainQuranWords keeps the safe spellings of surah 93 in order and skips the rest", () => {
  const words = plainQuranWords(ownTexts);
  let at = -1;
  for (const [index2, word] of kept.entries()) {
    const found = words.indexOf(word, at + 1);
    assert.ok(found > at, `missing or out of order at ${found} for entry ${index2}`);
    at = found;
  }
  // The listed examples are a sample, so only presence, order, uniqueness and safety are asserted.
  for (const word of skipped) assert.ok(!words.includes(word));
  assert.equal(new Set(words).size, words.length);
  assert.ok(words.every((word) => [...word].length >= 3));
});

test("shortAuthor cuts at the first parenthesis or comma and drops the Prophet and long names", () => {
  const ibnAshur = `${ar(0x627, 0x628, 0x646)} ${ar(0x639, 0x627, 0x634, 0x648, 0x631)}`;
  const summary = `${ar(0x627, 0x644, 0x645, 0x62e, 0x62a, 0x635, 0x631)} ${ar(0x641, 0x64a)} ${ar(0x627, 0x644, 0x62a, 0x641, 0x633, 0x64a, 0x631)}`;
  const detail = ` (${ar(0x62c, 0x645, 0x627, 0x639, 0x629)} ${ar(0x645, 0x646)} ${ar(0x639, 0x644, 0x645, 0x627, 0x621)} ${ar(0x627, 0x644, 0x62a, 0x641, 0x633, 0x64a, 0x631)}\u060C ${ar(0x645, 0x631, 0x643, 0x632)} ${ar(0x62a, 0x641, 0x633, 0x64a, 0x631)})`;
  const twoAuthors = `${ar(0x627, 0x644, 0x62d, 0x633, 0x646)}\u060C ${ar(0x622, 0x628, 0x648)} ${ar(0x62c, 0x639, 0x641, 0x631)} ${ar(0x627, 0x644, 0x628, 0x627, 0x642, 0x631)}`;
  const sallallahu = `${ar(0x627, 0x644, 0x646, 0x628, 0x64a)}\uFDFA\u060C ${ar(0x645, 0x646)} ${ar(0x62d, 0x62f, 0x64a, 0x62b)}`;
  const ibnKathir = `${ar(0x627, 0x628, 0x646)} ${ar(0x643, 0x62b, 0x64a, 0x631)} (${ar(0x639, 0x646, 0x648, 0x627, 0x646)} ${ar(0x627, 0x644, 0x633, 0x648, 0x631, 0x629)} ${ar(0x641, 0x64a)} ${ar(0x627, 0x644, 0x637, 0x628, 0x639, 0x629)})`;
  assert.equal(shortAuthor(ibnAshur), ibnAshur);
  assert.equal(shortAuthor(summary + detail), summary.trim());
  assert.equal(shortAuthor(twoAuthors), ar(0x627, 0x644, 0x62d, 0x633, 0x646));
  assert.equal(shortAuthor(sallallahu), "");
  assert.equal(shortAuthor(ibnKathir), `${ar(0x627, 0x628, 0x646)} ${ar(0x643, 0x62b, 0x64a, 0x631)}`);
  assert.equal(shortAuthor(`${ar(0x627)} ${ar(0x628)} ${ar(0x62c)} ${ar(0x62d)} ${ar(0x647)}`), "");
});

test("contextFor: invalid context is surah-only, a valid stop carries its unit", () => {
  const surahOnly = { surahName: surah.surah.name, terms: [], authors: [], stopAyahs: [], words: plainQuranWords(ownTexts) };
  assert.deepEqual(contextFor(surah, "later", 1), surahOnly);
  assert.deepEqual(contextFor(surah, 9, 1), surahOnly);
  assert.deepEqual(contextFor(surah, 0, 0), surahOnly);
  assert.deepEqual(contextFor(surah, 0, undefined), surahOnly);
  assert.deepEqual(contextFor(surah, 1, -3), surahOnly);

  const unit = readerUnits(surah, 0).find((item) => item.number === 1)!;
  const stop = contextFor(surah, 0, 1);
  assert.equal(stop.stopTitle, unit.title);
  assert.deepEqual(stop.stopAyahs, unit.ayahKeys.map((key) => surah.ayahs.find((ayah) => ayah.key === key)!.text));
  const unitTerms = [...new Set(unit.recordIds
    .flatMap((id) => surah.records[id]?.term ? [surah.records[id].term!] : []))];
  assert.deepEqual(stop.terms, unitTerms.slice(0, 6));
  const unitAuthors = [...new Set(unit.recordIds
    .flatMap((id) => (surah.records[id]?.evidence ?? []).map((evidence) => shortAuthor(evidence.author).trim())))]
    .filter(Boolean);
  assert.deepEqual(stop.authors, unitAuthors.slice(0, 6));
  assert.ok(stop.terms.length <= 6 && stop.authors.length <= 6);
  const stopWords = plainQuranWords(stop.stopAyahs);
  assert.ok(stopWords.length >= 1);
  assert.deepEqual(stop.words.slice(0, stopWords.length), stopWords);
  assert.equal(new Set(stop.words).size, stop.words.length);
});

test("hintSentence: order, word cap, no part is cut, empty context is intro only", () => {
  const parts: HintText = { intro: "Intro {surah}.", stop: "Stop {stop}.", scholars: "Scholars {list}.", terms: "Terms {list}.", words: "Words {list}." };
  const empty: VoiceContext = { surahName: "Name", terms: [], authors: [], words: [], stopAyahs: [] };
  assert.equal(hintSentence(empty, parts), "Intro Name.");

  const full = hintSentence({ ...empty, stopTitle: "Door", authors: ["a1", "a2"], terms: ["t1"], words: ["w1", "w2"] }, parts);
  const at = (part: string) => full.indexOf(part);
  for (const [first, later] of [["Intro", "Stop"], ["Stop", "Scholars"], ["Scholars", "Terms"], ["Terms", "Words"]] as const) {
    assert.ok(at(first) >= 0 && at(later) > at(first));
  }

  const many = Array.from({ length: 30 }, (_item, index) => `wwwwwww${index}`);
  assert.equal(hintSentence({ ...empty, words: many }, parts).split(" ").length, 24 + 2 + 1);
  assert.ok([...hintSentence({ ...empty, words: many }, parts)].length <= HINT_MAX_CHARS);

  const intro = `${"i".repeat(270)} {surah}.`;
  const crowded = hintSentence(
    { ...empty, stopTitle: "Door Gate", authors: ["a1"], terms: ["t1"], words: ["w1"] },
    { ...parts, intro },
  );
  assert.ok(crowded.includes("Stop Door Gate."));
  assert.ok(!crowded.includes("Scholars"));
  assert.ok(!crowded.includes("Terms"));
  assert.ok(!crowded.includes("Words"));
  assert.ok([...crowded].length <= HINT_MAX_CHARS);
});
