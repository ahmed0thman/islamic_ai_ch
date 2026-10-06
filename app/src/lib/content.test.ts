import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { register } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- Node requires source extensions.
import { publishedSurahs } from "./published.ts";

// content.ts imports "./published" with no extension, the way Next resolves it, and Node's own loader refuses that (ERR_MODULE_NOT_FOUND).
// So that the real file is what gets tested, a relative import with no extension is retried with ".ts", for this test process only.
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  const file = specifier.split(/[?#]/)[0];
  if (/^\\.{1,2}\\//.test(file) && !/\\.[a-z]+$/.test(file)) {
    try { return await nextResolve(specifier.replace(file, file + ".ts"), context); } catch { /* the specifier was not a TypeScript file either */ }
  }
  return nextResolve(specifier, context);
}`), import.meta.url);
// content.ts reads app/src/content/ from the working directory. pnpm runs the tests from app/; this keeps them right when they are run from anywhere else.
process.chdir(fileURLToPath(new URL("../..", import.meta.url)));
// @ts-expect-error -- Node requires source extensions.
const content = await import("./content.ts");
// An assertion function needs an explicit type to be called as a statement; this one is only ever called inside a callback.
const validate: (value: unknown) => void = content.validateSurah;

// The surahs are mutated into invalid shapes on purpose, so they are not typed as `Surah`.
type Json = any;
type Path = (string | number)[];
// The four surahs the brief names, plus whatever the app publishes: the files the app builds are exactly the ones that must pass.
const published: number[] = [...new Set<number>([93, 107, 108, 112, ...publishedSurahs])];
const read = async (name: string): Promise<Json> => JSON.parse(await readFile(new URL(`../../../content/${name}`, import.meta.url), "utf8"));
const files = new Map<number, Json>(await Promise.all(published.map(async (no) => [no, await read(`export/surah-${no}.json`)] as const)));
/** A deep copy of a valid export file: every refusal below is that copy with one change. Surah 93 has passages, stops, misconceptions, examples, details and terms. */
const fresh = (no = 93): Json => structuredClone(files.get(no));

const at = (path: Path, no = 93) => path.reduce<string>((text, part) => typeof part === "number" ? `${text}[${part}]` : `${text}.${part}`, `surah-${no}`);
const walk = (root: Json, path: Path): Json => path.reduce((node, part) => node[part], root);
const parent = (root: Json, path: Path): Json => walk(root, path.slice(0, -1));
const last = (path: Path) => path[path.length - 1];
/** Applies the one change, then the validator must refuse the result with exactly this message at exactly this place. */
function refuses(name: string, change: (surah: Json) => string, message: string, no = 93) {
  test(`validateSurah refuses ${name}`, () => {
    const surah = fresh(no);
    const where = change(surah);
    assert.throws(() => validate(surah), { message: `Invalid surah at ${where}: ${message}` });
  });
}
/** The first block of a level that satisfies the test, as a path. */
function block(surah: Json, depth: number, matches: (block: Json) => boolean, no = 93): Path {
  const i = surah.levels[depth].blocks.findIndex(matches);
  assert.ok(i >= 0, `the fixture has no such block at depth ${depth}`);
  return ["levels", depth, "blocks", i];
}
const isStop = (b: Json) => b.type === "paragraph" && b.title !== undefined && b.kind === undefined && b.role === "claim";
const isMisconception = (b: Json) => b.type === "paragraph" && b.kind === "misconception";
const isSummary = (b: Json) => b.type === "paragraph" && b.kind === "summary";
const isExample = (b: Json) => b.type === "paragraph" && b.role === "example";
const isDetails = (b: Json) => b.type === "details";
const isPlain = (b: Json) => b.type === "paragraph" && b.role === "claim" && b.title === undefined && b.kind === undefined;
/** Every segment of the surah, with its path: paragraphs, details titles and the paragraphs inside details. */
function* segments(surah: Json): Generator<{ path: Path; segment: Json }> {
  for (const [d, level] of surah.levels.entries()) for (const [b, item] of level.blocks.entries()) {
    const base: Path = ["levels", d, "blocks", b];
    if (item.type === "paragraph") for (const [k, segment] of item.segments.entries()) yield { path: [...base, "segments", k], segment };
    if (item.type === "details") {
      for (const [k, segment] of item.title.entries()) yield { path: [...base, "title", k], segment };
      for (const [j, inner] of item.blocks.entries()) for (const [k, segment] of inner.segments.entries()) yield { path: [...base, "blocks", j, "segments", k], segment };
    }
  }
}
function segment(surah: Json, type: string, depth?: number): { path: Path; segment: Json } {
  for (const found of segments(surah)) if (found.segment.t === type && (depth === undefined || found.path[1] === depth)) return found;
  throw new Error(`the fixture has no ${type} segment`);
}
const firstRecord = (surah: Json): string => Object.keys(surah.records)[0];
/** The position of an ayah in the list, by its key; and the key of an ayah that belongs to another surah (the file also carries the ayahs its records cite). */
const indexOf = (surah: Json, key: string): number => { const i = surah.ayahs.findIndex((ayah: Json) => ayah.key === key); assert.ok(i >= 0, `the fixture has no ayah ${key}`); return i; };
const otherSurahAyah = (surah: Json): string => surah.ayahs.find((ayah: Json) => !ayah.key.startsWith("93:")).key;
/** The first four words of an own ayah, as written in the file: Quran text, taken from the data and not typed here. */
const quranWords = (surah: Json) => surah.ayahs.find((ayah: Json) => ayah.key === "93:3").text.split(/\s+/).slice(0, 4).join(" ");

test("the published export files are accepted as they are, and checking them changes nothing", async () => {
  for (const no of published) {
    const surah = await read(`export/surah-${no}.json`);
    assert.doesNotThrow(() => validate(surah), `surah ${no}`);
    assert.deepEqual(surah, files.get(no), `surah ${no} was changed by being checked`);
    assert.equal(surah.schema, 1);
    assert.equal(surah.fixture, false, "a published surah is real content, not placeholder data");
  }
  assert.ok(published.length >= 4);
});

// --- The misconception stop: the type whose arrival once broke the build -------------------------------------------------------------------

test("a titled misconception stop is accepted, as a claim and as a transmission, and so is every one the published files carry", () => {
  for (const [no, surah] of files) {
    for (const level of surah.levels) for (const item of level.blocks.filter(isMisconception)) {
      assert.ok(typeof item.title === "string" && item.title.trim(), `a published misconception of surah ${no} has a title`);
    }
  }
  // Surah 108 has no misconception stop: a plain titled stop becomes one with the single change of its kind, and a transmission stop likewise.
  for (const role of ["claim", "transmission"]) {
    const surah = fresh(108);
    const path = block(surah, 1, (item) => item.type === "paragraph" && item.title !== undefined && item.kind === undefined && item.role === role, 108);
    walk(surah, path).kind = "misconception";
    assert.doesNotThrow(() => validate(surah), `a ${role} stop that is a misconception`);
  }
});
refuses("a misconception with no title", (s) => { const path = block(s, 1, isMisconception); delete walk(s, path).title; return at(path); }, "a misconception is a titled stop");
refuses("a misconception whose title is empty", (s) => { const path = block(s, 1, isMisconception); walk(s, path).title = ""; return at(path); }, "a misconception is a titled stop");
refuses("a misconception whose title is not text", (s) => { const path = block(s, 1, isMisconception); walk(s, path).title = 7; return at(path); }, "a misconception is a titled stop");
refuses("a misconception whose title is only spaces", (s) => { const path = block(s, 1, isMisconception); walk(s, path).title = "   "; return at([...path, "title"]); },
  "expected nonempty system title; stop titles have at most 8 words");
refuses("a misconception inside a details item", (s) => {
  const copy = structuredClone(walk(s, block(s, 1, isMisconception)));
  const path = block(s, 3, isDetails);
  const inner = walk(s, path).blocks;
  inner.push(copy);
  return at([...path, "blocks", inner.length - 1]);
}, "a misconception never sits inside details");
refuses("a misconception with no ayahs, since it is a stop", (s) => { const path = block(s, 1, isMisconception); delete walk(s, path).ayahs; return at([...path, "ayahs"]); }, "expected an array");
refuses("a misconception of an unknown role", (s) => { const path = block(s, 1, isMisconception); walk(s, path).role = "claim-ish"; return at(path); }, "unknown paragraph role");

// --- The whole file --------------------------------------------------------------------------------------------------------------------

for (const [name, value] of [["null", null], ["undefined", undefined], ["an array", []], ["a string", "surah"], ["a number", 93]] as const) {
  test(`validateSurah refuses a root that is ${name}`, () => assert.throws(() => validate(value), { message: "Invalid surah at root: expected an object" }));
}
refuses("another schema version", (s) => { s.schema = 2; return "schema"; }, "expected version 1");
refuses("a missing schema version", (s) => { delete s.schema; return "schema"; }, "expected version 1");
refuses("a fixture flag that is not a boolean", (s) => { s.fixture = "false"; return "fixture"; }, "expected a boolean");
refuses("a missing fixture flag", (s) => { delete s.fixture; return "fixture"; }, "expected a boolean");
refuses("a missing surah summary", (s) => { delete s.surah; return "surah"; }, "expected an object");
refuses("a surah summary with no name", (s) => { delete s.surah.name; return "surah.name"; }, "expected a string");
for (const value of [0, 115, 1.5, "93", null]) refuses(`a surah number of ${JSON.stringify(value)}`, (s) => { s.surah.no = value; return "surah.no"; }, "expected integer 1..114");
for (const value of [0, 287, 2.5]) refuses(`an ayah count of ${value}`, (s) => { s.surah.ayah_count = value; return "surah.ayah_count"; }, "expected integer 1..286");
refuses("an ayah count that is higher than the surah's own ayahs", (s) => { s.surah.ayah_count = 12; return at(["ayahs"]); }, "ayah count does not match metadata");
refuses("an ayah count that leaves an own ayah beyond the surah", (s) => { s.surah.ayah_count = 10; return at(["ayahs", indexOf(s, "93:11")]); }, "ayah number beyond the surah");
refuses("a missing list of ayahs", (s) => { delete s.ayahs; return at(["ayahs"]); }, "expected an array");
refuses("a missing map of records", (s) => { delete s.records; return at(["records"]); }, "expected an object");
refuses("records that are a list", (s) => { s.records = []; return at(["records"]); }, "expected an object");
refuses("missing levels", (s) => { delete s.levels; return at(["levels"]); }, "expected an array");
refuses("only three levels", (s) => { s.levels.pop(); return at(["levels"]); }, "expected four complete levels");
refuses("a fifth level", (s) => { s.levels.push({ depth: 4, blocks: [] }); return at(["levels"]); }, "expected four complete levels");
refuses("levels out of the legend order", (s) => { s.levels.reverse(); return at(["levels", 0]); }, "expected depth 0 in legend order");
refuses("a level whose depth repeats the one before", (s) => { s.levels[1].depth = 0; return at(["levels", 1]); }, "expected depth 1 in legend order");
refuses("a level with no depth", (s) => { delete s.levels[2].depth; return at(["levels", 2]); }, "expected depth 2 in legend order");
refuses("a record under a key that is not its id", (s) => { s.records[firstRecord(s)].id = "93-r999"; return at(["records", firstRecord(s)]); }, "record id does not match its map key");

// --- A missing field -------------------------------------------------------------------------------------------------------------------

const ruling = (surah: Json): Path => {
  for (const [id, item] of Object.entries<Json>(surah.records)) for (const [i, evidence] of item.evidence.entries()) if (evidence.rulings.length) return ["records", id, "evidence", i, "rulings", 0];
  throw new Error("the fixture has no ruling");
};
const missing: [string, (surah: Json) => Path, string][] = [
  ["an ayah's key", () => ["ayahs", 0, "key"], "expected a string"],
  ["an ayah's text", () => ["ayahs", 0, "text"], "expected a string"],
  ["an ayah's number", () => ["ayahs", 0, "no"], "expected integer 1..286"],
  ["a record's icons", (s) => ["records", firstRecord(s), "icons"], "expected an array"],
  ["a record's badge", (s) => ["records", firstRecord(s), "badge"], "unknown dictionary key"],
  ["a record's claim", (s) => ["records", firstRecord(s), "claim"], "expected a string"],
  ["a record's status text", (s) => ["records", firstRecord(s), "status_text"], "expected a string"],
  ["a record's depth", (s) => ["records", firstRecord(s), "depth_min"], "expected integer 0..3"],
  ["a record's ayah keys", (s) => ["records", firstRecord(s), "ayah_keys"], "expected an array"],
  ["a record's evidence", (s) => ["records", firstRecord(s), "evidence"], "expected an array"],
  ["an evidence's icon", (s) => ["records", firstRecord(s), "evidence", 0, "icon"], "unknown dictionary key"],
  ["an evidence's source title", (s) => ["records", firstRecord(s), "evidence", 0, "source_title"], "expected a string"],
  ["an evidence's author", (s) => ["records", firstRecord(s), "evidence", 0, "author"], "expected a string"],
  ["an evidence's locator", (s) => ["records", firstRecord(s), "evidence", 0, "locator"], "expected a string"],
  ["an evidence's quote", (s) => ["records", firstRecord(s), "evidence", 0, "quote"], "expected a string"],
  ["an evidence's url (it is a string or null, never absent)", (s) => ["records", firstRecord(s), "evidence", 0, "url"], "expected a string"],
  ["an evidence's link strength (it is a key or null, never absent)", (s) => ["records", firstRecord(s), "evidence", 0, "link_strength"], "unknown dictionary key"],
  ["an evidence's rulings", (s) => ["records", firstRecord(s), "evidence", 0, "rulings"], "expected an array"],
  ["a ruling's text", (s) => [...ruling(s), "text"], "expected a string"],
  ["a ruling's ruler", (s) => [...ruling(s), "ruler"], "expected a string"],
  ["a ruling's place", (s) => [...ruling(s), "where"], "expected a string"],
  ["a level's blocks", () => ["levels", 0, "blocks"], "expected an array"],
  ["a heading's text", (s) => [...block(s, 3, (b) => b.type === "heading"), "text"], "expected a string"],
  ["an ayah block's keys", (s) => [...block(s, 0, (b) => b.type === "ayah"), "keys"], "expected an array"],
  ["a paragraph's segments", (s) => [...block(s, 1, isPlain), "segments"], "expected an array"],
  ["a stop's segments", (s) => [...block(s, 1, isStop), "segments"], "expected an array"],
  ["a details item's title", (s) => [...block(s, 3, isDetails), "title"], "expected an array"],
  ["a details item's paragraphs", (s) => [...block(s, 3, isDetails), "blocks"], "expected an array"],
  ["a text segment's words", (s) => [...segment(s, "text").path, "v"], "expected a string"],
  ["a quote segment's words", (s) => [...segment(s, "quote").path, "v"], "expected a string"],
  ["a quote segment's record", (s) => [...segment(s, "quote").path, "record"], "expected a string"],
  ["a term segment's record", (s) => [...segment(s, "term").path, "record"], "expected a string"],
  ["an ayah segment's key", (s) => [...segment(s, "ayah").path, "key"], "expected a string"],
  ["a marker's records", (s) => [...segment(s, "mark").path, "records"], "expected an array"],
  ["a passage's id", () => ["passages", 0, "id"], "expected a string"],
  ["a passage's title", () => ["passages", 0, "title"], "expected a string"],
  ["a passage's first ayah", () => ["passages", 0, "from"], "expected a string"],
  ["a passage's last ayah", () => ["passages", 0, "to"], "expected a string"],
  ["a passage's records", () => ["passages", 0, "records"], "expected an array"],
];
for (const [label, locate, message] of missing) {
  refuses(`${label}, which is missing`, (s) => { const path = locate(s); delete parent(s, path)[last(path)]; return at(path); }, message);
}
refuses("a paragraph with no role", (s) => { const path = block(s, 1, isPlain); delete walk(s, path).role; return at(path); }, "unknown paragraph role");
refuses("a title on a heading, which is not a paragraph", (s) => { const path = block(s, 3, (b) => b.type === "heading"); walk(s, path).title = "x"; return at(path); }, "only paragraphs may have stop titles");
refuses("ayahs on a heading, which is not a paragraph", (s) => { const path = block(s, 3, (b) => b.type === "heading"); walk(s, path).ayahs = ["93:1"]; return at(path); }, "only paragraphs may carry stop ayahs");

// --- A record or an ayah that does not exist --------------------------------------------------------------------------------------------

const NO_RECORD = "93-r999";
refuses("a marker that points at a record that does not exist", (s) => { const found = segment(s, "mark", 1); found.segment.records = [NO_RECORD]; return at([...found.path, "records"]); }, `missing record "${NO_RECORD}"`);
refuses("a marker whose second record does not exist", (s) => { const found = segment(s, "mark", 1); found.segment.records.push(NO_RECORD); return at([...found.path, "records"]); }, `missing record "${NO_RECORD}"`);
refuses("a marker with no records", (s) => { const found = segment(s, "mark", 1); found.segment.records = []; return at([...found.path]); }, "marker must refer to at least one record");
refuses("a quote that points at a record that does not exist", (s) => { const found = segment(s, "quote"); found.segment.record = NO_RECORD; return at([...found.path, "record"]); }, `missing record "${NO_RECORD}"`);
refuses("a term that points at a record that does not exist", (s) => { const found = segment(s, "term"); found.segment.record = NO_RECORD; return at([...found.path, "record"]); }, `missing record "${NO_RECORD}"`);
refuses("a details title whose marker points at a record that does not exist", (s) => {
  const path = block(s, 3, isDetails);
  const marker = walk(s, path).title.findIndex((item: Json) => item.t === "mark");
  walk(s, path).title[marker].records = [NO_RECORD];
  return at([...path, "title", marker, "records"]);
}, `missing record "${NO_RECORD}"`);
refuses("a passage that lists a record that does not exist", (s) => { s.passages[0].records.push(NO_RECORD); return at(["passages", 0, "records"]); }, `missing record "${NO_RECORD}"`);
refuses("an ayah segment that points at an ayah that does not exist", (s) => { const found = segment(s, "ayah"); found.segment.key = "93:99"; return at([...found.path, "key"]); }, 'missing ayah key "93:99"');
refuses("an ayah block that lists an ayah that does not exist", (s) => { const path = block(s, 0, (item) => item.type === "ayah"); walk(s, path).keys.push("93:99"); return at([...path, "keys"]); }, 'missing ayah key "93:99"');
refuses("a stop that hangs from an ayah that does not exist", (s) => { const path = block(s, 1, isStop); walk(s, path).ayahs = ["93:99"]; return at([...path, "ayahs"]); }, 'missing ayah key "93:99"');
refuses("a segment of an unknown type", (s) => { const found = segment(s, "text", 1); found.segment.t = "image"; return at(found.path); }, "unknown segment type");

// --- A number out of its range ------------------------------------------------------------------------------------------------------------

for (const value of [4, -1, 1.5, "2", null]) {
  refuses(`a record depth of ${JSON.stringify(value)}`, (s) => { s.records[firstRecord(s)].depth_min = value; return at(["records", firstRecord(s), "depth_min"]); }, "expected integer 0..3");
}
refuses("a record used at a level shallower than its own depth", (s) => {
  const found = segment(s, "mark", 0);
  const id = found.segment.records[0];
  s.records[id].depth_min = 1;
  // The first reference to that record, in the order the file is read, is where the validator stops.
  for (const { path, segment: item } of segments(s)) {
    if (path[1] !== 0) break;
    if (item.record === id) return at([...path, "record"]);
    if (item.records?.includes(id)) return at([...path, "records"]);
  }
  throw new Error("the record is not used at level 0");
}, "record exceeds level depth");
for (const value of [0, 287, 1.5, "1"]) {
  refuses(`an ayah number of ${JSON.stringify(value)}`, (s) => { s.ayahs[0].no = value; return at(["ayahs", 0, "no"]); }, "expected integer 1..286");
}
refuses("an ayah whose key does not match its number", (s) => { s.ayahs[0].no = 2; return at(["ayahs", 0]); }, "key does not match surah and ayah number");
refuses("an ayah whose key is not a key", (s) => { s.ayahs[0].key = "93-1"; return at(["ayahs", 0]); }, "key does not match surah and ayah number");
refuses("an ayah of a surah that does not exist", (s) => { const i = indexOf(s, otherSurahAyah(s)); s.ayahs[i].key = "115:66"; s.ayahs[i].no = 66; return at(["ayahs", i]); }, "unknown surah in ayah key");
refuses("an ayah of surah 0", (s) => { const i = indexOf(s, otherSurahAyah(s)); s.ayahs[i].key = "0:66"; s.ayahs[i].no = 66; return at(["ayahs", i]); }, "unknown surah in ayah key");
refuses("an own ayah beyond the end of the surah", (s) => { const i = indexOf(s, "93:11"); s.ayahs[i].key = "93:12"; s.ayahs[i].no = 12; return at(["ayahs", i]); }, "ayah number beyond the surah");
refuses("the same ayah twice", (s) => { s.ayahs.push(structuredClone(s.ayahs[0])); return at(["ayahs", s.ayahs.length - 1]); }, "duplicate ayah");
refuses("an own ayah that is gone", (s) => { s.ayahs.splice(indexOf(s, "93:11"), 1); return at(["ayahs"]); }, "ayah count does not match metadata");
for (const key of ["93:99", "93:0", "x", "115:1", "93:287", "093:1"]) {
  refuses(`a record about the ayah "${key}"`, (s) => { s.records[firstRecord(s)].ayah_keys = [key]; return at(["records", firstRecord(s)]); },
    key === "93:99" ? "record ayah beyond this surah" : "invalid record ayah key");
}
refuses("a record whose ayah key is not text", (s) => { s.records[firstRecord(s)].ayah_keys = [93]; return at(["records", firstRecord(s), "ayah_keys"]); }, "expected a string");
test("a record may be about an ayah of another surah, whether or not the file carries that ayah", () => {
  const surah = fresh();
  surah.records[firstRecord(surah)].ayah_keys = [otherSurahAyah(surah), "114:6"];
  assert.doesNotThrow(() => validate(surah));
});

// --- A name that is not in the dictionary, a quote that is too long, a link that is not a link --------------------------------------------

const evidenceOf = (surah: Json): Json => surah.records[firstRecord(surah)].evidence[0];
const evidencePath = (surah: Json): Path => ["records", firstRecord(surah), "evidence", 0];
refuses("a record with no icon", (s) => { s.records[firstRecord(s)].icons = []; return at(["records", firstRecord(s), "icons"]); }, "expected at least one icon");
refuses("a record with an icon that is not in the dictionary", (s) => { s.records[firstRecord(s)].icons = ["scholar", "star"]; return at(["records", firstRecord(s), "icons"]); }, "unknown dictionary key");
refuses("a record with a badge that is not in the dictionary", (s) => { s.records[firstRecord(s)].badge = "mashhur"; return at(["records", firstRecord(s), "badge"]); }, "unknown dictionary key");
refuses("an evidence with an icon that is not in the dictionary", (s) => { evidenceOf(s).icon = "star"; return at([...evidencePath(s), "icon"]); }, "unknown dictionary key");
refuses("an evidence with a link strength that is not in the dictionary", (s) => { evidenceOf(s).link_strength = "certain"; return at([...evidencePath(s), "link_strength"]); }, "unknown dictionary key");
refuses("a term record with a blank term name", (s) => { const id = segment(s, "term").segment.record; s.records[id].term = "  "; return at(["records", id, "term"]); }, "expected a nonempty term name");
refuses("a record whose science is not text", (s) => { s.records[firstRecord(s)].science = 5; return at(["records", firstRecord(s), "science"]); }, "expected a string");
test("validateSurah accepts a record whose science is null, absent or a name, and whose badge is null", () => {
  const surah = fresh();
  const record = surah.records[firstRecord(surah)];
  for (const science of [null, "balagha", undefined]) {
    if (science === undefined) delete record.science; else record.science = science;
    record.badge = null;
    assert.doesNotThrow(() => validate(surah));
  }
});
refuses("a quote of 201 characters", (s) => { evidenceOf(s).quote = "x".repeat(201); return at([...evidencePath(s), "quote"]); }, "quote exceeds 200 characters");
test("a quote may have 200 characters, counted as characters and not as UTF-16 units", () => {
  const surah = fresh();
  evidenceOf(surah).quote = "\u{1F600}".repeat(200);
  assert.doesNotThrow(() => validate(surah));
  evidenceOf(surah).quote = "\u{1F600}".repeat(201);
  assert.throws(() => validate(surah), { message: `Invalid surah at ${at([...evidencePath(surah), "quote"])}: quote exceeds 200 characters` });
});
for (const [url, message] of [["not a url", "expected an absolute URL"], ["/relative/path", "expected an absolute URL"], ["", "expected an absolute URL"],
  ["ftp://example.test/book", "expected an HTTP(S) source URL"], ["javascript:void(0)", "expected an HTTP(S) source URL"], ["data:text/html,x", "expected an HTTP(S) source URL"],
  [7, "expected a string"], [undefined, "expected a string"]] as const) {
  refuses(`a source link of ${JSON.stringify(url) ?? "undefined"}`, (s) => { if (url === undefined) delete evidenceOf(s).url; else evidenceOf(s).url = url; return at([...evidencePath(s), "url"]); }, message);
}
test("a source link may be null, http or https", () => {
  const surah = fresh();
  for (const url of [null, "http://example.test/book", "https://example.test/book#page=2"]) {
    evidenceOf(surah).url = url;
    assert.doesNotThrow(() => validate(surah), String(url));
  }
});
refuses("a ruling that is not an object", (s) => { evidenceOf(s).rulings = ["x"]; return at([...evidencePath(s), "rulings", 0]); }, "expected an object");
refuses("evidence that is not an object", (s) => { s.records[firstRecord(s)].evidence = [null]; return at([...evidencePath(s)]); }, "expected an object");

// --- Stops, passages, and the titles of both -------------------------------------------------------------------------------------------

refuses("a stop with no ayahs list", (s) => { const path = block(s, 1, isStop); delete walk(s, path).ayahs; return at([...path, "ayahs"]); }, "expected an array");
refuses("a stop with an empty ayahs list", (s) => { const path = block(s, 1, isStop); walk(s, path).ayahs = []; return at(path); }, "stop must have at least one ayah");
refuses("a stop that hangs from an ayah of another surah", (s) => { const path = block(s, 1, isStop); walk(s, path).ayahs = [otherSurahAyah(s)]; return at(path); }, "stop ayahs must belong to this surah");
refuses("a stop with no passage, in a surah that has passages", (s) => { const path = block(s, 1, isStop); delete walk(s, path).passage; return at(path); }, "stop must identify its passage");
refuses("a stop of a passage that does not exist", (s) => { const path = block(s, 1, isStop); walk(s, path).passage = "p9"; return at(path); }, "unknown passage");
refuses("an untitled paragraph of a passage that does not exist", (s) => { const path = block(s, 1, isPlain); walk(s, path).passage = "p9"; return at(path); }, "unknown passage");
refuses("a stop whose ayahs lie outside its passage", (s) => {
  const path = block(s, 1, isStop);
  const stop = walk(s, path);
  stop.passage = s.passages.find((passage: Json) => passage.id !== stop.passage).id;
  return at(path);
}, "stop ayahs outside its passage");
refuses("a details item whose title is text and not segments", (s) => { const path = block(s, 3, isDetails); walk(s, path).title = "x"; return at([...path, "title"]); }, "expected an array");
refuses("passages that are not a list", (s) => { s.passages = {}; return at(["passages"]); }, "expected an array");
refuses("passages that are null", (s) => { s.passages = null; return at(["passages"]); }, "expected an array");
refuses("a last passage that is gone, so the surah is not covered", (s) => { s.passages.pop(); return at(["passages"]); }, "passages must cover the whole surah");
refuses("a first passage that does not start at the first ayah", (s) => { s.passages[0].from = "93:2"; return at(["passages", 0]); }, "passages must be consecutive in order without gaps or overlaps");
refuses("a passage that ends before it starts", (s) => { s.passages[1].to = "93:5"; return at(["passages", 1]); }, "passages must be consecutive in order without gaps or overlaps");
refuses("two passages that overlap", (s) => { s.passages[1].from = "93:5"; return at(["passages", 1]); }, "passages must be consecutive in order without gaps or overlaps");
refuses("a passage that starts at an ayah of another surah", (s) => { s.passages[0].from = otherSurahAyah(s); return at(["passages", 0]); }, "passage endpoints must belong to this surah");
refuses("a passage with no records", (s) => { s.passages[0].records = []; return at(["passages", 0]); }, "passage must have records");
refuses("two passages with one id", (s) => { s.passages[1].id = s.passages[0].id; return at(["passages", 1]); }, "empty or duplicate passage id");
refuses("a passage whose id is blank", (s) => { s.passages[1].id = "  "; return at(["passages", 1]); }, "empty or duplicate passage id");
test("a surah with no passages is one passage, and its stops need no passage", () => {
  const surah = fresh(108);
  assert.ok(!Object.hasOwn(surah, "passages"));
  assert.ok(surah.levels[1].blocks.some(isStop) && surah.levels[1].blocks.filter(isStop).every((item: Json) => !Object.hasOwn(item, "passage")));
  assert.doesNotThrow(() => validate(surah));
});
refuses("a stop title of nine words", (s) => { const path = block(s, 1, isStop); walk(s, path).title = "a b c d e f g h i"; return at([...path, "title"]); },
  "expected nonempty system title; stop titles have at most 8 words");
test("a stop title may have eight words, and a passage title is not limited", () => {
  const surah = fresh();
  walk(surah, block(surah, 1, isStop)).title = "a b c d e f g h";
  surah.passages[0].title = "a b c d e f g h i j k l";
  assert.doesNotThrow(() => validate(surah));
});
refuses("a stop with a blank title", (s) => { const path = block(s, 1, isStop); walk(s, path).title = " "; return at([...path, "title"]); }, "expected nonempty system title; stop titles have at most 8 words");
refuses("a stop with a title that is not text", (s) => { const path = block(s, 1, isStop); walk(s, path).title = 7; return at([...path, "title"]); }, "expected a string");
refuses("a stop title with four words of the surah's own ayah", (s) => { const path = block(s, 1, isStop); walk(s, path).title = quranWords(s); return at([...path, "title"]); }, "Quran text in system title");
refuses("a stop title with the same four words written without their marks", (s) => {
  const path = block(s, 1, isStop);
  walk(s, path).title = quranWords(s).replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "");
  return at([...path, "title"]);
}, "Quran text in system title");
refuses("a stop title with Quran brackets", (s) => { const path = block(s, 1, isStop); walk(s, path).title = "x \ufd3f y"; return at([...path, "title"]); }, "Quran brackets in system title");
refuses("a stop title with the closing Quran bracket", (s) => { const path = block(s, 1, isStop); walk(s, path).title = "x \ufd3e y"; return at([...path, "title"]); }, "Quran brackets in system title");
refuses("a passage title with four words of the surah's own ayah", (s) => { s.passages[0].title = quranWords(s); return at(["passages", 0, "title"]); }, "Quran text in system title");
refuses("a passage with a blank title", (s) => { s.passages[0].title = "  "; return at(["passages", 0, "title"]); }, "expected nonempty system title; stop titles have at most 8 words");

// --- Paragraphs, summaries, examples, details and segments ---------------------------------------------------------------------------------

refuses("a block of an unknown type", (s) => { s.levels[1].blocks.splice(1, 0, { type: "table" }); return at(["levels", 1, "blocks", 1]); }, "unknown block type");
refuses("a heading of an unknown kind", (s) => { const path = block(s, 3, (b) => b.type === "heading"); walk(s, path).kind = "note"; return at(path); }, "unknown heading kind");
refuses("a question that is not followed by its answer", (s) => { const path = block(s, 3, (b) => b.type === "heading" && b.kind === "question"); s.levels[3].blocks.splice(path[3] as number + 1, 1); return at(path); },
  "question must be followed by its answer paragraph");
refuses("a question that is the last block of its level", (s) => {
  const path = block(s, 3, (b) => b.type === "heading" && b.kind === "question");
  s.levels[3].blocks.push(s.levels[3].blocks.splice(path[3] as number, 1)[0]);
  return at(["levels", 3, "blocks", s.levels[3].blocks.length - 1]);
}, "question must be followed by its answer paragraph");
refuses("a paragraph of an unknown role", (s) => { const path = block(s, 1, isPlain); walk(s, path).role = "note"; return at(path); }, "unknown paragraph role");
refuses("a paragraph of an unknown kind", (s) => { const path = block(s, 1, isPlain); walk(s, path).kind = "aside"; return at(path); }, "unknown paragraph kind");
refuses("a paragraph with no segments", (s) => { const path = block(s, 1, isPlain); walk(s, path).segments = []; return at([...path, "segments"]); }, "expected nonempty segments");
refuses("a paragraph with no marker", (s) => {
  const path = block(s, 1, isPlain);
  const item = walk(s, path);
  item.segments = item.segments.filter((part: Json) => part.t === "text");
  return at([...path, "segments"]);
}, "expected at least one marker");
refuses("a term with blank text", (s) => { const found = segment(s, "term"); found.segment.v = "  "; return at(found.path); }, "expected nonempty term text");
refuses("a summary that is not the last block of its level", (s) => { const path = block(s, 0, isSummary); s.levels[0].blocks.push({ type: "heading", text: "x" }); return at(path); }, "a summary is the last block of its level");
refuses("a summary that is a transmission", (s) => { const path = block(s, 0, isSummary); walk(s, path).role = "transmission"; return at(path); }, "a summary is a claim");
refuses("a summary with a title", (s) => { const path = block(s, 0, isSummary); walk(s, path).title = "x"; return at(path); }, "a summary has no title and no ayahs");
refuses("a summary with ayahs", (s) => { const path = block(s, 0, isSummary); walk(s, path).ayahs = ["93:1"]; return at(path); }, "a summary has no title and no ayahs");
refuses("a summary inside a details item", (s) => {
  const copy = structuredClone(walk(s, block(s, 0, isSummary)));
  const path = block(s, 3, isDetails);
  walk(s, path).blocks.push(copy);
  return at([...path, "blocks", walk(s, path).blocks.length - 1]);
}, "a summary never sits inside details");
refuses("an example inside a details item", (s) => {
  const copy = structuredClone(walk(s, block(s, 1, isExample)));
  const path = block(s, 3, isDetails);
  walk(s, path).blocks.push(copy);
  return at([...path, "blocks", walk(s, path).blocks.length - 1]);
}, "an example never sits inside details");
refuses("an example with a title", (s) => { const path = block(s, 1, isExample); walk(s, path).title = "x"; return at(path); }, "an example has no title and no ayahs");
refuses("an example with ayahs", (s) => { const path = block(s, 1, isExample); walk(s, path).ayahs = ["93:1"]; return at(path); }, "an example has no title and no ayahs");
refuses("an example that holds a marker", (s) => {
  const path = block(s, 1, isExample);
  walk(s, path).segments.push({ t: "mark", records: [firstRecord(s)] });
  return at([...path, "segments", walk(s, path).segments.length - 1]);
}, "an example holds text segments only");
refuses("an example with no segments", (s) => { const path = block(s, 1, isExample); walk(s, path).segments = []; return at([...path, "segments"]); }, "expected nonempty segments");
refuses("a details item inside a details item", (s) => {
  const path = block(s, 3, isDetails);
  const nested = structuredClone(walk(s, path));
  walk(s, path).blocks.push(nested);
  return at([...path, "blocks", walk(s, path).blocks.length - 1]);
}, "expected a paragraph; details cannot nest");
refuses("a details title that does not end with a marker", (s) => { const path = block(s, 3, isDetails); walk(s, path).title.push({ t: "text", v: "x" }); return at([...path, "title"]); }, "title must end with a marker");
refuses("a details title with no marker", (s) => { const path = block(s, 3, isDetails); walk(s, path).title = [{ t: "text", v: "x" }]; return at([...path, "title"]); }, "expected at least one marker");
refuses("a details title with no segments", (s) => { const path = block(s, 3, isDetails); walk(s, path).title = []; return at([...path, "title"]); }, "expected nonempty segments");
refuses("a details title with an ayah segment", (s) => { const path = block(s, 3, isDetails); walk(s, path).title.unshift({ t: "ayah", key: "93:1" }); return at([...path, "title", 0]); }, "invalid title segment");
refuses("a details title with a quote segment", (s) => {
  const path = block(s, 3, isDetails);
  walk(s, path).title.unshift({ t: "quote", v: "x", record: firstRecord(s) });
  return at([...path, "title", 0]);
}, "invalid title segment");

// --- What the app reads: the index, one surah, the dictionary ------------------------------------------------------------------------------
// These read app/src/content/, which `pnpm sync-content` copies from content/ (the same bytes as the files above).

test("getIndex lists only the published surahs, in the published order, and agrees with their files", async () => {
  const index = await content.getIndex();
  assert.deepEqual(index.surahs.map((item: { no: number }) => item.no), [...publishedSurahs]);
  for (const item of index.surahs) assert.deepEqual(item, files.get(item.no).surah, `the index entry of surah ${item.no} differs from its file`);
  const all = await read("export/index.json");
  assert.ok(all.surahs.length > index.surahs.length, "the full index holds more surahs than are published, and none of them leaks into the app");
});
test("getSurah returns the validated surah that was asked for", async () => {
  for (const no of published) {
    const surah = await content.getSurah(no);
    assert.equal(surah.surah.no, no);
    assert.deepEqual(surah, files.get(no), `surah ${no} read through the app differs from its export file`);
  }
});
test("getSurah refuses a number that is not a surah number, and says how to fix a file that is missing", async () => {
  for (const bad of [0, 115, 1.5, -1, "93", null, undefined]) {
    await assert.rejects(content.getSurah(bad as never), { message: "Invalid surah at requested surah: expected integer 1..114" }, String(bad));
  }
  // Surah 1 is not one of the exported files.
  await assert.rejects(content.getSurah(1), { message: "Cannot load surah-1.json. Run pnpm sync-content first." });
});
test("getUi is the dictionary without the clerk strings, which only the server reads", async () => {
  const raw = await read("ui.ar.json");
  const { clerk, ...rest } = raw;
  const ui = await content.getUi();
  assert.ok(!Object.hasOwn(ui, "clerk"));
  assert.deepEqual(ui, rest);
  assert.deepEqual(await content.getClerkStrings(), clerk ?? {});
});

/** A second copy of content.ts that reads the given files instead of app/src/content/: the directory is fixed when the module loads, from the working directory.
 * A string is written as it is, anything else as JSON. */
async function contentReading(given: Record<string, unknown>) {
  const root = await mkdtemp(path.join(tmpdir(), "huda-content-"));
  await mkdir(path.join(root, "src/content"), { recursive: true });
  for (const [name, value] of Object.entries(given)) await writeFile(path.join(root, "src/content", name), typeof value === "string" ? value : JSON.stringify(value));
  const here = process.cwd();
  process.chdir(root);
  try { return { read: await import(`./content.ts?${path.basename(root)}`) as typeof content, remove: () => rm(root, { recursive: true, force: true }) }; }
  finally { process.chdir(here); }
}
test("getIndex refuses an index that lists a surah twice or leaves out a published one", async () => {
  const index = await read("export/index.json");
  const twice = await contentReading({ "index.json": { surahs: [...index.surahs, index.surahs[0]] } });
  const lacking = await contentReading({ "index.json": { surahs: index.surahs.filter((item: { no: number }) => item.no !== 108) } });
  try {
    await assert.rejects(twice.read.getIndex(), { message: "Invalid surah at index.surahs: duplicate surah number" });
    await assert.rejects(lacking.read.getIndex(), { message: "Published surah 108 is missing from the content index" });
  } finally { await Promise.all([twice.remove(), lacking.remove()]); }
});
test("getSurah serves a file only when it is valid and is the surah its name says", async () => {
  const swapped = await contentReading({ "surah-93.json": files.get(108), "surah-108.json": files.get(108) });
  const broken = await contentReading({ "surah-93.json": { ...files.get(93), levels: [] }, "surah-108.json": "{ not json" });
  try {
    assert.equal((await swapped.read.getSurah(108)).surah.no, 108);
    await assert.rejects(swapped.read.getSurah(93), { message: "Invalid surah at surah-93: file number and metadata differ" });
    await assert.rejects(broken.read.getSurah(93), { message: "Invalid surah at surah-93.levels: expected four complete levels" });
    await assert.rejects(broken.read.getSurah(108), { message: "Cannot load surah-108.json. Run pnpm sync-content first." });
  } finally { await Promise.all([swapped.remove(), broken.remove()]); }
});
