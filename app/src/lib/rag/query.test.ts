import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { fuse, tokenize, tsQueryText } from "./query.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { STOPWORDS } from "./stopwords.ts";

const fixtures = JSON.parse(await readFile(new URL("../ask/eval-fixtures.json", import.meta.url), "utf8")) as { question: string }[];

test("fuse adds 1/(60+rank) over the lists, then the boosts, and breaks ties on the id", () => {
  const result = fuse([["a", "b", "c"], ["c", "a", "d"]], new Map([["d", 0.01], ["zzz", 1]]));
  const expected = new Map([["a", 1 / 61 + 1 / 62], ["b", 1 / 62], ["c", 1 / 63 + 1 / 61], ["d", 1 / 63 + 0.01]]);
  assert.deepEqual(result.map((row: { id: string }) => row.id), ["a", "c", "d", "b"]);
  for (const { id, score } of result) assert.ok(Math.abs(score - expected.get(id)!) < 1e-12, id);
  assert.equal(result.length, 4, "a boost never adds a candidate");
  assert.deepEqual(fuse([["x"], ["y"]]).map((row: { id: string }) => row.id), ["x", "y"], "equal scores order by id");
  assert.deepEqual(fuse([]), []);
});

test("tokens of a fixture question are normalised content words and the tsquery has only | operators", () => {
  for (const { question } of fixtures) {
    const tokens = tokenize(question);
    const text = tsQueryText(question);
    assert.ok(tokens.length > 0, "a fixture question keeps at least one content word");
    for (const token of tokens) {
      assert.ok(token.length >= 2);
      assert.ok(!STOPWORDS.has(token));
      assert.match(token, /^[\p{L}\p{N}]+$/u);
    }
    assert.equal(text, tokens.join(" | "));
    assert.ok(text.split(" | ").every((part: string) => part.length > 0), "no empty token");
    assert.doesNotMatch(text, /[&!:()<>'"*\\]/);
    assert.equal(new Set(tokens).size, tokens.length);
  }
});

test("an empty stop list works, and a stop word is dropped when listed", () => {
  const question = fixtures[0].question;
  const all = tokenize(question, new Set());
  assert.ok(all.length >= tokenize(question).length);
  assert.deepEqual(tokenize(question, new Set(all)), []);
  assert.equal(tsQueryText(question, new Set(all)), "");
  assert.equal(tsQueryText(""), "");
});

test("hostile punctuation cannot reach the tsquery", () => {
  const text = tsQueryText("a' | b & !c:* (d) <-> e\\ ; DROP");
  assert.doesNotMatch(text, /[&!:()<>'*\;]/);
  assert.ok(text.split(" | ").every((part: string) => /^[\p{L}\p{N}]+$/u.test(part)));
});
