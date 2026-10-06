// @ts-expect-error -- Node tests require explicit source extensions.
import { normalize } from "./ask/normalize.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { readerUnits } from "./ask/atoms.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { quranTrigrams } from "./ask/verify.ts";
import type { Depth, Surah } from "./types";

export type VoiceResult = { status: "ok"; text: string; corrected: boolean }
  | { status: "unavailable" | "empty" | "busy" | "error" };
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_STT_MODEL = "whisper-large-v3";
export const DEFAULT_FIX_MODEL = "openai/gpt-oss-120b";
export const HINT_MAX_CHARS = 300;
export const FIX_INSTRUCTIONS = "You correct an automatic Arabic speech transcript of a reader's spoken question about a Quran commentary. The JSON input gives the transcript and the reading context: the surah, the open passage title, its ayahs in Uthmani script, the terms and scholars it cites, and surah words in plain spelling. Fix only obvious speech-recognition errors: misspelled words, wrongly split or merged words, and Quran words, grammar or rhetoric terms, or scholars' names that were misheard (prefer the spellings in the context). A frequent mishearing: the word for a Quran chapter (\u0633\u0648\u0631\u0629) comes out as the word for a picture (\u0635\u0648\u0631\u0629), which sounds almost the same; when the reader is plainly talking about the chapter being read, restore it. Keep the reader's own wording and dialect: Egyptian colloquial stays colloquial. Do not answer the question. Do not add, remove or reorder ideas. Do not complete, extend or quote Quran verses beyond the words the reader said. Do not add diacritics. Do not translate. If the transcript is already fine, return it unchanged. Reply with JSON only: {\"text\": \"...\".";
export interface VoiceContext { surahName: string; stopTitle?: string; terms: string[]; authors: string[]; words: string[]; stopAyahs: string[] }
export interface HintText { intro: string; stop: string; scholars: string; terms: string; words: string }

/** Runs `fetch` under a deadline; the caller signal and the timer both abort the request. */
async function withTimeLimit<T>(ms: number, signal: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, ms);
  try { return await run(controller.signal); }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}

/** Cuts to `max` characters at the last whitespace inside that window. */
function cutAtWhitespace(text: string, max: number): string {
  const chars = [...text];
  const window = chars.slice(0, max).join("");
  let cut = window.length;
  while (cut > 0 && !/\s/.test(window[cut - 1])) cut -= 1;
  if (cut === 0) cut = window.length;
  return (cut === window.length ? window : window.slice(0, cut)).trimEnd();
}

const GLYPHS = /[\uFB50-\uFDFF\uFE70-\uFEFF]/;
const UNSAFE_MARKS = /[\u0640\u0654\u0655\u0656\u065E\u06DF-\u06E0\u06E2-\u06E4\u06E5\u06E6]|[\u0623\u0625]\u0653/;
// The rasm writes the doubled lam of a prefixed article once, with a shadda over it.
const ARTICLE_LAM = /\u0671\u0644\u0651/;
const MARKS = /[\u0610-\u061A\u064B-\u0652\u0653\u0657-\u065A\u065C\u065D\u065F\u06D6-\u06ED]/g;
const DAGGER_ALEF = /\u0670/g;

export function plainQuranWords(ayahTexts: string[]): string[] {
  const words: string[] = [];
  for (const text of ayahTexts) {
    for (const token of text.split(/\s+/)) {
      if (!token || GLYPHS.test(token) || UNSAFE_MARKS.test(token) || ARTICLE_LAM.test(token)) continue;
      const withoutMarks = token.replace(MARKS, "");
      if (/\u0670/.test(withoutMarks) && !/\u0649\u0670$/.test(withoutMarks)) continue;
      const word = withoutMarks.replace(DAGGER_ALEF, "").replace(/\u0671/g, "\u0627");
      if ([...word].length >= 3 && !words.includes(word)) words.push(word);
    }
  }
  return words;
}

