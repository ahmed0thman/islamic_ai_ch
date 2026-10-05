import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { ContentIndex, Surah, Ui } from "./types";
import { onlyPublished } from "./published";
export type * from "./types";

const directory = path.join(process.cwd(), "src/content");
async function readJson(name: string): Promise<unknown> {
  try { return JSON.parse(await readFile(path.join(directory, name), "utf8")); }
  catch (error) { throw new Error(`Cannot load ${name}. Run pnpm sync-content first.`, { cause: error }); }
}
function fail(at: string, message: string): never { throw new Error(`Invalid surah at ${at}: ${message}`); }
function object(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(at, "expected an object");
  return value as Record<string, unknown>;
}
function array(value: unknown, at: string): unknown[] {
  if (!Array.isArray(value)) fail(at, "expected an array");
  return value;
}
function string(value: unknown, at: string): asserts value is string {
  if (typeof value !== "string") fail(at, "expected a string");
}
function integer(value: unknown, at: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) fail(at, `expected integer ${min}..${max}`);
}
function summary(value: unknown, at: string) {
  const item = object(value, at);
  integer(item.no, `${at}.no`, 1, 114);
  string(item.name, `${at}.name`);
  integer(item.ayah_count, `${at}.ayah_count`, 1, 286);
  return item;
}
const icons = new Set(["ayah", "hadith", "athar", "scholar", "link", "hidaya"]);
const badges = new Set(["thabit", "la_yathbut", "khilaf_mutabar"]);
const strengths = new Set(["strong", "medium", "weak", "unrated"]);
function member(value: unknown, allowed: Set<string>, at: string) {
  if (typeof value !== "string" || !allowed.has(value)) fail(at, "unknown dictionary key");
}

// Match the exporter's C2 normalization and four-word Quran scan.
function quranWords(value: string): string[] {
  const replacements: Record<string, string> = {
    "\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627", "\u0671": "\u0627",
    "\u0629": "\u0647", "\u0649": "\u064a", "\u0624": "\u0648", "\u0626": "\u064a", "\u0621": "",
  };
  return value.replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640\ufeff]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671\u0629\u0649\u0624\u0626\u0621]/g, (letter) => replacements[letter])
    .replace(/[^\u0621-\u064a\s]/g, " ").trim().split(/\s+/).filter(Boolean).map((word) => {
      word = word.replaceAll("\u0633\u0645\u0627\u0648\u0627\u062a", "\u0633\u0645\u0648\u0627\u062a")
        .replaceAll("\u0644\u0627\u062a\u062e\u0630\u062a", "\u0644\u062a\u062e\u0630\u062a")
        .replaceAll("\u062f\u0627\u0648\u0648\u062f", "\u062f\u0627\u0648\u062f")
        .replaceAll("\u062d\u064a\u064a", "\u062d\u064a");
      if (word.startsWith("\u0627\u0627") && word.length > 2) word = "\u0627\u064a" + word.slice(2);
      return word.endsWith("\u0648\u0627") ? word.slice(0, -1) : word;
    });
}

