import quran from "../../content/quran-plain.json" with { type: "json" };
// @ts-expect-error -- Node requires source extensions.
import { normalize } from "./normalize.ts";
import type { Atom, Composition, ReaderContext } from "./types";

export type VerifyReason = "shape" | "quran_text" | "quotation" | "grading" | "numbers" | "names";
export type Verification = { ok: true; value: Composition } | { ok: false; reason: VerifyReason };
export const GRADING_WORDS = ["\u0635\u062d\u064a\u062d", "\u062d\u0633\u0646", "\u0636\u0639\u064a\u0641", "\u0645\u0648\u0636\u0648\u0639", "\u0645\u0646\u0643\u0631", "\u0645\u062a\u0648\u0627\u062a\u0631", "\u062b\u0627\u0628\u062a", "\u0644\u0627 \u064a\u062b\u0628\u062a", "\u0644\u0645 \u064a\u062b\u0628\u062a", "\u0644\u064a\u0633 \u0628\u062b\u0627\u0628\u062a"] as const;
export const ATTRIBUTION_WORDS = ["\u0642\u0627\u0644", "\u064a\u0642\u0648\u0644", "\u0630\u0643\u0631", "\u064a\u0631\u0649", "\u0639\u0646\u062f", "\u0639\u0646", "\u062d\u0633\u0628", "\u0648\u0641\u0642\u0627 \u0644\u0640", "\u0648\u0641\u0642\u0627 \u0644"] as const;
const words = (text: string): string[] => normalize(text).match(/[\p{L}\p{N}]+/gu) || [];
export function buildQuranTrigrams(ayahs: readonly string[]): Set<string> {
  const grams = new Set<string>();
  for (const ayah of ayahs) {
    const tokens = words(ayah);
    for (let i = 0; i + 2 < tokens.length; i++) grams.add(tokens.slice(i, i + 3).join(" "));
  }
  return grams;
}
let cachedGrams: Set<string> | undefined;
export function quranTrigrams(): ReadonlySet<string> {
  return cachedGrams ||= buildQuranTrigrams(quran);
}
export function containsQuran(text: string, grams: ReadonlySet<string> = quranTrigrams()): boolean {
  if (/[\ufd3e\ufd3f]/u.test(text)) return true;
  const tokens = words(text);
  return tokens.some((_, i) => i + 2 < tokens.length && grams.has(tokens.slice(i, i + 3).join(" ")));
}
function digitRuns(text: string): string[] {
  return (text.match(/[0-9\u0660-\u0669\u06f0-\u06f9]+/gu) || []).map((run) => run.replace(/[\u0660-\u0669\u06f0-\u06f9]/gu,
    (digit) => String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660))));
}
const keysExactly = (record: object, keys: string[]) => Object.keys(record).length === keys.length && keys.every((key) => Object.hasOwn(record, key));
/** Parsing is independent of the model schema: fail closed on any unknown field. */
export function parseComposition(value: unknown, atoms: Atom[]): Composition | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || !keysExactly(value, ["status", "sentences"])) return;
  const record = value as Record<string, unknown>;
  if (!["answer", "insufficient", "fatwa", "out_of_scope", "not_arabic"].includes(record.status as string) || !Array.isArray(record.sentences)) return;
  if (record.status !== "answer") return record.sentences.length === 0 ? value as Composition : undefined;
  if (record.sentences.length < 1 || record.sentences.length > 5) return;
  const byId = new Map(atoms.map((atom) => [atom.id, atom]));
  for (const item of record.sentences) {
    if (!item || typeof item !== "object" || Array.isArray(item) || !keysExactly(item, ["text", "cites"])
      || typeof item.text !== "string" || !item.text.trim() || [...item.text].length > 220
      || !Array.isArray(item.cites) || item.cites.length < 1 || item.cites.length > 3
      || item.cites.some((id: unknown) => typeof id !== "string" || !byId.has(id)) || new Set(item.cites).size !== item.cites.length
      || !item.cites.some((id: string) => byId.get(id)?.role === "claim")) return;
  }
  return value as Composition;
}

/** Attribution is deliberately conservative, not entity recognition. It checks the
 * entire run after a trigger up to punctuation against cited content words. A
 * matching predicate can pass an unknown name; the semantic support check must
 * still preserve the exact scholar name. False rejections use extractive fallback.
 */
export function verify(value: unknown, atoms: Atom[], context?: ReaderContext, grams: ReadonlySet<string> = quranTrigrams()): Verification {
  const composition = parseComposition(value, atoms);
  const reject = (reason: VerifyReason): Verification => ({ ok: false, reason });
  if (!composition) return reject("shape");
  const byId = new Map(atoms.map((atom) => [atom.id, atom]));
  for (const item of composition.sentences) {
    const cited = item.cites.map((id) => byId.get(id)!.text);
    const normalizedCites = cited.map(normalize);
    const tokens = words(item.text);
    if (containsQuran(item.text, grams)) return reject("quran_text");
    // An unmatched quote delimiter also fails closed.
    const quoted = [...item.text.matchAll(/\u00ab([^\u00bb]*)\u00bb|"([^"]*)"/gu)];
    const withoutQuotes = item.text.replace(/\u00ab([^\u00bb]*)\u00bb|"([^"]*)"/gu, "");
    if (/[\u00ab\u00bb"]/u.test(withoutQuotes)) return reject("quotation");
    for (const match of quoted) {
      const span = match[1] ?? match[2];
      if (words(span).length > 1 && !normalizedCites.some((text) => text.includes(normalize(span)))) return reject("quotation");
    }
    const joined = tokens.join(" ");
    const citedTokens = cited.map((text) => ` ${words(text).join(" ")} `);
    for (const term of GRADING_WORDS) {
      const phrase = words(term).join(" ");
      // Match whole words, allowing the common attached definite article.
      for (const form of [phrase, `\u0627\u0644${phrase}`]) {
        if (` ${joined} `.includes(` ${form} `) && !citedTokens.some((text) => text.includes(` ${form} `))) return reject("grading");
      }
    }
    const numbers = new Set(cited.flatMap(digitRuns));
    if (context?.surah !== undefined) numbers.add(String(context.surah));
    for (const number of context?.ayah_numbers || []) numbers.add(String(number));
    for (const ayah of context?.stop_ayahs || []) for (const number of digitRuns(ayah.key)) numbers.add(number);
    if (digitRuns(item.text).some((number) => !numbers.has(number))) return reject("numbers");
    const content = new Set(cited.flatMap(words).filter((word) => word.length >= 3));
    const triggers = ATTRIBUTION_WORDS.map(normalize).join("|");
    const runs = normalize(item.text).matchAll(new RegExp(`(?:^|[^\\p{L}])(?:${triggers})(?=\\s|\\p{L})([^.!?\\u061f\\u060c,;\\u061b:\\n]*)`, "gu"));
    for (const run of runs) if (!words(run[1]).some((word) => word.length >= 3 && content.has(word))) return reject("names");
  }
  return { ok: true, value: composition };
}
