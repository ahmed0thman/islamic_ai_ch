import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { CHAIN_MARKERS, REPORT_MARKERS, REPORT_SOURCES, guardTokens, hasMarker } from "./source-guard.ts";
import guard from "./source-guard.json" with { type: "json" };

// Arabic is never typed here: every word below comes from source-guard.json itself, and the spellings are made by editing those words with code points.
const VOWEL = "\u064e";
const TATWEEL = "\u0640";
const ALEF = "\u0627", ALEF_HAMZA = "\u0623", HA = "\u0647", TA_MARBUTA = "\u0629", YA = "\u064a", ALEF_MAKSURA = "\u0649";
const all: readonly (readonly string[])[] = [...REPORT_MARKERS, ...CHAIN_MARKERS];
const names = (list: readonly (readonly string[])[]) => list.map((marker) => marker.join(" "));

test("every marker is already in the normalised spelling the guard compares in, so none of them is dead", () => {
  for (const marker of all) {
    assert.ok(marker.length > 0 && marker.every(Boolean));
    assert.deepEqual(guardTokens(marker.join(" ")), [...marker], `"${marker.join(" ")}" would never match: it changes when it is normalised`);
  }
  assert.equal(new Set(names(REPORT_MARKERS)).size, REPORT_MARKERS.length, "a report marker is listed twice");
  assert.equal(new Set(names(CHAIN_MARKERS)).size, CHAIN_MARKERS.length, "a chain marker is listed twice");
  // The lists the module exposes are the file's, whole: nothing is dropped when the file is read.
  assert.equal(REPORT_MARKERS.length, guard.report_markers.length);
  assert.equal(CHAIN_MARKERS.length, guard.chain_markers.length);
  assert.deepEqual([...REPORT_SOURCES], guard.report_sources);
});
test("the sources whose passages are never woven are plain ids, listed once", () => {
  assert.ok(REPORT_SOURCES.size > 0);
  for (const id of REPORT_SOURCES) assert.match(id, /^[a-z0-9_]+$/);
  assert.equal(REPORT_SOURCES.size, guard.report_sources.length);
});

test("guardTokens keeps letters and digits after the search normalisation, and nothing else", () => {
  assert.deepEqual(guardTokens(""), []);
  assert.deepEqual(guardTokens("   \n\t "), []);
  assert.deepEqual(guardTokens("\u060c\u061b:.!\u061f«»()[]-"), [], "punctuation alone leaves no token");
  assert.deepEqual(guardTokens("alpha1, beta2. (gamma)"), ["alpha1", "beta2", "gamma"], "Latin letters and digits are kept as they are");
  assert.deepEqual(guardTokens("\u0663\u0662\u0661 12"), ["\u0663\u0662\u0661", "12"], "Arabic-Indic digits are digits");
  const [first] = REPORT_MARKERS[0];
  assert.deepEqual(guardTokens(`${first}\u060c ${first}.`), [first, first], "punctuation attached to a word is dropped");
});
test("every marker is found when its words are written with vowel marks, tatweel, hamza and final-letter spellings, inside other words and punctuation", () => {
  const spellings: ((word: string) => string)[] = [
    (word) => word,
    (word) => [...word].map((letter) => letter + VOWEL).join(""),
    (word) => word.length > 2 ? word[0] + TATWEEL + word.slice(1) : word,
    (word) => word.replaceAll(ALEF, ALEF_HAMZA),
    (word) => word.replace(new RegExp(`${HA}$`, "u"), TA_MARBUTA).replace(new RegExp(`${YA}$`, "u"), ALEF_MAKSURA),
  ];
  for (const marker of REPORT_MARKERS) for (const spell of spellings) {
    const written = `alpha \u060c ${marker.map(spell).join(" ")}\u061b beta`;
    assert.ok(hasMarker(guardTokens(written), REPORT_MARKERS), `"${marker.join(" ")}" was not found in: ${written}`);
  }
  for (const marker of CHAIN_MARKERS) for (const spell of spellings) {
    const written = `alpha ${marker.map(spell).join(" ")}: beta`;
    assert.ok(hasMarker(guardTokens(written), CHAIN_MARKERS), `"${marker.join(" ")}" was not found in: ${written}`);
  }
});
test("hasMarker matches whole tokens in sequence, anywhere in the list, and nothing partial", () => {
  const long = REPORT_MARKERS.find((marker) => marker.length >= 3 && new Set(marker).size === marker.length)!;
  const single = REPORT_MARKERS.find((marker) => marker.length === 1)!;
  const only = [long];
  assert.ok(hasMarker([...long], only), "the marker alone");
  assert.ok(hasMarker(["alpha", ...long, "beta"], only), "in the middle");
  assert.ok(hasMarker(["alpha", "beta", ...long], only), "at the end");
  assert.ok(hasMarker([...long, "alpha"], only), "at the start");
  assert.ok(!hasMarker([long[0], "alpha", ...long.slice(1)], only), "another word between its words");
  assert.ok(!hasMarker(long.slice(0, -1), only), "the list ends before the marker does");
  assert.ok(!hasMarker(long.slice(1), only), "the list starts after the marker's first word");
  assert.ok(!hasMarker([...long].reverse(), only), "the words in the opposite order");
  assert.ok(hasMarker(["alpha", ...single], [single]), "a one-word marker");
  assert.ok(!hasMarker([`${single[0]}x`], [single]), "a longer word that merely starts like the marker");
  assert.ok(!hasMarker([`x${single[0]}`], [single]), "a longer word that merely ends like the marker");
  assert.ok(hasMarker(["alpha", ...single], [long, single]), "any one marker of the list is enough");
  assert.ok(!hasMarker(["alpha", "beta"], REPORT_MARKERS));
  assert.ok(!hasMarker([], REPORT_MARKERS));
  assert.ok(!hasMarker([...long], []));
});
test("one attached conjunction or preposition before the first word of a marker still counts, and only there", () => {
  const long = REPORT_MARKERS.find((marker) => marker.length >= 2 && marker.every((word) => word.length >= 3))!;
  const single = REPORT_MARKERS.find((marker) => marker.length === 1 && marker[0].length >= 3)!;
  // The four letters of the guard: and, so, by, to.
  for (const letter of ["\u0648", "\u0641", "\u0628", "\u0644"]) {
    assert.ok(hasMarker([letter + single[0]], [single]), `${letter} before a one-word marker`);
    assert.ok(hasMarker([letter + long[0], ...long.slice(1)], [long]), `${letter} before the first word of a longer marker`);
    assert.ok(!hasMarker([long[0], letter + long[1], ...long.slice(2)], [long]), `${letter} before the second word does not count`);
    assert.ok(!hasMarker([letter + letter + single[0]], [single]), "two attached letters do not count");
  }
  for (const letter of ["\u0645", "\u0643", "\u062a", "x"]) assert.ok(!hasMarker([letter + single[0]], [single]), `${letter} is not an attached particle`);
});
