// @ts-expect-error -- Node tests require explicit source extensions.
import { arabicDigits } from "./numerals.ts";

/** The reader speaks his question: while he records, the growing recording is re-sent every few seconds for a
    provisional transcript; when he stops, the whole recording goes once more and its text replaces the provisional one. */

export const LIVE_EVERY_MS = 2500; // cadence of provisional requests
export const LIVE_MIN_MS = 1800; // no provisional request before this much audio
export const MAX_RECORDING_MS = 40_000; // hard stop
export const TIMESLICE_MS = 1000; // <= 100 ms yields empty blobs on Safari 26 (WebKit bug 301507)
export const SILENCE_MS = 2500; // this much quiet after the reader has spoken ends the recording and sends the question
export const VOICE_LEVEL = 0.05; // smoothed level (0..1) above which the reader is speaking
export const SPEECH_MIN_MS = 250; // sound must last this long to count as speech (a click or a cough does not)
export const LIVE_FOR_MP4 = true; // orchestrator flips to false if Safari rejects concatenated mp4 chunks
export const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"] as const;

/** First candidate the browser supports; `undefined` when the method is missing (older WebKit) so the recorder default is used. */
export function pickMimeType(isSupported: ((type: string) => boolean) | undefined): string | undefined {
  if (!isSupported) return undefined;
  for (const candidate of MIME_CANDIDATES) if (isSupported(candidate)) return candidate;
  return undefined;
}

/** The filename the `audio` part carries; the server sniffs the container from it. */
export function fileNameFor(mime: string): string {
  if (mime.includes("mp4")) return "question.mp4";
  if (mime.includes("m4a") || mime.includes("aac")) return "question.m4a";
  if (mime.includes("ogg")) return "question.ogg";
  if (mime.includes("wav")) return "question.wav";
  return "question.webm";
}

/** Provisional requests assume concatenated chunks form one valid file; mp4/m4a are gated on the Safari check. */
export function liveAllowed(mime: string | undefined): boolean {
  if (mime && (mime.includes("mp4") || mime.includes("m4a"))) return LIVE_FOR_MP4;
  return true;
}

/** "m:ss" of whole seconds, display digits. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return arabicDigits(`${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`);
}

/** The spoken text joins what was already in the box; the box never exceeds 300 code points, cut at the last whitespace. */
export function mergeQuestion(base: string, spoken: string): string {
  const trimmed = spoken.trim();
  const merged = base.trim() === "" ? trimmed : `${base} ${trimmed}`;
  const points = [...merged];
  if (points.length <= 300) return merged;
  let lastWhitespace = -1;
  for (let i = 0; i < 300; i += 1) if (/\s/u.test(points[i])) lastWhitespace = i;
  return points.slice(0, lastWhitespace > 0 ? lastWhitespace : 300).join("");
}

export type VoiceState = "idle" | "listening" | "finalizing" | "review" | "partial" | "denied" | "failed";

/** Where the reader lands once the final request settles: his text to review, his provisional text kept, or nothing. */
export function nextAfterFinal(status: string | undefined, hasLiveText: boolean): VoiceState {
  if (status === "ok") return "review";
  return hasLiveText ? "partial" : "failed";
}

export function levelFrom(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

export type SilenceState = { loudSince: number | null; lastVoiceAt: number | null };
/**
 * One step of the end-of-speech watch. `lastVoiceAt` is set once sound has lasted SPEECH_MIN_MS, and refreshed while it
 * lasts; `done` turns true when SILENCE_MS have passed since then. Before any speech, silence never ends the recording.
 */
export function silenceStep(state: SilenceState, level: number, now: number): { state: SilenceState; done: boolean } {
  if (level >= VOICE_LEVEL) {
    const loudSince = state.loudSince ?? now;
    const lastVoiceAt = now - loudSince >= SPEECH_MIN_MS ? now : state.lastVoiceAt;
    return { state: { loudSince, lastVoiceAt }, done: false };
  }
  const next = { loudSince: null, lastVoiceAt: state.lastVoiceAt };
  return { state: next, done: next.lastVoiceAt !== null && now - next.lastVoiceAt >= SILENCE_MS };
}