export function shortAuthor(author: string): string {
  const part = author.split(/[(\u060C]/, 1)[0].trim();
  const words = part.split(/\s+/).filter(Boolean);
  if (part.includes("\uFDFA") || words.length > 4 || (words[0] === "\u0627\u0644\u0646\u0628\u064a")) return "";
  return part;
}

export function contextFor(surah: Surah, depth: unknown, stop: unknown): VoiceContext {
  const own = surah.ayahs.filter((ayah) => ayah.key.startsWith(`${surah.surah.no}:`));
  const context: VoiceContext = {
    surahName: surah.surah.name, terms: [], authors: [],
    words: plainQuranWords(own.map((ayah) => ayah.text)), stopAyahs: [],
  };
  if (typeof depth !== "number" || ![0, 1, 2, 3].includes(depth)) return context;
  if (typeof stop !== "number" || !Number.isInteger(stop) || stop < 1) return context;
  const unit = readerUnits(surah, depth as Depth).find((item) => item.number === stop);
  if (!unit) return context;
  context.stopTitle = unit.title;
  context.terms = [...new Set(unit.recordIds
    .flatMap((id) => Object.hasOwn(surah.records, id) && surah.records[id].term ? [surah.records[id].term!] : []))].slice(0, 6);
  context.authors = [...new Set(unit.recordIds.flatMap((id) => Object.hasOwn(surah.records, id)
    ? surah.records[id].evidence.map((evidence) => shortAuthor(evidence.author)) : []))]
    .filter(Boolean).slice(0, 6);
  context.stopAyahs = unit.ayahKeys.map((key) => surah.ayahs.find((ayah) => ayah.key === key)!.text);
  context.words = [...new Set([...plainQuranWords(context.stopAyahs), ...context.words])];
  return context;
}

export function hintSentence(context: VoiceContext, text: HintText): string {
  const list = (values: string[]) => values.join("\u060C ");
  let sentence = "";
  const add = (part: string): boolean => {
    if (!part) return false;
    const next = sentence ? `${sentence} ${part}` : part;
    if ([...next].length > HINT_MAX_CHARS) return false;
    sentence = next;
    return true;
  };
  add(text.intro.replace("{surah}", context.surahName));
  if (context.stopTitle) add(text.stop.replace("{stop}", context.stopTitle));
  if (context.authors.length) add(text.scholars.replace("{list}", list(context.authors)));
  if (context.terms.length) add(text.terms.replace("{list}", list(context.terms)));
  const wordStop = Math.min(24, context.words.length);
  for (let count = wordStop; count >= 1; count--) {
    if (add(text.words.replace("{list}", list(context.words.slice(0, count))))) break;
  }
  return sentence;
}

function levenshtein(a: readonly (string | number)[], b: readonly (string | number)[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_item, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

const trigramWindows = (tokens: string[]): string[] =>
  tokens.map((_token, index) => index).filter((index) => index + 2 < tokens.length)
    .map((index) => tokens.slice(index, index + 3).join(" "));
const normDigit = (digit: string) => {
  const code = digit.charCodeAt(0);
  return code >= 0x6F0 ? String(code - 0x6F0) : code >= 0x660 ? String(code - 0x660) : digit;
};

export type FixCheck = { ok: true } | { ok: false; reason: "length" | "count" | "distance" | "quran" | "digits" };
export function acceptFix(raw: string, fixed: string, hint: string, grams: ReadonlySet<string> = quranTrigrams()): FixCheck {
  const tokens = (value: string): string[] => normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];
  if ([...fixed.trim()].length < 3 || [...fixed.trim()].length > 300) return { ok: false, reason: "length" };
  const a = tokens(raw);
  const b = tokens(fixed);
  if (Math.abs(a.length - b.length) > 2) return { ok: false, reason: "count" };
  const hintWords = new Set(tokens(hint));
  const distance = levenshtein(a, b);
  if (distance > Math.max(1, Math.ceil(a.length * 0.3)) || distance > 5) return { ok: false, reason: "distance" };
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] === b[index]) continue;
    if (levenshtein([...a[index]], [...b[index]]) <= 3 || hintWords.has(b[index])) continue;
    return { ok: false, reason: "distance" };
  }
  const rawWindows = new Set(trigramWindows(a));
  if (trigramWindows(b).some((window) => !rawWindows.has(window) && grams.has(window))) return { ok: false, reason: "quran" };
  if (/[\uFD3E\uFD3F]/u.test(fixed) && !/[\uFD3E\uFD3F]/u.test(raw)) return { ok: false, reason: "quran" };
  const rawDigits = new Set([...raw.matchAll(/[0-9\u0660-\u0669\u06F0-\u06F9]/gu)].map((match) => normDigit(match[0])));
  if ([...fixed.matchAll(/[0-9\u0660-\u0669\u06F0-\u06F9]/gu)].some((match) => !rawDigits.has(normDigit(match[0])))) {
    return { ok: false, reason: "digits" };
  }
  return { ok: true };
}

const FIX_LIMIT_MS = 8_000;

interface SpeechReply { kind: "empty" | "error" | "busy" | "text"; text?: string; segments?: unknown }

