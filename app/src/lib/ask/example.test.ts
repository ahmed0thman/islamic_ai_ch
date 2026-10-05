import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { EXAMPLE_MAX_WORDS, checkExample, pickExample, splitExamples } from "./example.ts";
// @ts-expect-error -- Node requires source extensions.
import { COMPOSE_SYSTEM_PROMPT } from "./compose.ts";
// @ts-expect-error -- Node requires source extensions.
import { normalize } from "./normalize.ts";
import guard from "./example-guard.json" with { type: "json" };

// Arabic here is the guard file's own words, the Quran from the King Fahd data file, and the two everyday phrases that repair.test.ts already uses as fixtures.
const quran: { aya_text_emlaey: string }[] = JSON.parse(await readFile(new URL("../../../../tools/data/qurancomplex/hafsData_v2-0.json", import.meta.url), "utf8"));
const quranWords = quran.find((ayah) => ayah.aya_text_emlaey.split(/\s+/u).length >= 3)!.aya_text_emlaey.split(/\s+/u).slice(0, 3).join(" ");
const around = (word: string) => `جاء ${word} اليوم`;
const clean = "جاء صديقي من السوق ومعه كتاب جديد";
const words = (count: number) => Array(count).fill("alpha").join(" ");
const PREFIXES = ["و", "ف", "ب", "ل", "ك"];

test("the guard file is sound: a positive limit, and every forbidden entry is one normalised word, so that it can match", () => {
  assert.ok(Number.isInteger(guard.max_words) && guard.max_words > 0);
  assert.equal(EXAMPLE_MAX_WORDS, guard.max_words);
  assert.ok(guard.words.length > 0);
  for (const word of guard.words) {
    const tokens = normalize(word).match(/[\p{L}\p{N}]+/gu) ?? [];
    assert.equal(tokens.length, 1, `"${word}" is not a single word, so it could never be found in a text`);
    assert.equal(tokens[0], normalize(word).trim(), `"${word}" has something around its letters`);
  }
});
test("the limit the writer is told is the limit that is enforced", () => {
  assert.ok(COMPOSE_SYSTEM_PROMPT.includes(`at most ${EXAMPLE_MAX_WORDS} words`), "the prompt names a different limit than example-guard.json");
  assert.equal(checkExample(words(EXAMPLE_MAX_WORDS)), undefined);
  assert.equal(checkExample(words(EXAMPLE_MAX_WORDS + 1)), "length");
  assert.equal(checkExample(words(3), 3), undefined, "the limit can be given");
  assert.equal(checkExample(words(4), 3), "length");
});
test("an ordinary everyday sentence passes; an empty one, or one with no word in it, is empty", () => {
  assert.equal(checkExample(clean), undefined);
  for (const text of ["", "   ", "\n", "\u2026", "\u061f!", "\u060c \u061b"]) assert.equal(checkExample(text), "empty", JSON.stringify(text));
});
test("digits of every script, and every kind of quotation mark, are refused", () => {
  const digits = [..."0123456789", ...[...Array(10).keys()].map((n) => String.fromCharCode(0x660 + n)), ...[...Array(10).keys()].map((n) => String.fromCharCode(0x6f0 + n))];
  for (const digit of digits) assert.equal(checkExample(`${clean} ${digit}`), "digits", `U+${digit.charCodeAt(0).toString(16)}`);
  for (const mark of ["«", "»", '"', "\u201c", "\u201d"]) assert.equal(checkExample(`${clean} ${mark}`), "quotation", `U+${mark.charCodeAt(0).toString(16)}`);
});
test("three words of the Quran are refused, and so is the sign for salutation on the Prophet", () => {
  assert.equal(checkExample(`alpha ${quranWords} beta`), "quran_text");
  assert.equal(checkExample("\ufdfa"), "forbidden");
  assert.equal(checkExample(`${clean} \ufdfa`), "forbidden");
  assert.equal(checkExample(`${clean} \ufd3f`), "quran_text", "an ornate Quran bracket");
});
test("a text that breaks two rules is reported for the first: empty, length, digits, quotation, Quran, forbidden", () => {
  const forbidden = around(guard.words[0]);
  assert.equal(checkExample(`${words(EXAMPLE_MAX_WORDS + 1)} 7`), "length");
  assert.equal(checkExample(`${forbidden} 7 «`), "digits");
  assert.equal(checkExample(`${forbidden} « ${quranWords}`), "quotation");
  assert.equal(checkExample(`${forbidden} ${quranWords}`), "quran_text");
  assert.equal(checkExample(forbidden), "forbidden");
});
test("every forbidden word is refused behind any two attached prefixes, and after the contracted preposition", () => {
  for (const word of guard.words) {
    for (const first of PREFIXES) for (const second of PREFIXES) {
      assert.equal(checkExample(around(`${first}${second}${word}`)), "forbidden", `${first}${second}${word}`);
    }
    // For the article, the written form is the contraction: and-to + the-Prophet is written as one word with the preposition's lam doubled.
    if (word.startsWith("ال")) {
      for (const first of PREFIXES) assert.equal(checkExample(around(`${first}لل${word.slice(2)}`)), "forbidden", `${first}لل${word.slice(2)}`);
    }
  }
});

