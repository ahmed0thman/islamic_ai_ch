import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { ATTRIBUTION_WORDS, GRADING_WORDS, containsQuran, parseComposition, quranTrigrams, verify, verifyEach } from "./verify.ts";
// @ts-expect-error -- Node requires source extensions.
import { REPORT_MARKERS } from "./source-guard.ts";
import type { Atom, ReaderContext } from "./types";

// Arabic is never typed here. The Quran comes from the King Fahd data file (the same one the guard is built from), the grading and attribution words
// and the narration markers from the guard's own lists, and the rest of the fixtures are Latin placeholders, which no Quran trigram can match.
const quran: { sura_no: number; aya_no: number; aya_text_emlaey: string }[] =
  JSON.parse(await readFile(new URL("../../../../tools/data/qurancomplex/hafsData_v2-0.json", import.meta.url), "utf8"));
const plain = (ayah: { aya_text_emlaey: string }) => ayah.aya_text_emlaey.split(/\s+/u).filter(Boolean);
const longAyahs = quran.filter((ayah) => plain(ayah).length >= 3);

const atoms: Atom[] = [
  { id: "a", text: "alpha beta gamma delta epsilon 12", role: "claim", level: 1, records: ["r1"], segments: [], surah: 93 },
  { id: "b", text: "zeta eta theta iota kappa", role: "claim", level: 1, records: ["r2"], segments: [], surah: 93 },
  { id: "t", text: "lambda mu nu xi", role: "transmission", level: 1, records: [], segments: [] },
  { id: "src:1:0", text: "omicron pi rho sigma tau", role: "source", level: 1, records: [], segments: [], surah: 108 },
  { id: "112:1:blocks.0:0", text: "upsilon phi chi psi omega", role: "claim", level: 1, records: ["r3"], segments: [] },
];
const claim = (text: string, cites: string[] = ["a"]) => ({ kind: "claim", text, cites });
const answerOf = (...sentences: unknown[]) => ({ status: "answer", sentences });
/** The reason the single sentence is refused, `undefined` when it passes, `"shape"` when the whole composition is. */
function reasonOf(text: string, cites = ["a"], context?: ReaderContext, grams: ReadonlySet<string> = new Set()) {
  const each = verifyEach(answerOf(claim(text, cites)), atoms, context, grams);
  return each.ok ? each.reasons[0] : "shape";
}

test("verifyEach gives one verdict per written sentence, in the order written, and leaves the examples to example.ts", () => {
  const example = { kind: "example", text: "7 7 7", cites: [] };
  const value = answerOf(claim("alpha beta"), example, claim("alpha 99"), claim("zeta eta", ["b"]));
  const each = verifyEach(value, atoms, undefined, new Set());
  assert.ok(each.ok);
  assert.deepEqual(each.reasons, [undefined, "numbers", undefined], "the example has no verdict, even with a digit in it");
  assert.equal(each.value, value, "the composition itself is returned as it came");
  assert.deepEqual(verifyEach({ status: "answer", sentences: [] }, atoms), { ok: false });
  assert.deepEqual(verifyEach(answerOf(example), atoms), { ok: false }, "an answer of examples alone has no claim");
  assert.deepEqual(verifyEach({ status: "insufficient", sentences: [] }, atoms), { ok: true, value: { status: "insufficient", sentences: [] }, reasons: [] });
});
test("verify says ok only when every written sentence passes, and names the first one that does not; a malformed whole is `shape`", () => {
  assert.deepEqual(verify(answerOf(claim("alpha beta"), claim("zeta eta", ["b"])), atoms, undefined, new Set()), { ok: true, value: answerOf(claim("alpha beta"), claim("zeta eta", ["b"])) });
  assert.deepEqual(verify(answerOf(claim("alpha beta"), claim("zeta 77", ["b"]), claim("alpha 88")), atoms, undefined, new Set()), { ok: false, reason: "numbers" });
  assert.deepEqual(verify(null, atoms, undefined, new Set()), { ok: false, reason: "shape" });
  assert.deepEqual(verify(answerOf(claim("alpha", [])), atoms, undefined, new Set()), { ok: false, reason: "shape" });
  assert.deepEqual(verify({ status: "fatwa", sentences: [] }, atoms), { ok: true, value: { status: "fatwa", sentences: [] } });
});

