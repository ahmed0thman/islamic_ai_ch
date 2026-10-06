import quran from "../../content/quran-plain.json" with { type: "json" };
import uthmani from "../../content/quran-uthmani.json" with { type: "json" };
// @ts-expect-error -- Node requires source extensions.
import { normalize } from "./normalize.ts";
// @ts-expect-error -- Node requires source extensions.
import { REPORT_MARKERS, guardTokens, hasMarker } from "./source-guard.ts";
// @ts-expect-error -- Node requires source extensions.
import { surahOf } from "./public-atom.ts";
import type { Atom, ComposedSentence, Composition, ReaderContext } from "./types";

/** `narration`: the sentence rests on a narration it may not reword (see `checkSentence`); it is not an error to repair, the narration is shown word for word instead.
 * `verdict`: the reader asked whether a report is established and the sentence opens with a yes or a no. */
export type VerifyReason = "shape" | "quran_text" | "quotation" | "grading" | "numbers" | "names" | "report" | "narration" | "verdict";
export type Verification = { ok: true; value: Composition } | { ok: false; reason: VerifyReason };
/** The last seven (added with the narration rules): the feminine forms thabita, sahiha, daifa, mawdua and the verbs thabata, yathbut, yasihh. */
export const GRADING_WORDS = ["\u0635\u062d\u064a\u062d", "\u062d\u0633\u0646", "\u0636\u0639\u064a\u0641", "\u0645\u0648\u0636\u0648\u0639", "\u0645\u0646\u0643\u0631", "\u0645\u062a\u0648\u0627\u062a\u0631", "\u062b\u0627\u0628\u062a", "\u0644\u0627 \u064a\u062b\u0628\u062a", "\u0644\u0645 \u064a\u062b\u0628\u062a", "\u0644\u064a\u0633 \u0628\u062b\u0627\u0628\u062a", "\u062b\u0627\u0628\u062a\u0629", "\u0635\u062d\u064a\u062d\u0629", "\u0636\u0639\u064a\u0641\u0629", "\u0645\u0648\u0636\u0648\u0639\u0629", "\u062b\u0628\u062a", "\u064a\u062b\u0628\u062a", "\u064a\u0635\u062d"] as const;
/** The bare preposition (U+0639 U+0646) is not a trigger: it precedes any noun, and its narration use is caught by the report markers and the support check. */
export const ATTRIBUTION_WORDS = ["\u0642\u0627\u0644", "\u064a\u0642\u0648\u0644", "\u0630\u0643\u0631", "\u064a\u0631\u0649", "\u0639\u0646\u062f", "\u062d\u0633\u0628", "\u0648\u0641\u0642\u0627 \u0644\u0640", "\u0648\u0641\u0642\u0627 \u0644"] as const;
const words = (text: string): string[] => normalize(text).match(/[\p{L}\p{N}]+/gu) || [];
/** Words by which a reader asks whether a report is established or authentic: thabit, thabata, yathbut, thubut, sahih, sihha, yasihh, daif, mawdu, makdhub and their
 * accusative, feminine or suffixed forms (compared after `normalize`, as whole words, with or without the article). */
