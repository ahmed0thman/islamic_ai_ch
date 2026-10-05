import guard from "./example-guard.json" with { type: "json" };
// @ts-expect-error -- Node requires source extensions.
import { normalize } from "./normalize.ts";
// @ts-expect-error -- Node requires source extensions.
import { containsQuran } from "./verify.ts";
import type { ComposedSentence } from "./types";

/** Why an example was dropped. Fixed codes only: they go to the log, never the text. */
export type ExampleReason = "several" | "empty" | "length" | "digits" | "quotation" | "quran_text" | "forbidden";
export const EXAMPLE_MAX_WORDS: number = guard.max_words;

const words = (text: string): string[] => normalize(text).match(/[\p{L}\p{N}]+/gu) || [];
const forbidden = new Set(guard.words.map(normalize));
const PREFIXES = ["و", "ف", "ب", "ل", "ك"];
const DEFINITE = "ال";

/** The word as written and with up to two attached prefixes (and, so, by, to, like) and the article taken off. A prefix is only taken off if two letters remain. */
function forms(word: string): Set<string> {
  const out = new Set([word]);
  let frontier = [word];
  for (let round = 0; round < 2; round++) {
    const next: string[] = [];
    for (const form of frontier) for (const prefix of PREFIXES) {
      if (!form.startsWith(prefix) || form.length - 1 < 2) continue;
      const rest = form.slice(1);
      if (!out.has(rest)) { out.add(rest); next.push(rest); }
    }
    frontier = next;
  }
  for (const form of [...out]) {
    if (form.startsWith(DEFINITE) && form.length - 2 >= 2) out.add(form.slice(2));
    // "to" + the article contracts: ل + النبي is written للنبي, and ل + الله is written لله.
    if (form.startsWith("\u0644\u0644") && form.length - 2 >= 2) out.add(DEFINITE + form.slice(2));
    if (form.startsWith("\u0644\u0644\u0647")) out.add("\u0627\u0644\u0644\u0647");
  }
  return out;
}

/** The mechanical conditions of an example. That it is a daily situation that explains a language point, and does not end with a conclusion about the ayah, is the model's instruction; a real person's name is not detectable beyond the word list. */
export function checkExample(text: string, max = EXAMPLE_MAX_WORDS): ExampleReason | undefined {
  const tokens = words(text);
  if (!text.trim() || !tokens.length) return "empty";
  if (tokens.length > max) return "length";
  if (/[0-9٠-٩۰-۹]/u.test(text)) return "digits";
  if (/[«»"“”]/u.test(text)) return "quotation";
  if (containsQuran(text)) return "quran_text";
  if (text.includes("ﷺ") || tokens.some((token) => [...forms(token)].some((form) => forbidden.has(form)))) return "forbidden";
  return undefined;
}

/** Splits the written sentences from the examples. `after` is the index (among the claims) of the claim the example follows; -1 when it came first. */
export function splitExamples(sentences: ComposedSentence[]): { claims: ComposedSentence[]; examples: { text: string; after: number }[] } {
  const claims: ComposedSentence[] = [], examples: { text: string; after: number }[] = [];
  for (const sentence of sentences) {
    if (sentence.kind === "example") examples.push({ text: typeof sentence.text === "string" ? sentence.text : "", after: claims.length - 1 });
    else claims.push(sentence);
  }
  return { claims, examples };
}

/** At most one example per answer; two or more are all dropped, since there is no telling which one is right. */
export function pickExample(examples: { text: string; after: number }[]): { example?: { text: string; after: number }; reason?: ExampleReason } {
  if (!examples.length) return {};
  if (examples.length > 1) return { reason: "several" };
  const reason = checkExample(examples[0].text);
  return reason ? { reason } : { example: examples[0] };
}