test("a written sentence with no usable citation, or no text, is refused, and the whole answer with it: the sound sentences beside it are not shown on their own", () => {
  const broken: [string, unknown][] = [
    ["no cites at all", { text: "alpha beta" }],
    ["an empty list of cites", { text: "alpha beta", cites: [] }],
    ["cites that are not a list", { text: "alpha beta", cites: "a" }],
    ["cites that are null", { text: "alpha beta", cites: null }],
    ["a cite that is not a sentence that was supplied", { text: "alpha beta", cites: ["no-such-sentence"] }],
    ["a cite that is not text", { text: "alpha beta", cites: [1] }],
    ["one good cite and one that was not supplied", { text: "alpha beta", cites: ["a", "no-such-sentence"] }],
    ["four cites, one too many", { text: "alpha beta", cites: ["a", "b", "src:1:0", "112:1:blocks.0:0"] }],
    ["the same cite twice", { text: "alpha beta", cites: ["a", "a"] }],
    ["a sentence that is only spaces", { text: "   ", cites: ["a"] }],
    ["a sentence that is not text", { text: ["alpha"], cites: ["a"] }],
    ["a list entry that is null", null],
    ["a list entry that is only text", "alpha beta"],
    ["a list entry that is a number", 7],
    ["a list entry that is a list", ["alpha beta", ["a"]]],
  ];
  for (const [name, sentence] of broken) {
    assert.equal(parseComposition(answerOf(sentence), atoms), undefined, name);
    assert.deepEqual(verify(answerOf(sentence), atoms, undefined, new Set()), { ok: false, reason: "shape" }, name);
    // One broken sentence sinks the whole answer: the sound one next to it is not shown on its own.
    assert.deepEqual(verify(answerOf(claim("alpha beta"), sentence), atoms, undefined, new Set()), { ok: false, reason: "shape" }, `${name}, next to a sound one`);
  }
  // The same cites are fine as soon as they are whole: a transmission sentence may sit beside a claim or a book excerpt.
  assert.ok(parseComposition(answerOf(claim("alpha beta", ["t", "a"])), atoms));
  assert.ok(parseComposition(answerOf(claim("alpha beta", ["t", "src:1:0"])), atoms));
  assert.ok(parseComposition(answerOf(claim("alpha beta", ["a", "b", "src:1:0"])), atoms), "three cites are the most");
});
test("a sentence that cites only a transmission sentence parses now: the refusal moved to the per-sentence narration reason", () => {
  assert.ok(parseComposition(answerOf({ text: "alpha beta", cites: ["t"] }), atoms));
  const each = verifyEach(answerOf({ text: "alpha beta", cites: ["t"] }), atoms, undefined, new Set());
  assert.ok(each.ok && each.reasons[0] === "narration");
});
test("the written answer is bounded: 220 characters a sentence, five claims, ten sentences in all, examples free of the claim count", () => {
  const astral = "\u{1F600}".repeat(220);
  assert.ok(parseComposition(answerOf(claim(astral)), atoms), "220 characters, counted as characters and not as UTF-16 units");
  assert.equal(parseComposition(answerOf(claim(astral + "x")), atoms), undefined);
  const example = { kind: "example", text: "an example", cites: [] };
  assert.ok(parseComposition(answerOf(...Array(5).fill(claim("alpha")), ...Array(5).fill(example)), atoms), "five claims and five examples are ten");
  assert.equal(parseComposition(answerOf(...Array(5).fill(claim("alpha")), ...Array(6).fill(example)), atoms), undefined, "eleven in all");
  assert.equal(parseComposition(answerOf(...Array(6).fill(claim("alpha"))), atoms), undefined, "six claims");
  for (const status of ["answer", "insufficient", "fatwa", "out_of_scope", "not_arabic"]) {
    assert.equal(parseComposition({ status, sentences: [], extra: 1 }, atoms), undefined, `${status} with a field that does not belong`);
  }
});