export const AUTHENTICITY_WORDS = ["\u062b\u0627\u0628\u062a", "\u062b\u0627\u0628\u062a\u0627", "\u062b\u0628\u062a", "\u064a\u062b\u0628\u062a", "\u062b\u0628\u0648\u062a", "\u062b\u0628\u0648\u062a\u0647", "\u0635\u062d\u064a\u062d", "\u0635\u062d\u064a\u062d\u0627", "\u0635\u062d\u0629", "\u0635\u062d\u062a\u0647", "\u064a\u0635\u062d", "\u0635\u062d", "\u0636\u0639\u064a\u0641", "\u0636\u0639\u064a\u0641\u0627", "\u0645\u0648\u0636\u0648\u0639", "\u0645\u0643\u0630\u0648\u0628", "\u062b\u0627\u0628\u062a\u0629", "\u0635\u062d\u064a\u062d\u0629", "\u0636\u0639\u064a\u0641\u0629", "\u0645\u0648\u0636\u0648\u0639\u0629", "\u0645\u0643\u0630\u0648\u0628\u0629"] as const;
/** Answer particles (yes: naam, bala, ajal; no: kalla, la) that would make the first word of a sentence a ruling on such a question. */
export const VERDICT_OPENERS = ["\u0646\u0639\u0645", "\u0628\u0644\u0649", "\u0623\u062c\u0644", "\u0643\u0644\u0627", "\u0644\u0627"] as const;
const authenticityWords = new Set(AUTHENTICITY_WORDS.flatMap((word) => [normalize(word), normalize(`\u0627\u0644${word}`)]));
/** Whether the question asks for a ruling on a report (is it established that..., is it authentic that...). */
export function asksAuthenticity(question: string | undefined): boolean {
  return !!question && words(question).some((word) => authenticityWords.has(word));
}
const verdictOpeners = new Set(VERDICT_OPENERS.map(normalize));
/** Whether the sentence opens with a yes or a no. The bare negation particle counts only when punctuation follows it (it also begins ordinary negative sentences). */
export function opensWithVerdict(text: string): boolean {
  const match = /^[^\p{L}]*([\p{L}]+)\s*([\u060c,.:;\u061b!\u2014-])?/u.exec(normalize(text));
  if (!match || !verdictOpeners.has(match[1])) return false;
  return match[1] !== normalize("\u0644\u0627") || match[2] !== undefined;
}
/** Ordinals an ayah is pointed at with, in words (first to tenth, masculine and feminine, and "last"), as `normalize` leaves them. A number in words is still a number. */
const ORDINAL_VALUES: Readonly<Record<string, number | "last">> = {
  "\u0627\u0648\u0644": 1, "\u0627\u0648\u0644\u064a": 1, "\u062b\u0627\u0646\u064a": 2, "\u062b\u0627\u0646\u064a\u0647": 2, "\u062b\u0627\u0644\u062b": 3, "\u062b\u0627\u0644\u062b\u0647": 3, "\u0631\u0627\u0628\u0639": 4, "\u0631\u0627\u0628\u0639\u0647": 4, "\u062e\u0627\u0645\u0633": 5, "\u062e\u0627\u0645\u0633\u0647": 5,
  "\u0633\u0627\u062f\u0633": 6, "\u0633\u0627\u062f\u0633\u0647": 6, "\u0633\u0627\u0628\u0639": 7, "\u0633\u0627\u0628\u0639\u0647": 7, "\u062b\u0627\u0645\u0646": 8, "\u062b\u0627\u0645\u0646\u0647": 8, "\u062a\u0627\u0633\u0639": 9, "\u062a\u0627\u0633\u0639\u0647": 9, "\u0639\u0627\u0634\u0631": 10, "\u0639\u0627\u0634\u0631\u0647": 10, "\u0627\u062e\u064a\u0631": "last", "\u0627\u062e\u064a\u0631\u0647": "last", "\u0627\u062e\u0631": "last",
};
/** The word for an ayah, with a pronoun or in the dual. */
const AYAH_WORDS: ReadonlySet<string> = new Set(["\u0627\u064a\u0647", "\u0627\u064a\u062a\u0647\u0627", "\u0627\u064a\u062a\u0647", "\u0627\u064a\u062a\u064a\u0646", "\u0627\u064a\u062a\u0627\u0646"]);
/** A word without one attached conjunction, one attached preposition and the article. */
const bare = (word: string) => word.replace(/^[\u0648\u0641](?=.{3})/u, "").replace(/^\u0644\u0644/u, "").replace(/^[\u0628\u0644\u0643](?=\u0627\u0644)/u, "").replace(/^\u0627\u0644/u, "");
/** The ordinals that stand right beside the word for an ayah ("the third ayah", "its last ayah"), by value. */
export function ayahOrdinals(tokens: readonly string[]): (number | "last")[] {
  const found: (number | "last")[] = [];
  tokens.forEach((token, i) => {
    if (!AYAH_WORDS.has(bare(token))) return;
    // After the word ("the third ayah" in Arabic order), or before it ("the last ayah of ...") unless that ordinal belongs to an ayah named just before.
    const after = tokens[i + 1] === undefined ? undefined : ORDINAL_VALUES[bare(tokens[i + 1])];
    const before = i < 1 || (i > 1 && AYAH_WORDS.has(bare(tokens[i - 2]))) ? undefined : ORDINAL_VALUES[bare(tokens[i - 1])];
    if (after !== undefined) found.push(after); else if (before !== undefined) found.push(before);
  });
  return found;
}
/** Arabic Presentation Forms-A: the ayah-end sign of the King Fahd text is a code point of this block (U+FC00 and on). No word of an ayah is written with it. */
const NOT_A_WORD = /[\ufb50-\ufdff]/gu;
/** Marks `normalize` leaves in place (the signs above and below of U+0610 to U+061A and U+08D3 to U+08FF) and characters that are not seen (soft hyphen, zero-width and direction marks). */
const UNSEEN = /[\u00ad\u0610-\u061a\u061c\u08d3-\u08ff\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/gu;
/** Persian and Urdu forms of yeh, kaf and heh, folded to the Arabic letter. */
const FOREIGN_FORMS: Readonly<Record<string, string>> = { "\u06cc": "\u064a", "\u06d2": "\u064a", "\u06a9": "\u0643", "\u06be": "\u0647", "\u06c1": "\u0647", "\u06d5": "\u0647" };
/** The words the Quran detector compares, for the index and for the text alike: `normalize` (which already drops the vowel marks, the dagger alef U+0670, the madda
 * and the Quranic annotation signs U+06D6 to U+06ED) after the ayah-end sign is taken out, compatibility forms are folded (NFKC) and unseen characters are dropped.
 * The detector only: quotation, grading, number and name checks keep `words`. */
export const quranWords = (text: string): string[] => normalize(text.replace(NOT_A_WORD, " ").normalize("NFKC").replace(UNSEEN, "")
  .replace(/[\u06cc\u06d2\u06a9\u06be\u06c1\u06d5]/gu, (letter) => FOREIGN_FORMS[letter])).match(/[\p{L}\p{N}]+/gu) || [];
/** Every run of three words of each ayah, and an ayah of exactly two words as that pair. An ayah of one word cannot be told from the word itself and is not indexed. */
export function buildQuranTrigrams(ayahs: readonly string[]): Set<string> {
  const grams = new Set<string>();
  for (const ayah of ayahs) {
    const tokens = quranWords(ayah);
    if (tokens.length === 2) grams.add(tokens.join(" "));
    for (let i = 0; i + 2 < tokens.length; i++) grams.add(tokens.slice(i, i + 3).join(" "));
  }
  return grams;
}
let cachedGrams: Set<string> | undefined;
/** Built from both spellings of the King Fahd text: the plain one, and the Uthmani one that the verified sentences and the reader's stop carry to the writer
 * (in it the dagger alef and a doubled letter written once make words the plain spelling does not have). */
export function quranTrigrams(): ReadonlySet<string> {
  return cachedGrams ||= buildQuranTrigrams([...quran, ...uthmani]);
}
export function containsQuran(text: string, grams: ReadonlySet<string> = quranTrigrams()): boolean {
  if (/[\ufd3e\ufd3f]/u.test(text)) return true;
  const tokens = quranWords(text);
  return tokens.some((_, i) => (i + 2 < tokens.length && grams.has(tokens.slice(i, i + 3).join(" "))) || (i + 1 < tokens.length && grams.has(`${tokens[i]} ${tokens[i + 1]}`)));
}
function digitRuns(text: string): string[] {
  return (text.match(/[0-9\u0660-\u0669\u06f0-\u06f9]+/gu) || []).map((run) => run.replace(/[\u0660-\u0669\u06f0-\u06f9]/gu,
    (digit) => String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660))));
}
const keysExactly = (record: object, keys: string[]) => Object.keys(record).length === keys.length && keys.every((key) => Object.hasOwn(record, key));
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
/** Parsing is independent of the model schema: fail closed on any unknown field. An example item is only looked at for its kind here;
 * its text is judged apart (see example.ts), so a bad example never sinks the answer. */
