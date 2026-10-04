import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node's native TypeScript runner needs the source extension.
import { tidyQuoteMarks } from "./quote-marks.ts";
// @ts-expect-error -- Node's native TypeScript runner needs the source extension.
import { arabicDigits } from "./numerals.ts";
import type { Segment, Surah } from "./types";

test("the « before a quote and the » after it are dropped, and the punctuation after » rides on the quote", () => {
  const input: Segment[] = [{ t: "text", v: "قال فلان: «" }, { t: "quote", v: "نص", record: "r1" }, { t: "mark", records: ["r1"] }, { t: "text", v: "»، وقال آخر: «" }, { t: "quote", v: "ثان", record: "r2" }, { t: "text", v: "»." }];
  const snapshot = structuredClone(input);
  const out = tidyQuoteMarks(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(out, [{ t: "text", v: "قال فلان:" }, { t: "quote", v: "نص", record: "r1", trail: "،" }, { t: "mark", records: ["r1"] }, { t: "text", v: "وقال آخر:" }, { t: "quote", v: "ثان", record: "r2", trail: "." }]);
});

test("text with no quote, and a quote without these marks, pass through unchanged", () => {
  const input: Segment[] = [{ t: "text", v: "كلام «بين علامتين» عادي" }, { t: "quote", v: "نص", record: "r1" }, { t: "text", v: " ثم كلام" }];
  assert.deepEqual(tidyQuoteMarks(input), input);
});

const surahs: Surah[] = await Promise.all([93, 96, 108, 111].map(async (no) => JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8"))));
test("real export (93, 96, 108, 111): no « hangs before a quote, no » after it, and nothing else changes", () => {
  const strip = (text: string) => text.replace(/[«»\s،,.؛:!؟…]/gu, "");
  let quotes = 0;
  for (const surah of surahs) for (const level of surah.levels) for (const block of level.blocks) {
    const lists = block.type === "paragraph" ? [block.segments] : block.type === "details" ? block.blocks.map((inner) => inner.segments) : [];
    for (const segments of lists) {
      const out = tidyQuoteMarks(segments);
      assert.deepEqual(out.filter((segment) => segment.t === "quote").map(({ trail, ...rest }) => rest), segments.filter((segment) => segment.t === "quote"));
      assert.deepEqual(out.filter((segment) => segment.t === "mark"), segments.filter((segment) => segment.t === "mark"));
      const words = (list: Segment[]) => strip(list.map((segment) => segment.t === "text" ? segment.v : segment.t === "quote" ? (segment.trail ?? "") : "").join(""));
      assert.equal(words(out), words(segments));
      out.forEach((segment, i) => {
        if (segment.t !== "quote") return;
        quotes++;
        assert.ok(!(out[i - 1]?.t === "text" && /«\s*$/u.test((out[i - 1] as { v: string }).v)));
        let next = i + 1; while (out[next]?.t === "mark") next++;
        assert.ok(!(out[next]?.t === "text" && /^\s*»/u.test((out[next] as { v: string }).v)));
      });
    }
  }
  assert.ok(quotes > 0);
});

test("a source position's digits become Arabic-Indic and nothing else changes", () => {
  assert.equal(arabicDigits("عند الآية 3 من سورة الضحى"), "عند الآية ٣ من سورة الضحى");
  assert.equal(arabicDigits("الحديث رقم 65351 في الموسوعة"), "الحديث رقم ٦٥٣٥١ في الموسوعة");
  assert.equal(arabicDigits("٤/٦٤٣ (ترقيم)"), "٤/٦٤٣ (ترقيم)");
});
