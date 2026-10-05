import { providersFromEnv } from "@/lib/ask/providers";
import { getIndex, getSurah } from "@/lib/content";
import { resolveReaderContext } from "@/lib/ask/atoms";
import { answer } from "@/lib/ask/answer";
import { extraFor, gatherAtoms } from "@/lib/ask/gather";
import { historyAtomIds, resolveHistory } from "@/lib/ask/history";
import { logQuestion } from "@/lib/rag/log";
import { questionWithinLimit, requestAllowed, responseFor } from "@/lib/ask/runtime";
import type { AskResponse } from "@/lib/ask/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const started = Date.now();
  let flowLog: string | undefined;
  let outcome = "request_error";
  const reply = (status: AskResponse["status"], httpStatus = 200) => {
    outcome = `${status}_${httpStatus}`;
    return responseFor(status, httpStatus);
  };
  try {
    if (process.env.HUDA_ASK !== "1") return reply("unavailable", 404);
    if (!requestAllowed(request)) return reply("insufficient", 429);
    let body: unknown;
    try { body = await request.json(); } catch { return reply("insufficient", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply("insufficient", 400);
    const { surah, question, depth, stop, history, open_record } = body as Record<string, unknown>;
    if (typeof surah !== "number" || !Number.isInteger(surah) || typeof question !== "string") return reply("insufficient", 400);
    const trimmed = question.trim();
    if ([...trimmed].length < 3 || !questionWithinLimit(trimmed)) return reply("insufficient", 400);
    // A question with no Arabic letter is answered by the fixed status, with no model call.
    if (!/[\u0621-\u064A]/u.test(trimmed)) return reply("not_arabic");
    try {
      if (!(await getIndex()).surahs.some((item) => item.no === surah)) return reply("insufficient", 400);
      const provider = providersFromEnv(process.env);
      if (!provider.length) return reply("unavailable");
      const source = await getSurah(surah);
      const reader = resolveReaderContext(source, depth, stop);
      const context = { depth: reader?.depth ?? 0, ...reader, surah, ayah_numbers: source.ayahs.map((ayah) => Number(ayah.key.split(":")[1])) };
      // Optional: a malformed value is ignored, never an error.
      const openRecord = typeof open_record === "string" && /^\d{1,3}-r\d{2,4}$/.test(open_record) ? open_record : undefined;
      const gathered = await gatherAtoms({
        question: trimmed, surah, depth: context.depth, stop: reader?.stop, stopAyahs: reader?.stop_ayahs?.map((ayah) => ayah.key),
        openRecord, historyAtomIds: historyAtomIds(history),
      }, getSurah);
      const atoms = gathered.atoms;
      const result = await answer(trimmed, atoms, context, provider, {
        history: resolveHistory(history, atoms), examples: gathered.examples, preface: [gathered.event], logExtra: { dropped: gathered.dropped },
        log: (line) => { flowLog = line; },
      });
      const extra = await extraFor(result.atoms, surah, getSurah);
      logQuestion({ question: trimmed, surah, depth: context.depth, stop: reader?.stop ?? null, status: result.status, atomIds: result.atoms.map((atom) => atom.id),
        retrieval: { mode: gathered.event.provider, counts: gathered.event.outcome, dropped: gathered.dropped } });
      return Response.json({ ...result, ...(gathered.sources ? { sources: true } : {}), ...(extra ? { extra } : {}) }, { headers: { "Cache-Control": "no-store" } });
    } catch { return reply("insufficient"); }
  } finally {
    console.info(flowLog || JSON.stringify({ event: "ask", stages: [{ stage: "request", provider: "server", outcome, ms: Date.now() - started }], ms: Date.now() - started }));
  }
}