export function parseComposition(value: unknown, atoms: Atom[]): Composition | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || !keysExactly(value, ["status", "sentences"])) return;
  const record = value as Record<string, unknown>;
  if (!["answer", "insufficient", "fatwa", "out_of_scope", "not_arabic"].includes(record.status as string) || !Array.isArray(record.sentences)) return;
  if (record.status !== "answer") return record.sentences.length === 0 ? value as Composition : undefined;
  if (record.sentences.length < 1 || record.sentences.length > 10) return;
  const byId = new Map(atoms.map((atom) => [atom.id, atom]));
  let claims = 0;
  for (const item of record.sentences) {
    if (isRecord(item) && item.kind === "example") continue;
    claims++;
    const hasKind = isRecord(item) && Object.hasOwn(item, "kind");
    if (!isRecord(item) || !keysExactly(item, hasKind ? ["text", "cites", "kind"] : ["text", "cites"]) || (hasKind && item.kind !== "claim")
      || typeof item.text !== "string" || !item.text.trim() || [...item.text].length > 220
      || !Array.isArray(item.cites) || item.cites.length < 1 || item.cites.length > 3
      || item.cites.some((id: unknown) => typeof id !== "string" || !byId.has(id)) || new Set(item.cites).size !== item.cites.length) return;
  }
  if (claims < 1 || claims > 5) return;
  return value as Composition;
}

