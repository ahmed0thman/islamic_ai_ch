import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { answer } from "./answer.ts";
// @ts-expect-error -- Node requires source extensions.
import { deriveAtoms } from "./atoms.ts";
// @ts-expect-error -- Node requires source extensions.
import { gatherAtoms, sourcesEnabled } from "./gather.ts";
// @ts-expect-error -- Node requires source extensions.
import { sourceAtoms } from "./source-atoms.ts";
// @ts-expect-error -- Node requires source extensions.
import { REPORT_MARKERS, CHAIN_MARKERS, guardTokens, hasMarker } from "./source-guard.ts";
// @ts-expect-error -- Node requires source extensions.
import { verifyEach, containsQuran } from "./verify.ts";
// @ts-expect-error -- Node requires source extensions.
import { compose, examplesBlock, REPAIR_PROBLEMS, COMPOSE_SYSTEM_PROMPT } from "./compose.ts";
import type { Surah } from "../types";
import type { Atom, ChoiceProvider, SelectionRequest } from "./types";

const load = async (no: number): Promise<Surah> => JSON.parse(await readFile(new URL(`../../../../content/export/surah-${no}.json`, import.meta.url), "utf8"));
const surah108 = await load(108);
const surah93 = await load(93);
const fixtures = JSON.parse(await readFile(new URL("./eval-fixtures.json", import.meta.url), "utf8")) as { question: string; depth: 0 | 1 | 2 | 3 }[];
const single = new RegExp("^[^.!" + String.fromCodePoint(0x61f, 0x61b) + String.fromCharCode(10) + "]+" + String.fromCharCode(92) + ".$", "u");
const quotes = [...new Set(Object.values(surah108.records).flatMap((record) => record.evidence.map((evidence) => evidence.quote.trim())))]
  .filter((quote) => single.test(quote) && quote.split(/\s+/u).length >= 4 && !hasMarker(guardTokens(quote), REPORT_MARKERS) && !hasMarker(guardTokens(quote), CHAIN_MARKERS));
const passage = (text: string) => ({ id: "9", source_id: "tafsir_test", source_title: "title", author: "author", locator: "1", url: "https://example.test/x", text, ayah_keys: ["108:1"], score: 1 });
const verified = deriveAtoms(surah108) as Atom[];
const quiet = { log: () => {}, mode: "composed" as const, support: true };

/** A written sentence that the mechanical checks accept when it cites the given atom: the first clean unit whose own words are carried. */
const carried = (sources: Atom[]) => {
  for (const unit of sources) {
    const verdict = verifyEach({ status: "answer", sentences: [{ kind: "claim", text: unit.text, cites: [unit.id] }] }, [...verified.slice(0, 1), ...sources]);
    if (verdict.ok && verdict.reasons[0] === undefined && !containsQuran(unit.text)) return unit;
  }
  throw new Error("no carried unit in the fixtures");
};
const sources = sourceAtoms([passage(quotes.join(" "))], "q", 1, 108).atoms as Atom[];
const atoms: Atom[] = [verified[0], ...sources];
const mock = (compose: (request: SelectionRequest) => unknown, onRequest?: (request: SelectionRequest) => void): ChoiceProvider => ({
  async choose(request) {
    onRequest?.(request);
    if (request.stage === "support") return { verdicts: (JSON.parse(request.message).items as unknown[]).map((_, index) => ({ index, supported: true })) };
    return compose(request);
  },
});

test("(a) a sentence carried by a source atom passes and comes back with the atom's source", async () => {
  const unit = carried(sources);
  const result = await answer("q", atoms, undefined, mock(() => ({ status: "answer", sentences: [{ kind: "claim", text: unit.text, cites: [unit.id] }] })), quiet);
  assert.equal(result.status, "answer");
  assert.deepEqual(result.composed, [{ text: unit.text, atom_ids: [unit.id] }]);
  assert.equal(result.atoms.length, 1);
  assert.equal(result.atoms[0].role, "source");
  assert.equal(result.atoms[0].surah, 108);
  assert.equal(result.atoms[0].source?.title, "title");
  assert.ok(!Object.hasOwn(result.atoms[0], "text"));
});

