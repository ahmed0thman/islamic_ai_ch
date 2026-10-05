import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { addAsked, askedAt, askedStorageKey, maxAsked, parseAsked, removeAsked, resolveAsked, serializeAsked } from "./asked.ts";
import type { AskedQuestion } from "./asked";

const entry = (over: Partial<Omit<AskedQuestion, "id">> = {}): Omit<AskedQuestion, "id"> => ({ question: "ما معنى الضحى؟", atomIds: ["93:1:blocks.0:0"], depth: 1, stop: 2, at: 1000, ...over });

test("the key is per surah", () => assert.equal(askedStorageKey(93), "huda:asked:v1:93"));
test("unreadable storage gives an empty list", () => {
  for (const raw of [null, "", "{", "{}", "[1]", JSON.stringify([{ id: "a", question: "", atomIds: ["x"], depth: 1, stop: null, at: 1 }]), JSON.stringify([{ id: "a", question: "q", atomIds: [], depth: 1, stop: null, at: 1 }]), JSON.stringify([{ id: "a", question: "q", atomIds: ["x"], depth: 4, stop: null, at: 1 }])])
    assert.deepEqual(parseAsked(raw), [], String(raw));
});
test("adding, serializing and parsing round-trips, newest first", () => {
  let list: AskedQuestion[] = [];
  list = addAsked(list, entry({ question: "الأول", at: 1 }));
  list = addAsked(list, entry({ question: "الثاني", at: 2, stop: null }));
  assert.deepEqual(list.map((item) => item.question), ["الثاني", "الأول"]);
  assert.deepEqual(parseAsked(serializeAsked(list)), list);
});
test("the same question at the same place replaces the older one; at another place it stays", () => {
  let list = addAsked([], entry({ at: 1 }));
  list = addAsked(list, entry({ at: 2 }));
  assert.equal(list.length, 1);
  assert.equal(list[0].at, 2);
  list = addAsked(list, entry({ at: 3, stop: 5 }));
  list = addAsked(list, entry({ at: 4, depth: 2 }));
  assert.equal(list.length, 3);
});
test("ids stay unique when two questions share a millisecond", () => {
  let list = addAsked([], entry({ question: "أ", at: 7 }));
  list = addAsked(list, entry({ question: "ب", at: 7 }));
  assert.equal(new Set(list.map((item) => item.id)).size, 2);
});
test("fifty at most, the oldest dropped", () => {
  let list: AskedQuestion[] = [];
  for (let index = 1; index <= maxAsked + 5; index++) list = addAsked(list, entry({ question: `q${index}`, at: index }));
  assert.equal(list.length, maxAsked);
  assert.equal(list[0].question, `q${maxAsked + 5}`);
  assert.equal(list.at(-1)!.question, "q6");
  assert.equal(parseAsked(serializeAsked(list)).length, maxAsked);
});
test("removing drops one entry by id", () => {
  const list = addAsked(addAsked([], entry({ question: "أ", at: 1 })), entry({ question: "ب", at: 2 }));
  assert.deepEqual(removeAsked(list, list[0].id).map((item) => item.question), ["أ"]);
  assert.equal(removeAsked(list, "none").length, 2);
});
test("a question whose sentence id is gone drops silently; the rest keep their order", () => {
  const atoms = new Map([["a", { id: "a" }], ["b", { id: "b" }]]);
  const list = addAsked(addAsked([], entry({ question: "قائم", atomIds: ["b", "a"], at: 1 })), entry({ question: "ساقط", atomIds: ["a", "gone"], at: 2 }));
  const resolved = resolveAsked(list, atoms);
  assert.deepEqual(resolved.map(({ item }) => item.question), ["قائم"]);
  assert.deepEqual(resolved[0].atoms.map((atom) => atom.id), ["b", "a"]);
});
test("a question is shown where it was asked: its stop at its depth, or the closing screen of its depth when no stop was open", () => {
  const list = [entry({ question: "أ", stop: 2, at: 1 }), entry({ question: "ب", stop: null, at: 2 }), entry({ question: "ج", stop: 2, depth: 2, at: 3 })]
    .reduce<AskedQuestion[]>((all, next) => addAsked(all, next), []).map((item) => ({ item }));
  assert.deepEqual(askedAt(list, 1, 2).map(({ item }) => item.question), ["أ"]);
  assert.deepEqual(askedAt(list, 1, null).map(({ item }) => item.question), ["ب"]);
  assert.deepEqual(askedAt(list, 2, 2).map(({ item }) => item.question), ["ج"]);
  assert.deepEqual(askedAt(list, 3, null), []);
});