/** Attribution is deliberately conservative, not entity recognition. It checks the
 * entire run after a trigger up to punctuation against cited content words. A
 * matching predicate can pass an unknown name; the semantic support check must
 * still preserve the exact scholar name. False rejections use extractive fallback.
 */
export function verify(value: unknown, atoms: Atom[], context?: ReaderContext, grams: ReadonlySet<string> = quranTrigrams(), question?: string): Verification {
  const each = verifyEach(value, atoms, context, grams, question);
  if (!each.ok) return { ok: false, reason: "shape" };
  const failed = each.reasons.find((reason) => reason !== undefined);
  return failed ? { ok: false, reason: failed } : { ok: true, value: each.value };
}

/** One verdict per written (claim) sentence, in order: the reason it fails, or undefined. `ok: false` only when the whole shape is wrong. Examples are not checked here. */
export function verifyEach(value: unknown, atoms: Atom[], context?: ReaderContext, grams: ReadonlySet<string> = quranTrigrams(), question?: string): { ok: true; value: Composition; reasons: (VerifyReason | undefined)[] } | { ok: false } {
  const composition = parseComposition(value, atoms);
  if (!composition) return { ok: false };
  const byId = new Map(atoms.map((atom) => [atom.id, atom]));
  const authenticity = asksAuthenticity(question);
  const reasons = composition.sentences.filter((item) => item.kind !== "example").map((item) => checkSentence(item, byId, context, grams, authenticity));
  return { ok: true, value: composition, reasons };
}

