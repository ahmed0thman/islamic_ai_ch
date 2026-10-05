import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { ayahLocation, groupSurahs, prepareAyahs, searchAyahs, searchKey, searchSurahs } from "./mushaf.ts";

const read = async (name: string) => JSON.parse(await readFile(new URL(`../content/${name}`, import.meta.url), "utf8"));
const index = await read("mushaf-index.json");
const plain: string[] = await read("quran-plain.json");
const uthmani: string[] = await read("quran-uthmani.json");
const prepared = prepareAyahs(plain);
// Arabic appears only as test queries, as in the other tests.
const word = "سورة";
const surahs = (query: string) => searchSurahs(index, query, word);
const counts = (level: "juz" | "hizb" | "quarter") => groupSurahs(index, level).map((group: { surahs: number[] }) => group.surahs.length);

test("the index has 114 surahs, 6236 ayahs and 240 quarters at the known places", () => {
  assert.deepEqual(index.surahs.map((item: { no: number }) => item.no), Array.from({ length: 114 }, (_, i) => i + 1));
  assert.equal(index.surahs.reduce((sum: number, item: { ayahs: number }) => sum + item.ayahs, 0), 6236);
  assert.equal(index.quarters.length, 240);
  assert.deepEqual(index.quarters[0], [1, 1]);
  assert.deepEqual(index.quarters[105], [15, 49]);
  assert.deepEqual(index.quarters[24], [3, 93]);
  assert.deepEqual(index.quarters[80], [9, 93]);
  assert.deepEqual(index.quarters[239], [100, 9]);
  const duha = index.surahs[92];
  assert.equal(duha.ayahs, 11);
  assert.equal(duha.quarter, 238);
});

test("a search key ignores marks, ya and alif maqsura, and takes Hindi digits", () => {
  assert.equal(searchKey("الضُّحَى"), searchKey("الضحي"));
  assert.equal(searchKey(`${word} الماعون`, word), searchKey("الماعون"));
  assert.equal(searchKey("١١٢"), "112");
});

test("searching surahs by name and by number", () => {
  assert.deepEqual(surahs("112"), [112]);
  assert.deepEqual(surahs("١١٢"), [112]);
  assert.deepEqual(surahs("0"), []);
  assert.deepEqual(surahs("115"), []);
  assert.deepEqual(surahs(""), []);
  assert.deepEqual(surahs("الضحى"), [93]);
  assert.deepEqual(surahs("ضحي"), [93]);
  assert.deepEqual(surahs("اخلاص"), [112]);
  assert.deepEqual(surahs(`${word} الماعون`), [107]);
  assert.deepEqual(surahs("الرحمن"), [55]);
  assert.equal(surahs("يس")[0], 36);
  assert.ok(surahs("سبأ").includes(34));
});

test("grouping by juz", () => {
  const groups = groupSurahs(index, "juz");
  assert.equal(groups.length, 30);
  assert.deepEqual(counts("juz"), [2, 0, 1, 1, 0, 1, 1, 1, 1, 1, 2, 1, 2, 2, 2, 2, 2, 3, 2, 2, 4, 3, 3, 2, 4, 6, 6, 9, 11, 37]);
  assert.deepEqual(groups[0].start, { surah: 1, ayah: 1 });
  assert.equal(groups[0].continues, null);
  assert.deepEqual(groups[0].surahs, [1, 2]);
  assert.deepEqual(groups[1].start, { surah: 2, ayah: 142 });
  assert.equal(groups[1].continues, 2);
  assert.deepEqual(groups[1].surahs, []);
  assert.deepEqual(groups[3].start, { surah: 3, ayah: 93 });
  const last = groups[29];
  assert.deepEqual(last.start, { surah: 78, ayah: 1 });
  assert.equal(last.continues, null);
  assert.deepEqual(last.surahs, Array.from({ length: 37 }, (_, i) => 78 + i));
});

test("grouping by hizb", () => {
  const groups = groupSurahs(index, "hizb");
  assert.equal(groups.length, 60);
  assert.deepEqual(groups[1].start, { surah: 2, ayah: 75 });
  assert.deepEqual(groups[59].start, { surah: 87, ayah: 1 });
  assert.deepEqual(groups[59].surahs, Array.from({ length: 28 }, (_, i) => 87 + i));
});

test("grouping by quarter", () => {
  const groups = groupSurahs(index, "quarter");
  assert.equal(groups.length, 240);
  assert.equal(groups.filter((group: { surahs: number[] }) => group.surahs.length === 0).length, 160);
  assert.deepEqual(groups[237].surahs, [90, 91, 92, 93]);
  assert.equal(groups[237].hizb, 60);
  assert.equal(groups[237].quarterInHizb, 2);
  const last = groups[239];
  assert.deepEqual(last.start, { surah: 100, ayah: 9 });
  assert.equal(last.continues, 100);
  assert.deepEqual(last.surahs, Array.from({ length: 14 }, (_, i) => 101 + i));
});

test("every level places each surah exactly once", () => {
  for (const level of ["juz", "hizb", "quarter"] as const) {
    assert.equal(groupSurahs(index, level).reduce((sum: number, group: { surahs: number[] }) => sum + group.surahs.length, 0), 114, level);
  }
});

test("an ayah position becomes a surah and an ayah", () => {
  assert.deepEqual(ayahLocation(index, 0), { surah: 1, ayah: 1 });
  assert.deepEqual(ayahLocation(index, 7), { surah: 2, ayah: 1 });
  assert.deepEqual(ayahLocation(index, 6079), { surah: 93, ayah: 1 });
  assert.deepEqual(ayahLocation(index, 6221), { surah: 112, ayah: 1 });
  assert.deepEqual(ayahLocation(index, 6235), { surah: 114, ayah: 6 });
  assert.throws(() => ayahLocation(index, 6236));
});

test("searching ayahs needs four letters and ignores where the spelling splits words", () => {
  const first = searchAyahs(prepared, "والضحى", 20);
  assert.equal(first.total, 1);
  assert.deepEqual(first.hits, [6079]);
  assert.deepEqual(searchAyahs(prepared, "قل هو الله أحد", 20).hits, [6221]);
  assert.deepEqual(searchAyahs(prepared, "أرأيت الذي يكذب بالدين", 20).hits, [6197]);
  const many = searchAyahs(prepared, "يا أيها الذين آمنوا", 20);
  assert.equal(many.total, 89);
  assert.equal(many.hits.length, 20);
  assert.equal(many.hits[0], 110);
  assert.equal(searchAyahs(prepared, "الض", 20).total, 0);
  assert.equal(searchAyahs(prepared, "112", 20).total, 0);
});

test("the display file holds a non-empty text for each of the 6236 ayahs", () => {
  assert.equal(uthmani.length, 6236);
  assert.ok(uthmani.every((text) => typeof text === "string" && text.length > 0));
});
