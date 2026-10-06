import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { extraFor } from "./gather.ts";
// @ts-expect-error -- Node requires source extensions.
import { deriveAtoms } from "./atoms.ts";
// @ts-expect-error -- Node requires source extensions.
import { publicAtom } from "./public-atom.ts";
import type { Surah } from "../types";
import type { Atom, PublicAtom } from "./types";

const load = async (no: number): Promise<Surah> => JSON.parse(await readFile(new URL(`../../../../content/export/surah-${no}.json`, import.meta.url), "utf8"));
const surahs = new Map<number, Surah>(await Promise.all([93, 108, 112].map(async (no) => [no, await load(no)] as const)));
const loadSurah = async (no: number) => { const found = surahs.get(no); if (!found) throw new Error(`no surah ${no}`); return found; };
const publics = (no: number): PublicAtom[] => (deriveAtoms(surahs.get(no)!) as Atom[]).map(publicAtom);
/** The records and ayahs a public sentence draws on, read from its own segments. */
const draws = (atom: PublicAtom) => ({
  records: new Set([...atom.records, ...atom.segments.flatMap((segment) => segment.t === "term" || segment.t === "quote" ? [segment.record] : [])]),
  ayahs: atom.segments.flatMap((segment) => segment.t === "ayah" ? [segment.key] : []),
});

test("an answer that stays inside the open surah needs nothing more, and neither does an empty one or a book excerpt", async () => {
  assert.equal(await extraFor(publics(112), 112, loadSurah), undefined);
  assert.equal(await extraFor([], 112, loadSurah), undefined);
  const excerpt: PublicAtom = { id: "src:5:1", level: 1, role: "source", segments: [{ t: "text", v: "excerpt" }], records: [], surah: 93,
    source: { source_id: "s", title: "t", author: "a", locator: "1", url: null } };
  let loaded = 0;
  assert.equal(await extraFor([excerpt], 112, async (no: number) => { loaded++; return loadSurah(no); }), undefined, "an excerpt has no records of ours, even when it names a surah");
  assert.equal(loaded, 0, "and its surah is not even read");
});
test("a verified sentence of another surah brings the records its markers, quotes and terms open, and the ayahs it shows, exactly as that surah's file has them", async () => {
  const other = publics(93);
  const withAyah = other.find((atom) => draws(atom).ayahs.length > 0)!;
  const withTerm = other.find((atom) => atom.segments.some((segment) => segment.t === "term"))!;
  const withQuote = other.find((atom) => atom.segments.some((segment) => segment.t === "quote"))!;
  assert.ok(withAyah && withTerm && withQuote, "the fixture surah has all three");
  const chosen = [withAyah, withTerm, withQuote];
  const extra = await extraFor(chosen, 108, loadSurah);
  assert.ok(extra);
  const wanted = new Set(chosen.flatMap((atom) => [...draws(atom).records]));
  assert.deepEqual(Object.keys(extra.records).sort(), [...wanted].sort());
  for (const id of wanted) assert.deepEqual(extra.records[id], surahs.get(93)!.records[id], id);
  const keys = chosen.flatMap((atom) => draws(atom).ayahs);
  assert.deepEqual(extra.ayahs.map((ayah: { key: string }) => ayah.key), [...new Set(keys)], "each ayah once, in the order the sentences show them");
  for (const ayah of extra.ayahs) assert.deepEqual(ayah, surahs.get(93)!.ayahs.find((item) => item.key === ayah.key));
});
test("the records a sentence draws on are its own list and those of the quotes and terms in its words, never those of another kind of segment", async () => {
  const [marked, termed, quoted, stray] = Object.keys(surahs.get(93)!.records);
  const atom: PublicAtom = { id: "93:1:blocks.0:0", level: 1, role: "claim", surah: 93, records: [],
    segments: [{ t: "text", v: "x" }, { t: "term", v: "t", record: termed }, { t: "quote", v: "q", record: quoted }, { t: "text", v: "y", record: stray } as never] };
  const extra = await extraFor([atom], 108, loadSurah);
  assert.ok(extra);
  assert.deepEqual(Object.keys(extra.records).sort(), [termed, quoted].sort(), "a quote and a term bring their records, a text segment brings none");
  const listed = await extraFor([{ ...atom, records: [marked] }], 108, loadSurah);
  assert.deepEqual(Object.keys(listed!.records).sort(), [marked, termed, quoted].sort());
});
test("sentences of two other surahs bring both surahs' records, each record once, and the open surah's own sentences bring none", async () => {
  const mixed = [...publics(93).slice(0, 6), ...publics(112).slice(0, 6), ...publics(108).slice(0, 6), ...publics(93).slice(0, 3)];
  const extra = await extraFor(mixed, 108, loadSurah);
  assert.ok(extra);
  const ids = Object.keys(extra.records);
  assert.ok(ids.some((id) => id.startsWith("93-")) && ids.some((id) => id.startsWith("112-")));
  assert.ok(!ids.some((id) => id.startsWith("108-")), "the client already has the open surah's records");
  const expected = new Set(mixed.filter((atom) => atom.surah !== 108).flatMap((atom) => [...draws(atom).records]));
  assert.deepEqual(ids.sort(), [...expected].sort());
});
test("a surah that cannot be read costs only its own sentences' records, never the request", async () => {
  const mixed = [...publics(93).slice(0, 6), ...publics(112).slice(0, 6)];
  const extra = await extraFor(mixed, 108, async (no: number) => { if (no === 93) throw new Error("unreadable"); return loadSurah(no); });
  assert.ok(extra);
  assert.ok(Object.keys(extra.records).length > 0 && Object.keys(extra.records).every((id) => id.startsWith("112-")));
  assert.equal(await extraFor(mixed, 108, async () => { throw new Error("nothing is readable"); }), undefined);
});
test("a record or an ayah that the other surah does not have is left out, and nothing at all gives no extra", async () => {
  const stray: PublicAtom = { id: "93:1:blocks.0:0", level: 1, role: "claim", records: ["93-r999"], surah: 93,
    segments: [{ t: "text", v: "x" }, { t: "ayah", key: "93:99" }, { t: "quote", v: "q", record: "93-r998" }, { t: "mark", records: ["93-r999"] }] };
  assert.equal(await extraFor([stray], 108, loadSurah), undefined);
  const real = publics(93).find((atom) => atom.records.length > 0)!;
  const extra = await extraFor([stray, real], 108, loadSurah);
  assert.ok(extra);
  assert.deepEqual(Object.keys(extra.records).sort(), [...draws(real).records].sort());
});
