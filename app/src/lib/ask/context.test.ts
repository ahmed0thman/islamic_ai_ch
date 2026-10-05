import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { deriveAtoms, resolveReaderContext, readerUnits } from "./atoms.ts";
// @ts-expect-error -- Node requires source extensions.
import { buildPrompt } from "./select.ts";
import type { Surah } from "../types";
const surah: Surah = JSON.parse(await readFile(new URL("../../../../content/export/surah-108.json", import.meta.url), "utf8"));

test("server context follows map and depth-3 reader numbering, title and ayahs", () => {
  for (const depth of [0, 1, 2, 3] as const) {
    for (const unit of readerUnits(surah, depth)) {
      const context = resolveReaderContext(surah, depth, unit.number)!;
      assert.equal(context.stop_title, unit.title);
      assert.deepEqual(context.stop_ayahs, unit.ayahKeys.map((key) => ({ key, text: surah.ayahs.find((ayah) => ayah.key === key)!.text })));
      assert.ok(deriveAtoms(surah).some((atom) => atom.locations!.some((location) => location.depth === depth && location.stops.includes(unit.number))));
    }
  }
});

test("invalid optional context is ignored and does not create a context block", () => {
  for (const depth of [undefined, null, "1", -1, 4, 0.5]) assert.equal(resolveReaderContext(surah, depth, 1), undefined);
  for (const stop of [undefined, null, "1", -1, 0, 999, 1.5]) {
    const context = resolveReaderContext(surah, 1, stop);
    assert.deepEqual(context, { depth: 1 });
    assert.ok(!buildPrompt("question", deriveAtoms(surah), 100_000, context).message.includes("BEGIN_READER_CONTEXT_JSON"));
  }
});

test("context ordering is open scene, depth, other depths; budget preserves open scene", () => {
  const atoms = deriveAtoms(surah);
  const context = resolveReaderContext(surah, 2, 1)!;
  const priority = (atom: typeof atoms[number]) => atom.locations!.some((location) => location.depth === 2 && location.stops.includes(1)) ? 0
    : atom.locations!.some((location) => location.depth === 2) ? 1 : 2;
  const prompt = buildPrompt("question", atoms, 100_000, context);
  assert.deepEqual(prompt.atoms, [...atoms].sort((a, b) => priority(a) - priority(b)));
  const encoded = prompt.message.split("BEGIN_READER_CONTEXT_JSON\n")[1].split("\nEND_READER_CONTEXT_JSON")[0];
  assert.deepEqual(JSON.parse(encoded), { depth: 2, stop_title: context.stop_title, stop_ayahs: context.stop_ayahs });
  const cut = buildPrompt(atoms.at(-1)!.text, atoms, 1, context);
  assert.deepEqual(cut.atoms, atoms.filter((atom) => priority(atom) === 0));
});

test("summaries have no stop, examples remain excluded, duplicate memberships keep IDs", () => {
  const copy = structuredClone(surah);
  const paragraph = copy.levels[0].blocks.find((block) => block.type === "paragraph" && block.role === "claim")!;
  assert.equal(paragraph.type, "paragraph");
  if (paragraph.type !== "paragraph") return;
  copy.levels = [0, 1].map((depth) => ({ depth: depth as 0 | 1, blocks: [paragraph, { type: "paragraph", role: "claim", kind: "summary", segments: [{ t: "text", v: "summary sentence" }, { t: "mark", records: paragraph.segments.flatMap((segment) => segment.t === "mark" ? segment.records : []) }] }] }));
  const atoms = deriveAtoms(copy);
  const summary = atoms.find((atom) => atom.text === "summary sentence")!;
  assert.ok(summary.locations!.every((location) => !location.stops.length));
  assert.ok(atoms.every((atom) => atom.level === 0));
  assert.ok(atoms.every((atom) => atom.locations!.some((location) => location.depth === 1)));
});
