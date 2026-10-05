// @ts-expect-error -- Node requires source extensions.
import { normalize } from "./ask/normalize.ts";

export type MushafSurah = { no: number; name: string; ayahs: number; quarter: number };
export type MushafIndex = { surahs: MushafSurah[]; quarters: [number, number][] };
export type GroupLevel = "juz" | "hizb" | "quarter";
export type SurahGroup = {
  level: GroupLevel;
  number: number;            // 1..30 | 1..60 | 1..240
  juz: number; hizb: number; // of the group's first quarter
  quarterInHizb: number;     // 1..4, of the group's first quarter
  start: { surah: number; ayah: number };
  continues: number | null;  // the surah number when the group begins inside a surah (start.ayah > 1), else null
  surahs: number[];          // surahs whose first ayah lies in this group, in mushaf order
};

const HINDI = /[٠-٩]/gu;
const PERSIAN = /[۰-۹]/gu;

/** The comparison form of a search text: normalised letters, western digits, single spaces, and without a leading surah word. */
export function searchKey(text: string, surahWord?: string): string {
  const key = (value: string) => normalize(value)
    .replace(HINDI, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(PERSIAN, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const result = key(text);
  if (surahWord) {
    const prefix = `${key(surahWord)} `;
    if (result.startsWith(prefix)) return result.slice(prefix.length);
  }
  return result;
}

const compact = (value: string) => value.replaceAll(" ", "");
const allDigits = (value: string) => /^\p{N}+$/u.test(value);

export function searchSurahs(index: MushafIndex, query: string, surahWord: string): number[] {
  const key = searchKey(query, surahWord);
  if (!key) return [];
  if (allDigits(key)) {
    const number = Number(key);
    return number >= 1 && number <= 114 ? [number] : [];
  }
  const k = compact(key);
  if (k.length < 2) return [];
  const names = index.surahs.map((item) => ({ no: item.no, name: compact(searchKey(item.name)) }));
  return [
    ...names.filter((item) => item.name.startsWith(k)),
    ...names.filter((item) => item.name.includes(k) && !item.name.startsWith(k)),
  ].map((item) => item.no);
}

export function groupSurahs(index: MushafIndex, level: GroupLevel): SurahGroup[] {
  const size = level === "juz" ? 8 : level === "hizb" ? 4 : 1;
  const count = 240 / size;
  const groups: SurahGroup[] = [];
  for (let g = 1; g <= count; g += 1) {
    const firstQuarter = (g - 1) * size + 1;
    const [surah, ayah] = index.quarters[firstQuarter - 1];
    groups.push({
      level, number: g,
      juz: Math.ceil(firstQuarter / 8), hizb: Math.ceil(firstQuarter / 4), quarterInHizb: ((firstQuarter - 1) % 4) + 1,
      start: { surah, ayah }, continues: ayah > 1 ? surah : null,
      surahs: index.surahs.filter((item) => Math.ceil(item.quarter / size) === g).map((item) => item.no),
    });
  }
  return groups;
}

/** The surah and ayah of a position 0..6235 in mushaf order. */
export function ayahLocation(index: MushafIndex, position: number): { surah: number; ayah: number } {
  if (!Number.isInteger(position) || position < 0) throw new Error(`Ayah position out of range: ${position}`);
  let rest = position;
  for (const item of index.surahs) {
    if (rest < item.ayahs) return { surah: item.no, ayah: rest + 1 };
    rest -= item.ayahs;
  }
  throw new Error(`Ayah position out of range: ${position}`);
}

/** Called once after loading: the plain ayahs without spaces, so the match does not depend on where the spelling splits words. */
export function prepareAyahs(plain: readonly string[]): string[] {
  return plain.map((text) => text.replaceAll(" ", ""));
}

export function searchAyahs(prepared: readonly string[], query: string, limit: number): { hits: number[]; total: number } {
  const key = searchKey(query);
  const k = compact(key);
  if (k.length < 4 || allDigits(k)) return { hits: [], total: 0 };
  const hits: number[] = [];
  let total = 0;
  for (let i = 0; i < prepared.length; i += 1) {
    if (!prepared[i].includes(k)) continue;
    total += 1;
    if (hits.length < limit) hits.push(i);
  }
  return { hits, total };
}