export function validateSurah(value: unknown): asserts value is Surah {
  const data = object(value, "root");
  if (data.schema !== 1) fail("schema", "expected version 1");
  if (typeof data.fixture !== "boolean") fail("fixture", "expected a boolean");
  const meta = summary(data.surah, "surah");
  const prefix = `surah-${meta.no}`;
  // `ayahs` also carries ayahs cited from other surahs, so only this surah's own are counted.
  const ayahKeys = new Set<string>();
  const ownKeys = new Set<string>();
  const quranWindows = new Set<string>();
  let own = 0;
  array(data.ayahs, `${prefix}.ayahs`).forEach((value, i) => {
    const at = `${prefix}.ayahs[${i}]`, ayah = object(value, at);
    string(ayah.key, `${at}.key`); string(ayah.text, `${at}.text`);
    integer(ayah.no, `${at}.no`, 1, 286);
    const match = /^(\d{1,3}):(\d{1,3})$/.exec(ayah.key);
    if (!match || Number(match[2]) !== ayah.no) fail(at, "key does not match surah and ayah number");
    const surahNo = Number(match[1]);
    if (surahNo < 1 || surahNo > 114) fail(at, "unknown surah in ayah key");
    if (surahNo === meta.no && (ayah.no as number) > (meta.ayah_count as number)) fail(at, "ayah number beyond the surah");
    if (ayahKeys.has(ayah.key)) fail(at, "duplicate ayah");
    ayahKeys.add(ayah.key);
    if (surahNo === meta.no) {
      own += 1;
      ownKeys.add(ayah.key);
      const words = quranWords(ayah.text);
      for (let i = 0; i + 4 <= words.length; i++) quranWindows.add(words.slice(i, i + 4).join(" "));
    }
  });
  if (own !== meta.ayah_count) fail(`${prefix}.ayahs`, "ayah count does not match metadata");
  const records = object(data.records, `${prefix}.records`);
  for (const [id, value] of Object.entries(records)) {
    const at = `${prefix}.records.${id}`, record = object(value, at);
    if (record.id !== id) fail(at, "record id does not match its map key");
    const recordIcons = array(record.icons, `${at}.icons`);
    if (!recordIcons.length) fail(`${at}.icons`, "expected at least one icon");
    recordIcons.forEach((icon) => member(icon, icons, `${at}.icons`));
    if (record.badge !== null) member(record.badge, badges, `${at}.badge`);
    string(record.claim, `${at}.claim`); string(record.status_text, `${at}.status_text`);
    integer(record.depth_min, `${at}.depth_min`, 0, 3);
    if (Object.hasOwn(record, "science") && record.science !== null) string(record.science, `${at}.science`);
    array(record.ayah_keys, `${at}.ayah_keys`).forEach((key) => {
      string(key, `${at}.ayah_keys`);
      const match = /^([1-9]\d{0,2}):([1-9]\d{0,2})$/.exec(key);
      if (!match || Number(match[1]) > 114 || Number(match[2]) > 286) fail(at, "invalid record ayah key");
      if (Number(match[1]) === meta.no && !ownKeys.has(key)) fail(at, "record ayah beyond this surah");
    });
    array(record.evidence, `${at}.evidence`).forEach((value, i) => {
      const here = `${at}.evidence[${i}]`, evidence = object(value, here);
      // The record's icons list only the evidence its claim is built on; the panel may show more.
      member(evidence.icon, icons, `${here}.icon`);
      for (const field of ["source_title", "author", "locator", "quote"]) string(evidence[field], `${here}.${field}`);
      if ([...(evidence.quote as string)].length > 200) fail(`${here}.quote`, "quote exceeds 200 characters");
      if (evidence.url !== null) {
        string(evidence.url, `${here}.url`);
        let url: URL;
        try { url = new URL(evidence.url); } catch { fail(`${here}.url`, "expected an absolute URL"); }
        if (!["https:", "http:"].includes(url.protocol)) fail(`${here}.url`, "expected an HTTP(S) source URL");
      }
      if (evidence.link_strength !== null) member(evidence.link_strength, strengths, `${here}.link_strength`);
      array(evidence.rulings, `${here}.rulings`).forEach((value, j) => {
        const ruling = object(value, `${here}.rulings[${j}]`);
        for (const field of ["text", "ruler", "where"]) string(ruling[field], `${here}.rulings[${j}].${field}`);
      });
    });
  }
  const requireRecord = (id: unknown, at: string) => {
    string(id, at);
    if (!Object.hasOwn(records, id)) fail(at, `missing record "${id}"`);
  };
  const requireAyah = (key: unknown, at: string) => {
    string(key, at);
    if (!ayahKeys.has(key)) fail(at, `missing ayah key "${key}"`);
  };
  const systemTitle = (value: unknown, at: string, stop = false) => {
    string(value, at);
    if (!value.trim() || (stop && value.trim().split(/\s+/).length > 8)) fail(at, "expected nonempty system title; stop titles have at most 8 words");
    const words = quranWords(value);
    if (/[\uFD3F\uFD3E]/.test(value)) fail(at, "Quran brackets in system title");
    for (let i = 0; i + 4 <= words.length; i++) {
      if (quranWindows.has(words.slice(i, i + 4).join(" "))) fail(at, "Quran text in system title");
    }
  };
  const passages = new Map<string, Set<string>>();
  if (Object.hasOwn(data, "passages")) {
    let next = 1;
    array(data.passages, `${prefix}.passages`).forEach((value, i) => {
      const at = `${prefix}.passages[${i}]`, passage = object(value, at);
      string(passage.id, `${at}.id`);
      if (!passage.id.trim() || passages.has(passage.id)) fail(at, "empty or duplicate passage id");
      systemTitle(passage.title, `${at}.title`);
      string(passage.from, `${at}.from`); string(passage.to, `${at}.to`);
      if (!ownKeys.has(passage.from) || !ownKeys.has(passage.to)) fail(at, "passage endpoints must belong to this surah");
      const start = Number(passage.from.split(":")[1]), end = Number(passage.to.split(":")[1]);
      if (start !== next || end < start) fail(at, "passages must be consecutive in order without gaps or overlaps");
      const keys = new Set<string>();
      for (let n = start; n <= end; n++) keys.add(`${meta.no}:${n}`);
      passages.set(passage.id, keys);
      next = end + 1;
      const ids = array(passage.records, `${at}.records`);
      if (!ids.length) fail(at, "passage must have records");
      ids.forEach((id) => requireRecord(id, `${at}.records`));
    });
    if (next !== (meta.ayah_count as number) + 1) fail(`${prefix}.passages`, "passages must cover the whole surah");
  }
  const validateMapBlock = (block: Record<string, unknown>, at: string) => {
    const stop = block.type === "paragraph" && Object.hasOwn(block, "title");
    if (Object.hasOwn(block, "title") && block.type !== "details") {
      if (block.type !== "paragraph") fail(at, "only paragraphs may have stop titles");
      systemTitle(block.title, `${at}.title`, true);
    }
    let keys: unknown[] = [];
    if (Object.hasOwn(block, "ayahs") || stop) {
      if (block.type !== "paragraph") fail(at, "only paragraphs may carry stop ayahs");
      keys = array(block.ayahs, `${at}.ayahs`);
      keys.forEach((key) => {
        requireAyah(key, `${at}.ayahs`);
        if (!ownKeys.has(key as string)) fail(at, "stop ayahs must belong to this surah");
      });
      if (stop && !keys.length) fail(at, "stop must have at least one ayah");
    }
    if (Object.hasOwn(block, "passage")) {
      string(block.passage, `${at}.passage`);
      const range = passages.get(block.passage);
      if (!range) fail(at, "unknown passage");
      if (stop && keys.some((key) => !range.has(key as string))) fail(at, "stop ayahs outside its passage");
    } else if (stop && Object.hasOwn(data, "passages")) fail(at, "stop must identify its passage");
  };
  const validateSegments = (value: unknown, at: string, depth: number, title = false) => {
    const segments = array(value, at);
    if (!segments.length) fail(at, "expected nonempty segments");
    let hasMarker = false;
    segments.forEach((value, s) => {
      const location = `${at}[${s}]`, segment = object(value, location);
      if (title && !["text", "term", "mark"].includes(segment.t as string)) fail(location, "invalid title segment");
      const reference = (id: unknown, here: string) => {
        requireRecord(id, here);
        if ((object(records[id as string], here).depth_min as number) > depth) fail(here, "record exceeds level depth");
      };
      if (segment.t === "text") string(segment.v, `${location}.v`);
      else if (segment.t === "ayah") requireAyah(segment.key, `${location}.key`);
      else if (segment.t === "quote" || segment.t === "term") {
        string(segment.v, `${location}.v`);
        if (segment.t === "term" && !segment.v.trim()) fail(location, "expected nonempty term text");
        reference(segment.record, `${location}.record`);
      } else if (segment.t === "mark") {
        hasMarker = true;
        const ids = array(segment.records, `${location}.records`);
        if (!ids.length) fail(location, "marker must refer to at least one record");
        ids.forEach((id) => reference(id, `${location}.records`));
      } else fail(location, "unknown segment type");
    });
    if (!hasMarker) fail(at, "expected at least one marker");
    if (title && object(segments[segments.length - 1], at).t !== "mark") fail(at, "title must end with a marker");
  };
  const validateParagraph = (block: Record<string, unknown>, at: string, depth: number, inDetails = false) => {
    if (block.type !== "paragraph") fail(at, "expected a paragraph; details cannot nest");
    if (block.role === "example") {
      // An example illustrates and claims nothing: plain text only, no marker, no stop, never inside a details item.
      if (inDetails) fail(at, "an example never sits inside details");
      if (Object.hasOwn(block, "title") || Object.hasOwn(block, "ayahs")) fail(at, "an example has no title and no ayahs");
      validateMapBlock(block, at);
      const parts = array(block.segments, `${at}.segments`);
      if (!parts.length) fail(`${at}.segments`, "expected nonempty segments");
      parts.forEach((part, i) => {
        const segment = object(part, `${at}.segments[${i}]`);
        if (segment.t !== "text") fail(`${at}.segments[${i}]`, "an example holds text segments only");
        string(segment.v, `${at}.segments[${i}].v`);
      });
      return;
    }
    if (block.role !== "claim" && block.role !== "transmission") fail(at, "unknown paragraph role");
    validateMapBlock(block, at);
    validateSegments(block.segments, `${at}.segments`, depth);
  };
  const levels = array(data.levels, `${prefix}.levels`);
  if (levels.length !== 4) fail(`${prefix}.levels`, "expected four complete levels");
  levels.forEach((value, d) => {
    const at = `${prefix}.levels[${d}]`, level = object(value, at);
    if (level.depth !== d) fail(at, `expected depth ${d} in legend order`);
    const blocks = array(level.blocks, `${at}.blocks`);
    blocks.forEach((value, b) => {
      const here = `${at}.blocks[${b}]`, block = object(value, here);
      if (block.type !== "paragraph") validateMapBlock(block, here);
      if (block.type === "heading") {
        string(block.text, `${here}.text`);
        if (Object.hasOwn(block, "kind")) {
          if (block.kind !== "question") fail(here, "unknown heading kind");
          if (b + 1 >= blocks.length || object(blocks[b + 1], here).type !== "paragraph") fail(here, "question must be followed by its answer paragraph");
        }
      } else if (block.type === "ayah") array(block.keys, `${here}.keys`).forEach((key) => requireAyah(key, `${here}.keys`));
      else if (block.type === "paragraph") validateParagraph(block, here, d);
      else if (block.type === "details") {
        validateSegments(block.title, `${here}.title`, d, true);
        array(block.blocks, `${here}.blocks`).forEach((value, i) => validateParagraph(object(value, `${here}.blocks[${i}]`), `${here}.blocks[${i}]`, d, true));
      } else fail(here, "unknown block type");
    });
  });
}
export const getUi = cache(async (): Promise<Ui> => await readJson("ui.ar.json") as Ui);
export const getIndex = cache(async (): Promise<ContentIndex> => {
  const data = object(await readJson("index.json"), "index"), seen = new Set<number>();
  array(data.surahs, "index.surahs").forEach((value, i) => {
    const item = summary(value, `index.surahs[${i}]`);
    if (seen.has(item.no as number)) fail("index.surahs", "duplicate surah number");
    seen.add(item.no as number);
  });
  // Only the published surahs, in their own order: everything that lists or builds surahs goes through here.
  return { surahs: onlyPublished((data as unknown as ContentIndex).surahs) };
});
export const getSurah = cache(async (no: number): Promise<Surah> => {
  integer(no, "requested surah", 1, 114);
  const data = await readJson(`surah-${no}.json`);
  validateSurah(data);
  if (data.surah.no !== no) fail(`surah-${no}`, "file number and metadata differ");
  return data;
});
