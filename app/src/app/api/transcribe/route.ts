import { getIndex, getSurah } from "@/lib/content";
import { contextFor, transcribeQuestion } from "@/lib/voice";
import { ownKeyFromHeaders } from "@/lib/own-key";
import ui from "@/content/ui.ar.json" with { type: "json" };

export const runtime = "nodejs";
const askUi = (ui as { ask?: Record<string, string> }).ask ?? {};
const hintText = {
  intro: askUi.voice_hint_intro ?? "",
  stop: askUi.voice_hint_stop ?? "",
  scholars: askUi.voice_hint_scholars ?? "",
  terms: askUi.voice_hint_terms ?? "",
  words: askUi.voice_hint_words ?? "",
};

function limiter(limit: number) {
  const requests = new Map<string, { count: number; expires: number }>();
  return (ip: string): boolean => {
    const now = Date.now();
    for (const [key, entry] of requests) if (entry.expires <= now) requests.delete(key);
    const entry = requests.get(ip);
    if (entry) { entry.count += 1; return entry.count <= limit; }
    if (requests.size >= 10_000) return false;
    requests.set(ip, { count: 1, expires: now + 60_000 });
    return true;
  };
}
const allowLive = limiter(24);
const allowFinal = limiter(6);
const responseFor = (status: string, httpStatus: number) => Response.json({ status }, {
  status: httpStatus, headers: { "Cache-Control": "no-store" },
});
// Node turns uploaded files into File instances, so every audio field is a Blob.
const filenameFor = (type: string): string =>
  type.includes("mp4") ? "question.mp4" : type.includes("m4a") || type.includes("aac") ? "question.m4a"
    : type.includes("ogg") ? "question.ogg" : type.includes("wav") ? "question.wav" : "question.webm";
const numberField = (value: FormDataEntryValue | null): number | undefined =>
  typeof value === "string" && /^\d+$/.test(value) ? Number(value) : undefined;

export async function POST(request: Request) {
  const started = Date.now();
  let outcome = "error_500";
  let live = false;
  let bytes = 0;
  let corrected = false;
  let ownKey = false;
  try {
    if (process.env.HUDA_ASK !== "1") { outcome = "unavailable_404"; return responseFor("unavailable", 404); }
    // Any own-key header opts out of the project's Groq key, including a malformed pair: it fails, with no fallback.
    const own = ownKeyFromHeaders(request.headers, "transcribe");
    ownKey = own.present;
    if (own.present && !own.own) { outcome = "error_400"; return responseFor("error", 400); }
    // The deployment proxy must overwrite forwarding headers rather than preserve client values.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
    let form: FormData;
    try { form = await request.formData(); }
    catch { outcome = "error_400"; return responseFor("error", 400); }
    live = form.get("live") === "1";
    if (!(live ? allowLive : allowFinal)(ip)) { outcome = "busy_429"; return responseFor("busy", 429); }
    const audio = form.get("audio");
    if (!(audio instanceof Blob)) { outcome = "error_400"; return responseFor("error", 400); }
    bytes = audio.size;
    if (audio.size < 1 || audio.size > 4_000_000) { outcome = "error_413"; return responseFor("error", 413); }
    const type = audio.type;
    if (!(type.startsWith("audio/") || type === "video/webm" || type === "video/mp4")) { outcome = "error_400"; return responseFor("error", 400); }
    const surahField = form.get("surah");
    if (typeof surahField !== "string" || !/^\d+$/.test(surahField)) { outcome = "error_400"; return responseFor("error", 400); }
    const surah = Number(surahField);
    if (!(await getIndex()).surahs.some((item) => item.no === surah)) { outcome = "error_400"; return responseFor("error", 400); }
    const source = await getSurah(surah);
    const context = contextFor(source, numberField(form.get("depth")), numberField(form.get("stop")));
    const result = await transcribeQuestion({
      audio, filename: filenameFor(type), context, hintText, live, env: process.env, signal: request.signal, ...(own.own ? { ownKey: own.own.key } : {}),
    });
    if (result.status === "ok") corrected = result.corrected;
    outcome = `${result.status}_200`;
    return Response.json(result, { status: result.status === "busy" ? 429 : 200, headers: { "Cache-Control": "no-store" } });
  } catch { outcome = "error_500"; return responseFor("error", 500); }
  finally {
    console.info(JSON.stringify({ event: "transcribe", live, outcome, ms: Date.now() - started, bytes, corrected, ...(ownKey ? { own_key: true } : {}) }));
  }
}