function checkSentence(item: ComposedSentence, byId: Map<string, Atom>, context: ReaderContext | undefined, grams: ReadonlySet<string>, authenticity = false): VerifyReason | undefined {
  const citedAtoms = item.cites.map((id) => byId.get(id)!);
  // The writer never rewords a narration. A sentence that rests on narrations alone, or that cites a narration with no accepted ruling (decision 058:
  // it is not built on), is not shown: the answer shows the narrations themselves, word for word, each with the marker that carries its status.
  if (!citedAtoms.some((atom) => atom.role === "claim" || atom.role === "source") || citedAtoms.some((atom) => atom.suspended)) return ("narration");
  // Asked whether a report is established, the answer relays what the sources say; it does not open with a yes or a no.
  if (authenticity && opensWithVerdict(item.text)) return ("verdict");
  const cited = citedAtoms.map((atom) => atom.text);
  const normalizedCites = cited.map(normalize);
  const tokens = words(item.text);
  if (containsQuran(item.text, grams)) return ("quran_text");
  // A narration is never relayed from a book excerpt: it may come only from a verified sentence, which carries its ruling.
  if (citedAtoms.some((atom) => atom.role === "source") && hasMarker(guardTokens(item.text), REPORT_MARKERS)) return ("report");
  // An unmatched quote delimiter also fails closed.
  const quoted = [...item.text.matchAll(/\u00ab([^\u00bb]*)\u00bb|"([^"]*)"/gu)];
  const withoutQuotes = item.text.replace(/\u00ab([^\u00bb]*)\u00bb|"([^"]*)"/gu, "");
  if (/[\u00ab\u00bb"]/u.test(withoutQuotes)) return ("quotation");
  for (const match of quoted) {
    const span = match[1] ?? match[2];
    if (words(span).length > 1 && !normalizedCites.some((text) => text.includes(normalize(span)))) return ("quotation");
  }
  const joined = tokens.join(" ");
  const citedTokens = cited.map((text) => ` ${words(text).join(" ")} `);
  for (const term of GRADING_WORDS) {
    const phrase = words(term).join(" ");
    // Match whole words, allowing the common attached definite article.
    for (const form of [phrase, `\u0627\u0644${phrase}`]) {
      if (` ${joined} `.includes(` ${form} `) && !citedTokens.some((text) => text.includes(` ${form} `))) return ("grading");
    }
  }
  const numbers = new Set(cited.flatMap(digitRuns));
  // Sentences now come from several surahs: the number of the surah a verified sentence belongs to is its own.
  for (const atom of citedAtoms) if (atom.role !== "source") { const surah = surahOf(atom); if (surah !== undefined) numbers.add(String(surah)); }
  if (context?.surah !== undefined) numbers.add(String(context.surah));
  for (const number of context?.ayah_numbers || []) numbers.add(String(number));
  for (const ayah of context?.stop_ayahs || []) for (const number of digitRuns(ayah.key)) numbers.add(number);
  if (digitRuns(item.text).some((number) => !numbers.has(number))) return ("numbers");
  // An ayah pointed at by an ordinal in words ("the third ayah"): a cited sentence must name that ordinal or that number, or the ayah must be one of the open stop's.
  const pointed = ayahOrdinals(tokens);
  if (pointed.length) {
    const known = new Set<number | "last">(cited.flatMap((text) => words(text).map((word) => ORDINAL_VALUES[bare(word)]).filter((value) => value !== undefined)));
    for (const number of cited.flatMap(digitRuns)) known.add(Number(number));
    const stopAyahs = (context?.stop_ayahs || []).map((ayah) => Number(ayah.key.split(":")[1]));
    for (const number of stopAyahs) known.add(number);
    const lastAyah = Math.max(0, ...(context?.ayah_numbers || []));
    if (lastAyah && (stopAyahs.includes(lastAyah) || known.has(lastAyah))) known.add("last");
    if (pointed.some((value) => !known.has(value))) return ("numbers");
  }
  // Compared by stem (attached particle and article dropped, first three letters), so a paraphrase that changes a word's form is not read as an invented name.
  const stem = (word: string) => word.replace(/^[\u0648\u0641\u0628\u0644\u0643](?=\u0627\u0644)/u, "").replace(/^\u0627\u0644/u, "").slice(0, 3);
  const content = new Set(cited.flatMap(words).map(stem).filter((word) => word.length >= 3));
  const triggers = ATTRIBUTION_WORDS.map(normalize).join("|");
  const runs = normalize(item.text).matchAll(new RegExp(`(?:^|[^\\p{L}])(?:${triggers})(?=\\s|\\p{L})([^.!?\\u061f\\u060c,;\\u061b:\\n]*)`, "gu"));
  for (const run of runs) {
    // A trigger with nothing name-like after it (an attached pronoun, as in the preposition with its pronoun) attributes nothing.
    const named = words(run[1]).map(stem).filter((word) => word.length >= 3);
    if (named.length && !named.some((word) => content.has(word))) return ("names");
  }
  return undefined;
}
