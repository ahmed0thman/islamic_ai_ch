import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node's native TypeScript runner needs the source extension.
import { toRuns, shouldStack, dropStageAyah, tidyAfterAyah } from "./runs.ts";
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
test("an opening ayah the stage already shows is lifted off with its hanging punctuation; nothing else moves", () => {
  const mark: Segment = { t: "mark", records: ["r1"] };
  const block = (segments: Segment[]): ParagraphBlock => ({ type: "paragraph", role: "claim", segments });
  const lead: Segment = { t: "ayah", key: "93:4" };
  const gloss: Segment = { t: "text", v: "\u060c \u0623\u064a: \u0627\u0644\u062f\u0627\u0631" };
  const input = block([lead, gloss, mark]);
  const snapshot = structuredClone(input);
  // The stage shows it: the ayah goes, and so do the comma and the space before the sentence.
  assert.deepEqual(dropStageAyah(input, ["93:4"]).segments, [{ t: "text", v: "\u0623\u064a: \u0627\u0644\u062f\u0627\u0631" }, mark]);
  assert.deepEqual(input, snapshot, "the content is never mutated");
  // A full stop and a text that is only punctuation: the text segment disappears.
  assert.deepEqual(dropStageAyah(block([lead, { t: "text", v: ". " }, { t: "quote", v: "q", record: "r1" }]), ["93:4"]).segments, [{ t: "quote", v: "q", record: "r1" }]);
  // Several stage ayahs: any of them counts.
  assert.equal(dropStageAyah(input, ["93:3", "93:4"]).segments[0].t, "text");
  // Another ayah than the stage's, an ayah in the middle, an ayah with its own mark right after it, and an empty stage all stay.
  assert.equal(dropStageAyah(input, ["93:5"]), input);
  assert.equal(dropStageAyah(input, []), input);
  const middle = block([{ t: "text", v: "x " }, lead, gloss]);
  assert.equal(dropStageAyah(middle, ["93:4"]), middle);
  const marked = block([lead, mark, gloss]);
  assert.equal(dropStageAyah(marked, ["93:4"]), marked);
  // Consecutive opening ayahs: those on the stage go, one the stage does not show stays and opens the paragraph.
  const pair = block([lead, { t: "text", v: " " }, { t: "ayah", key: "93:5" }, gloss]);
  assert.deepEqual(dropStageAyah(pair, ["93:4", "93:5"]).segments, [gloss].map((segment) => ({ ...segment, v: segment.v.replace(/^\u060c /u, "") })));
  assert.deepEqual(dropStageAyah(pair, ["93:4"]).segments, [{ t: "ayah", key: "93:5" }, gloss]);
  assert.equal(dropStageAyah(pair, ["93:5"]), pair);
  // An opening quote mark is not hanging punctuation: it begins something.
  assert.equal((dropStageAyah(block([lead, { t: "text", v: " \u00ab\u0642\u0644\u00bb" }]), ["93:4"]).segments[0] as { v: string }).v, "\u00ab\u0642\u0644\u00bb");
});
test("on the real exports, every titled stop that opens with its own ayah starts clean once that ayah is lifted", () => {
  let lifted = 0;
  for (const paragraph of paragraphs) {
    const first = paragraph.segments[0];
    if (first?.t !== "ayah" || !paragraph.title) continue;
    const result = dropStageAyah(paragraph, paragraph.ayahs ?? []);
    if (!paragraph.ayahs?.includes(first.key)) { assert.equal(result, paragraph); continue; }
    lifted++;
    const [opening] = result.segments;
    assert.notEqual(opening, first);
    if (opening?.t === "ayah") assert.ok(!(paragraph.ayahs ?? []).includes(opening.key), "only an ayah the stage does not show can still open it");
    if (opening?.t === "text") assert.ok(!/^[\s\p{Pd}\p{Po}\p{Pe}\p{Pf}]/u.test(opening.v), "no hanging punctuation at the start");
    assert.deepEqual(result.segments.filter((segment) => segment.t === "mark"), paragraph.segments.filter((segment) => segment.t === "mark"), "no source mark is lost");
  }
  assert.ok(lifted > 0, "the real exports exercise the lift");
});

test("the separator right after an inline ayah block is dropped, and nothing else changes", () => {
  const block = { type: "paragraph" as const, role: "claim" as const, segments: [
    { t: "text" as const, v: "a: " }, { t: "ayah" as const, key: "93:2" }, { t: "text" as const, v: ". b" },
    { t: "mark" as const, records: ["r1"] }, { t: "ayah" as const, key: "93:3" }, { t: "text" as const, v: "، " }, { t: "text" as const, v: "c" }] };
  const tidy = tidyAfterAyah(block);
  assert.deepEqual(tidy.segments.map((segment: { t: string; v?: string }) => segment.v ?? segment.t), ["a: ", "ayah", "b", "mark", "ayah", "c"]);
  assert.equal(block.segments[2].v, ". b");
  const clean = { ...block, segments: block.segments.slice(0, 2) };
  assert.equal(tidyAfterAyah(clean), clean);
});
