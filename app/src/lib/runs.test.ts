import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node's native TypeScript runner needs the source extension.
import { toRuns, shouldStack } from "./runs.ts";
// @ts-expect-error -- Node's native TypeScript runner needs the source extension.
import { ayahWords, splitLastWord } from "./reading-text.ts";
import type { ParagraphBlock, Segment, Surah } from "./types";
const index = JSON.parse(await readFile(new URL("../../../content/export/index.json", import.meta.url), "utf8"));
const surahs: Surah[] = await Promise.all(index.surahs.map(async ({ no }: { no: number }) => JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8"))));
const paragraphs = surahs.flatMap((surah) => surah.levels.flatMap((level) => level.blocks.flatMap((block) => block.type === "paragraph" ? [block] : block.type === "details" ? block.blocks : [])));
test("real export runs preserve every segment and mark boundary without mutation", () => {
  for (const paragraph of paragraphs) {
    const snapshot = structuredClone(paragraph);
    const runs = toRuns(paragraph.segments);
    assert.deepEqual(runs.flat(), paragraph.segments);
    assert.ok(runs.every((run) => run.length > 0));
    runs.forEach((run, i) => {
      assert.ok(run.slice(0, -1).every((segment) => segment.t !== "mark"));
      if (i < runs.length - 1) assert.equal(run.at(-1)?.t, "mark");
    });
    assert.deepEqual(paragraph, snapshot);
    assert.deepEqual(toRuns([...paragraph.segments]), runs);
  }
});
test("stacking is restricted to dense claim paragraphs with at least three closed runs", () => {
  let dense = false, short = false, transmission = false;
  for (const paragraph of paragraphs) {
    const runs = toRuns(paragraph.segments);
    const length = paragraph.segments.filter((segment) => "v" in segment).reduce((total, segment) => total + ("v" in segment ? segment.v.length : 0), 0);
    const expected = paragraph.role === "claim" && length > 400 && runs.filter((run) => run.at(-1)?.t === "mark").length >= 3;
    assert.equal(shouldStack(paragraph, runs), expected);
    dense ||= expected; short ||= paragraph.role === "claim" && !expected; transmission ||= paragraph.role === "transmission";
    assert.equal(shouldStack({ ...paragraph, role: "transmission" }, runs), false);
  }
  assert.ok(dense && short && transmission, "the real exports exercise each reading form");
});
test("empty input, unmarked tails, consecutive markers and punctuation do not invent boundaries", () => {
  const paragraph = paragraphs.find((block) => block.segments.some((segment) => segment.t === "mark"))!;
  const mark = paragraph.segments.find((segment) => segment.t === "mark")!;
  const text: Segment = { t: "text", v: "First. Second? Third!" };
  const segments: Segment[] = [text, mark, mark, { t: "text", v: ". tail" }];
  assert.deepEqual(toRuns([]), []);
  assert.deepEqual(toRuns(segments), [[text, mark], [mark], [segments[3]]]);
  const block: ParagraphBlock = { type: "paragraph", role: "claim", segments };
  assert.equal(shouldStack(block, toRuns(segments)), false);
});
test("ayah cleanup and last-word glue preserve content words, diacritics and quote bytes", () => {
  for (const surah of surahs) for (const ayah of surah.ayahs) {
    assert.equal(ayahWords(ayah.text), ayah.text.replace(/[\s\u00a0]*[\ufb50-\ufdcf]+$/u, ""));
    assert.equal(splitLastWord(ayahWords(ayah.text)).join(""), ayahWords(ayah.text));
  }
  for (const paragraph of paragraphs) for (const segment of paragraph.segments) if ("v" in segment) assert.equal(splitLastWord(segment.v).join(""), segment.v);
});