/** HUDA_VOICE_STT_URL, when set, sends speech-to-text to that base URL instead of Groq. A judge's own Groq key is used alone, at Groq, and never falls back to the project's key. */
export async function transcribeQuestion(input: {
  audio: Blob; filename: string; context: VoiceContext; hintText: HintText; live: boolean;
  env: Readonly<Record<string, string | undefined>>; ownKey?: string; fetchImpl?: typeof fetch; signal?: AbortSignal;
}): Promise<VoiceResult> {
  const { audio, filename, context, hintText, live, env, fetchImpl = fetch, signal } = input;
  const apiKey = input.ownKey ?? env.GROQ_API_KEY;
  const local = Boolean(env.HUDA_VOICE_STT_URL) && input.ownKey === undefined;
  const sttBase = local ? env.HUDA_VOICE_STT_URL!.replace(/\/+$/, "") : GROQ_BASE_URL;
  if (!apiKey && !local) return { status: "unavailable" };
  const hint = hintSentence(context, hintText);
  const sttFetch = (inner: AbortSignal, withPrompt: boolean): Promise<Response> => {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", env.HUDA_VOICE_STT_MODEL || DEFAULT_STT_MODEL);
    form.append("language", "ar");
    form.append("response_format", "verbose_json");
    form.append("temperature", "0");
    if (withPrompt && hint) form.append("prompt", hint);
    return fetchImpl(`${sttBase}/audio/transcriptions`, {
      method: "POST", signal: inner,
      headers: local ? {} : { authorization: `Bearer ${apiKey}` }, body: form,
    });
  };
  const speech = await withTimeLimit(live ? 12_000 : 20_000, signal, async (inner) => {
    let response = await sttFetch(inner, true);
    if (response.status === 400) {
      await response.body?.cancel();
      response = await sttFetch(inner, false);
    }
    const reply: SpeechReply = { kind: "text" };
    if (response.status === 429) { reply.kind = "busy"; return reply; }
    if (!response.ok) { reply.kind = "error"; return reply; }
    const data = await response.json() as { text?: unknown; segments?: unknown };
    if (typeof data.text !== "string") { reply.kind = "error"; return reply; }
    reply.text = data.text;
    reply.segments = data.segments;
    reply.kind = "text";
    return reply;
  }).catch(() => ({ kind: "error" }) as SpeechReply);
  if (speech.kind === "busy") return { status: "busy" };
  if (speech.kind === "error") return { status: "error" };
  if (typeof speech.text !== "string") return { status: "empty" };
  const segments = Array.isArray(speech.segments) ? (speech.segments as { no_speech_prob?: number }[]) : [];
  if (segments.length >= 1 && segments.every((segment) => Number(segment?.no_speech_prob) > 0.6)) return { status: "empty" };
  let transcript = speech.text.replace(/\s+/g, " ").trim();
  if (!transcript || [...transcript].length < 3) return { status: "empty" };
  if ([...transcript].length > 300) transcript = cutAtWhitespace(transcript, 300);
  const canFix = !live && env.HUDA_VOICE_FIX_MODEL !== "0" && Boolean(apiKey);
  if (!canFix) return { status: "ok", text: transcript, corrected: false };
  const fixModel = env.HUDA_VOICE_FIX_MODEL || DEFAULT_FIX_MODEL;
  const fixBody = (extras: boolean) => JSON.stringify({
    model: fixModel, temperature: 0, max_tokens: 400, response_format: { type: "json_object" },
    ...(extras ? { reasoning_effort: "low", include_reasoning: false } : {}),
    messages: [
      { role: "system", content: FIX_INSTRUCTIONS },
      { role: "user", content: JSON.stringify({
        transcript, surah: context.surahName, stop_title: context.stopTitle ?? null,
        stop_ayahs: context.stopAyahs, terms: context.terms, scholars: context.authors,
        surah_words: context.words.slice(0, 40),
      }) },
    ],
  });
  const repaired = await withTimeLimit(FIX_LIMIT_MS, signal, async (inner) => {
    const send = (extras: boolean) => fetchImpl(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST", signal: inner,
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: fixBody(extras),
    });
    let response = await send(true);
    if (response.status === 400) {
      await response.body?.cancel();
      response = await send(false);
    }
    if (!response.ok) return undefined;
    const data = await response.json() as { choices?: { message?: { content?: unknown } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return undefined;
    const parsed = JSON.parse(content) as { text?: unknown };
    return typeof parsed.text === "string" ? parsed.text : undefined;
  }).catch(() => undefined);
  if (repaired === undefined || repaired === transcript || !acceptFix(transcript, repaired, hint).ok) {
    return { status: "ok", text: transcript, corrected: false };
  }
  return { status: "ok", text: repaired, corrected: true };
}
