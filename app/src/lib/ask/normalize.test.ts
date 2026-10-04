import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { normalize, lexicalScore } from "./normalize.ts";

const content = await readFile(new URL("../../../../content/export/surah-108.json", import.meta.url), "utf8");
const letters = [...new Set([...content].filter((char) => /\p{Script=Arabic}/u.test(char)))];

test("normalisation strips content diacritics and tatweel and is idempotent", () => {
  const stripped = content.replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "");
  assert.equal(normalize(content), normalize(stripped));
  assert.equal(normalize(content), normalize(normalize(content)));
});

test("alef, hamza, ya, maqsura, ta marbuta and ha equivalences use letters from content", () => {
  const find = (point: number) => letters.find((char) => char.codePointAt(0) === point)!;
  for (const points of [[0x622, 0x623, 0x625, 0x671, 0x621, 0x624, 0x626, 0x627], [0x649, 0x64a], [0x629, 0x647]]) {
    const present = points.map(find).filter(Boolean);
    assert.ok(present.length >= 2);
    for (const char of present) assert.equal(normalize(char), normalize(present[0]));
  }
});

test("lexical scoring recognises normalised content words", () => {
  const surah = JSON.parse(content);
  assert.ok(lexicalScore(surah.surah.name, normalize(surah.surah.name)) > 0);
  assert.equal(lexicalScore("", content), 0);
});