test("the checks run in a fixed order, so a sentence that breaks two rules is reported for the first: Quran, report, quotation, grading, numbers, names", () => {
  const ayah = longAyahs[0];
  const quranWords = plain(ayah).slice(0, 3).join(" ");
  const marker = REPORT_MARKERS[0].join(" ");
  const trigger = ATTRIBUTION_WORDS[0];
  const grams = quranTrigrams();
  const twice: [string, string, string[], string][] = [
    [`${quranWords} ${marker} 99 ${trigger} Zed`, "quran_text", ["src:1:0"], "Quran text and everything else"],
    [`${marker} «theta zeta» ${GRADING_WORDS[0]} 99 ${trigger} Zed`, "report", ["src:1:0"], "report and everything after it"],
    [`«theta zeta» ${GRADING_WORDS[0]} 99 ${trigger} Zed`, "quotation", ["a"], "a quotation and everything after it"],
    [`${GRADING_WORDS[0]} 99 ${trigger} Zed`, "grading", ["a"], "a grading, a number and a name"],
    [`99 ${trigger} Zed`, "numbers", ["a"], "a number and a name"],
    [`${trigger} Zed`, "names", ["a"], "a name alone"],
    ["alpha beta", undefined as never, ["a"], "a sentence that breaks nothing"],
  ];
  for (const [text, expected, cites, name] of twice) assert.equal(reasonOf(text, cites, undefined, grams), expected, name);
});

test("a book excerpt cannot carry a narration into a written sentence: every report marker is refused when such an excerpt is cited, and none when only a verified sentence is", () => {
  for (const marker of REPORT_MARKERS) {
    const text = `omicron ${marker.join(" ")} pi`;
    assert.equal(reasonOf(text, ["src:1:0"]), "report", `"${marker.join(" ")}" with a book excerpt cited`);
    assert.equal(reasonOf(text, ["a", "src:1:0"]), "report", `"${marker.join(" ")}" with both kinds cited`);
    assert.notEqual(reasonOf(text, ["a"]), "report", `"${marker.join(" ")}" with a verified sentence cited, which carries its own ruling`);
  }
});

test("every ayah of the Quran of three words or more is caught in the plain spelling, however the writer decorates it", () => {
  assert.ok(longAyahs.length > 6000, "the whole Quran is checked, not a sample");
  const decorations: [string, (words: string[]) => string][] = [
    ["as written", (words) => words.join(" ")],
    ["with vowel marks", (words) => words.map((word) => [...word].map((letter) => `${letter}\u064e`).join("")).join(" ")],
    ["with tatweel", (words) => words.map((word) => word.length > 2 ? `${word[0]}\u0640${word.slice(1)}` : word).join(" ")],
    ["with hamza on its alefs", (words) => words.map((word) => word.replaceAll("\u0627", "\u0623")).join(" ")],
    ["with the final letters spelled the other way", (words) => words.map((word) => word.replace(/\u0647$/u, "\u0629").replace(/\u064a$/u, "\u0649")).join(" ")],
    ["with Arabic commas between the words", (words) => words.join("\u060c ")],
    ["in the middle of other words", (words) => `alpha ${words.slice(0, 3).join(" ")} beta`],
    ["as its last three words only", (words) => words.slice(-3).join(" ")],
  ];
  for (const ayah of longAyahs) {
    const words = plain(ayah);
    for (const [name, write] of decorations) {
      if (!containsQuran(write(words))) assert.fail(`${ayah.sura_no}:${ayah.aya_no} was not caught ${name}`);
    }
  }
});
test("a written sentence with Quran text in it is refused as Quran text, and an ordinary sentence is not", () => {
  const ayah = longAyahs.find((item) => item.sura_no === 108) ?? longAyahs[0];
  const quranWords = plain(ayah).slice(0, 3).join(" ");
  assert.equal(reasonOf(quranWords, ["a"], undefined, quranTrigrams()), "quran_text");
  assert.equal(reasonOf(`alpha beta ${quranWords} gamma`, ["a"], undefined, quranTrigrams()), "quran_text");
  assert.equal(reasonOf("alpha beta gamma", ["a"], undefined, quranTrigrams()), undefined);
  // The default guard is the whole Quran, built once.
  assert.equal(quranTrigrams(), quranTrigrams());
  assert.equal(verify(answerOf(claim(`alpha ${quranWords}`)), atoms).ok, false);
  for (const bracket of ["\ufd3e", "\ufd3f"]) assert.equal(reasonOf(`alpha ${bracket} beta`, ["a"], undefined, new Set()), "quran_text", "an ornate bracket alone");
});