test("a forbidden word is found as a whole word with its prefixes only: letters that are not prefixes, in front of it or after it, make another word", () => {
  // The five prefixes are and, so, by, to, like. Jeem and ain are not prefixes, and Latin letters are not Arabic at all.
  const glue = ["\u062c", "\u0639", "x", "xy"];
  const sign = "\ufdfa";
  for (const word of guard.words.filter((entry) => entry !== sign)) {
    for (const letters of glue) assert.equal(checkExample(around(`${letters}${word}`)), undefined, `${letters}${word}`);
    for (const letters of ["x", "xy"]) assert.equal(checkExample(around(`${word}${letters}`)), undefined, `${word}${letters}`);
  }
});

const claim = (text: string, cites = ["a"]) => ({ text, cites });
const example = (text: unknown) => ({ kind: "example" as const, text: text as string, cites: [] });
test("splitExamples separates the claims from the examples, and says which claim an example follows (-1 when it came first)", () => {
  const first = claim("one"), second = claim("two"), third = claim("three");
  const input = [example("e0"), first, example("e1"), second, third, example("e2")];
  const copy = structuredClone(input);
  const out = splitExamples(input);
  assert.deepEqual(out.claims, [first, second, third]);
  assert.ok(out.claims[0] === first && out.claims[2] === third, "the claims are the same objects, in the order written");
  assert.deepEqual(out.examples, [{ text: "e0", after: -1 }, { text: "e1", after: 0 }, { text: "e2", after: 2 }]);
  assert.deepEqual(input, copy, "the input is not changed");
  assert.deepEqual(splitExamples([]), { claims: [], examples: [] });
  assert.deepEqual(splitExamples([claim("x"), { text: "y", cites: ["a"], kind: "claim" as const }]).examples, [], "a claim that says so is still a claim");
  assert.deepEqual(splitExamples([first, example(7)]).examples, [{ text: "", after: 0 }], "an example whose text is not text becomes an empty one, which then fails as empty");
});
test("pickExample takes at most one example, judges it, and drops all of them when there are several", () => {
  const good = { text: clean, after: 0 };
  assert.deepEqual(pickExample([]), {});
  assert.equal(pickExample([good]).example, good);
  assert.deepEqual(pickExample([good]), { example: good });
  assert.deepEqual(pickExample([good, { ...good }]), { reason: "several" }, "even when both are fine: there is no telling which is right");
  assert.deepEqual(pickExample([{ text: around(guard.words[0]), after: 0 }]), { reason: "forbidden" });
  assert.deepEqual(pickExample([{ text: "", after: 0 }]), { reason: "empty" });
  assert.deepEqual(pickExample([{ text: `${clean} 7`, after: 1 }]), { reason: "digits" });
  assert.deepEqual(pickExample([{ text: `alpha ${quranWords}`, after: 1 }]), { reason: "quran_text" });
  assert.deepEqual(pickExample([{ text: words(EXAMPLE_MAX_WORDS + 1), after: 1 }]), { reason: "length" });
  assert.deepEqual(pickExample([{ text: `${clean} «`, after: 1 }]), { reason: "quotation" });
});