test("(b) a sentence citing a source atom with a report marker is rejected as report and goes to repair", async () => {
  const unit = carried(sources);
  const marker = REPORT_MARKERS.map((item: string[]) => item.join(" ")).find((item: string) => {
    const each = verifyEach({ status: "answer", sentences: [{ kind: "claim", text: `${item} ${unit.text}`, cites: [unit.id] }] }, atoms);
    return each.ok && each.reasons[0] === "report";
  });
  assert.ok(marker, "some marker reaches the report check");
  const bad = { status: "answer", sentences: [{ kind: "claim", text: `${marker} ${unit.text}`, cites: [unit.id] }] };
  const good = { status: "answer", sentences: [{ kind: "claim", text: unit.text, cites: [unit.id] }] };
  let calls = 0;
  const lines: string[] = [];
  const result = await answer("q", atoms, undefined, mock(() => (calls++ === 0 ? bad : good)), { ...quiet, log: (line) => lines.push(line) });
  assert.equal(calls, 2, "compose, then one repair");
  assert.equal(result.status, "answer");
  assert.equal(result.composed?.[0].text, unit.text);
  const stages = JSON.parse(lines[0]).stages as { stage: string; outcome: string }[];
  assert.ok(stages.some((stage) => stage.stage === "verify" && stage.outcome === "report"));
  assert.ok(stages.some((stage) => stage.stage === "repair" && stage.outcome === "fixed"));
  assert.deepEqual(JSON.parse(lines[0]).cited, { verified: 0, source: 1, both: 0 });
  assert.ok(REPAIR_PROBLEMS.report.length > 0);
  // The same sentence citing only a verified sentence is not a report problem.
  const verifiedOnly = verifyEach({ status: "answer", sentences: [{ kind: "claim", text: `${marker} ${unit.text}`, cites: [verified[0].id] }] }, atoms);
  assert.ok(!verifiedOnly.ok || verifiedOnly.reasons[0] !== "report");
});

test("(c) without DATABASE_URL the five fixtures give exactly today's atoms and today's answer", async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.equal(fixtures.length, 5);
    const today = deriveAtoms(surah93) as Atom[];
    const provider = (value: unknown) => mock(() => value);
    for (const fixture of fixtures) {
      const gathered = await gatherAtoms({ question: fixture.question, surah: 93, depth: fixture.depth }, load);
      assert.deepEqual(gathered.atoms, today);
      assert.equal(gathered.sources, false);
      assert.equal(gathered.event.provider, "fallback");
      assert.deepEqual(gathered.examples, []);
      const value = { status: "answer", sentences: [{ kind: "claim", text: today[0].text, cites: [today[0].id] }] };
      assert.deepEqual(await answer(fixture.question, gathered.atoms, undefined, provider(value), quiet), await answer(fixture.question, today, undefined, provider(value), quiet));
    }
  } finally { if (saved !== undefined) process.env.DATABASE_URL = saved; }
});

test("(d) HUDA_ASK_SOURCES=0 turns book weaving off; it is on only with a database", async () => {
  assert.equal(sourcesEnabled({ DATABASE_URL: "postgresql://x/y", HUDA_ASK_SOURCES: "0" }), false);
  assert.equal(sourcesEnabled({ DATABASE_URL: "postgresql://x/y" }), true);
  assert.equal(sourcesEnabled({}), false);
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://127.0.0.1:1/none";
  try {
    const gathered = await gatherAtoms({ question: fixtures[0].question, surah: 93, depth: 1 }, load, { DATABASE_URL: "postgresql://127.0.0.1:1/none", HUDA_ASK_SOURCES: "0" });
    assert.ok(gathered.atoms.every((atom) => atom.role !== "source"));
    assert.equal(gathered.sources, false);
    assert.equal(gathered.event.outcome.split("/")[2], "0");
  } finally { if (saved === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved; }
});

test("(e) the numbers check accepts the surah number of a cited verified sentence, and still rejects another number", () => {
  const other: Atom = { id: "112:1:blocks.0:0", level: 1, role: "claim", records: [], segments: [], text: "alpha beta gamma delta epsilon" };
  const check = (text: string) => verifyEach({ status: "answer", sentences: [{ kind: "claim", text, cites: [other.id] }] }, [other], undefined, new Set<string>());
  const accepted = check("alpha beta 112 gamma");
  assert.ok(accepted.ok && accepted.reasons[0] === undefined);
  const refused = check("alpha beta 113 gamma");
  assert.ok(refused.ok && refused.reasons[0] === "numbers");
});

test("the writer's prompt carries the rules of the two kinds of material, and the examples only as a labelled block", () => {
  assert.ok(COMPOSE_SYSTEM_PROMPT.includes("ONLY the supplied numbered sentences"));
  assert.ok(COMPOSE_SYSTEM_PROMPT.includes("questions not about the Quran surahs whose material is supplied"));
  assert.ok(COMPOSE_SYSTEM_PROMPT.includes("Do not relay a hadith"));
  assert.ok(!COMPOSE_SYSTEM_PROMPT.includes("BEGIN_EXAMPLES_JSON"));
  const without = compose("q", atoms, undefined, [], []);
  assert.ok(!without.message.includes("EXAMPLES"));
  const withPairs = compose("q", atoms, undefined, [], [{ source_quote: "a", verified_sentence: "b" }]);
  assert.ok(withPairs.message.startsWith(without.message));
  assert.ok(withPairs.message.includes("imitate the relation"));
  assert.equal(examplesBlock([]), "");
  const numbered = JSON.parse(without.message.split("BEGIN_SENTENCES_JSON\n")[1].split("\nEND_SENTENCES_JSON")[0]) as { kind: string; surah: number; book?: string }[];
  assert.equal(numbered[0].kind, "verified");
  assert.equal(numbered[0].surah, 108);
  assert.ok(numbered.slice(1).every((item) => item.kind === "book" && item.book === "title" && item.surah === 108));
});