test("a quotation must be a verbatim stretch of one cited sentence: never joined from two, never longer than the source", () => {
  const joined = (text: string, cites: string[]) => reasonOf(text, cites, undefined, new Set());
  assert.equal(joined("«gamma delta»", ["a"]), undefined);
  assert.equal(joined("«epsilon zeta»", ["a", "b"]), "quotation", "a word of one cited sentence joined to a word of another");
  assert.equal(joined("«delta epsilon 12 zeta»", ["a", "b"]), "quotation");
  assert.equal(joined("«alpha beta gamma delta epsilon 12 more»", ["a"]), "quotation", "longer than its source");
  assert.equal(joined("«delta gamma»", ["a"]), "quotation", "the right words in the wrong order");
  assert.equal(joined('"gamma delta"', ["a"]), undefined, "straight quotation marks work the same");
  assert.equal(joined('"epsilon zeta"', ["a", "b"]), "quotation");
  assert.equal(joined("«gamma delta» and «zeta eta»", ["a", "b"]), undefined, "two quotations, each from its own cited sentence");
  assert.equal(joined("«gamma delta» and «zeta delta»", ["a", "b"]), "quotation", "the second is stitched");
  assert.equal(joined("«gamma» «zeta»", ["a"]), undefined, "a one-word quotation is free");
  assert.equal(joined("alpha » beta", ["a"]), "quotation", "a closing mark with no opening one");
  assert.equal(joined('alpha " beta', ["a"]), "quotation", "a straight mark that is never closed");
});

test("a number the cited sentences do not carry is refused, unless it is the reader's own surah or ayah", () => {
  const stop: ReaderContext = { depth: 1, stop: 2, surah: 93, ayah_numbers: [1, 2, 3], stop_ayahs: [{ key: "93:7", text: "x" }, { key: "93:8", text: "y" }] };
  assert.equal(reasonOf("alpha 12"), undefined, "a number written as the cited sentence has it");
  assert.equal(reasonOf("alpha \u0661\u0662"), undefined, "the same number in Arabic-Indic digits");
  assert.equal(reasonOf("alpha \u06f1\u06f2"), undefined, "and in Persian digits");
  assert.equal(reasonOf("alpha 1"), "numbers", "a run of digits is one number: 1 is not 12");
  assert.equal(reasonOf("alpha 120"), "numbers");
  assert.equal(reasonOf("alpha 12 13"), "numbers", "every number counts, not the first");
  for (const number of ["93", "1", "2", "3", "7", "8"]) assert.equal(reasonOf(`alpha ${number}`, ["a"], stop), undefined, `${number} belongs to the reader's context`);
  assert.equal(reasonOf("alpha 9", ["a"], stop), "numbers");
  assert.equal(reasonOf("alpha 93", ["b"]), undefined, "the number of the surah a verified sentence belongs to is its own");
  assert.equal(reasonOf("alpha 112", ["112:1:blocks.0:0"]), undefined, "taken from the sentence's id when it has no surah field");
  assert.equal(reasonOf("alpha 108", ["src:1:0"]), "numbers", "a book excerpt does not lend its surah's number to the writer");
  assert.equal(reasonOf("alpha 108", ["src:1:0"], { depth: 1, surah: 108 }), undefined, "unless the reader is reading that surah");
});

test("the ten digits are read in every script as the same number, and the same digits in another order are another number", () => {
  const ascii = "0123456789";
  const inScript = (base: number, digits = ascii) => [...digits].map((digit) => String.fromCharCode(base + Number(digit))).join("");
  const carrying: Atom[] = [{ ...atoms[0], text: `alpha ${ascii} beta` }];
  const reasonOfDigits = (digits: string) => {
    const each = verifyEach(answerOf(claim(`alpha ${digits}`)), carrying, undefined, new Set());
    return each.ok ? each.reasons[0] : "shape";
  };
  const reversed = [...ascii].reverse().join("");
  for (const [name, base] of [["ASCII", 0x30], ["Arabic-Indic", 0x660], ["extended Arabic-Indic", 0x6f0]] as const) {
    assert.equal(reasonOfDigits(inScript(base)), undefined, `${name} digits`);
    assert.equal(reasonOfDigits(inScript(base, reversed)), "numbers", `${name} digits in another order`);
  }
});

test("a name or a view after an attribution word must be in what is cited, and the run of words ends at punctuation", () => {
  const stop = [".", "!", "?", "\u061f", "\u060c", ",", ";", "\u061b", ":", "\n"];
  for (const trigger of ATTRIBUTION_WORDS) {
    assert.equal(reasonOf(`${trigger} alpha`), undefined, `${trigger} followed by a cited word`);
    assert.equal(reasonOf(`${trigger} Zed`), "names", `${trigger} followed by a word nobody cited`);
    assert.equal(reasonOf(`beta ${trigger} alpha gamma`), undefined, `${trigger} in the middle of a sentence`);
  }
  const trigger = ATTRIBUTION_WORDS[0];
  for (const mark of stop) {
    assert.equal(reasonOf(`${trigger} alpha${mark} Zed`), undefined, `a name after ${JSON.stringify(mark)} is not under the attribution word`);
    assert.equal(reasonOf(`${trigger} Zed${mark} alpha`), "names", `a name before ${JSON.stringify(mark)} is`);
  }
  assert.equal(reasonOf("Zed alpha"), undefined, "no attribution word, nothing to check");
});

test("grading words are refused unless a cited sentence has the same whole word, with or without the attached article", () => {
  const reasonWith = (text: string, cited: string) => {
    const each = verifyEach(answerOf(claim(text)), [{ ...atoms[0], text: cited }], undefined, new Set());
    return each.ok ? each.reasons[0] : "shape";
  };
  const article = "\u0627\u0644";
  for (const word of GRADING_WORDS) {
    assert.equal(reasonOf(`gamma ${word}`), "grading", `${word} when nothing cited has it`);
    assert.equal(reasonOf(`gamma ${article}${word}`), "grading", `${article}${word} when nothing cited has it`);
    assert.equal(reasonWith(`gamma ${word}`, `alpha ${word} beta`), undefined, `${word} when the cited sentence has it`);
    assert.equal(reasonWith(`gamma ${article}${word}`, `alpha ${article}${word} beta`), undefined, `${article}${word} when the cited sentence has it`);
    assert.equal(reasonWith(`gamma ${word}`, `alpha ${word}x beta`), "grading", `${word} when the cited sentence has only a longer word that starts with it`);
    assert.equal(reasonWith(`gamma ${word}`, `alpha x${word} beta`), "grading", `${word} when the cited sentence has only a longer word that ends with it`);
    assert.equal(reasonOf(`gamma ${word}x`), undefined, `${word} inside a longer word is not the word`);
  }
  assert.equal(reasonOf("gamma delta"), undefined);
  // Of several cited sentences, one that has the word is enough: the others need not.
  const carried = verifyEach(answerOf(claim(`gamma ${GRADING_WORDS[0]}`, ["a", "b"])), [{ ...atoms[0], text: `alpha ${GRADING_WORDS[0]} beta` }, atoms[1]], undefined, new Set());
  assert.ok(carried.ok && carried.reasons[0] === undefined);
});
