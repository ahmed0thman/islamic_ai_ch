import { providersForRequest } from "@/lib/ask/providers";
import { getIndex, getSurah } from "@/lib/content";
import { resolveReaderContext } from "@/lib/ask/atoms";
import { answer } from "@/lib/ask/answer";
import { extraFor, gatherAtoms } from "@/lib/ask/gather";
import { carriedQuestion, historyAtomIds, resolveHistory } from "@/lib/ask/history";
import { logQuestion } from "@/lib/rag/log";
import { questionWithinLimit, requestAllowed, responseFor } from "@/lib/ask/runtime";
import type { AskResponse } from "@/lib/ask/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const started = Date.now();
  let flowLog: string | undefined;
  let outcome = "request_error";
  const selected = providersForRequest(request.headers, process.env);
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
    // "Search again" or "explain more" is not a question of its own: it is carried on the earlier question of the conversation. With none, the reader is asked for one (no model call).
    const carried = carriedQuestion(trimmed, history, typeof stop === "number");
    if (carried === "no_question") return reply("no_question");
    const asked = carried?.question ?? trimmed;
    try {
      if (!(await getIndex()).surahs.some((item) => item.no === surah)) return reply("insufficient", 400);
      const provider = selected.providers;
      if (!provider.length) return reply("unavailable");
      const source = await getSurah(surah);
      const reader = resolveReaderContext(source, depth, stop);
      const context = { depth: reader?.depth ?? 0, ...reader, surah, ayah_numbers: source.ayahs.map((ayah) => Number(ayah.key.split(":")[1])) };
      // Optional: a malformed value is ignored, never an error.
      const openRecord = typeof open_record === "string" && /^\d{1,3}-r\d{2,4}$/.test(open_record) ? open_record : undefined;
      const gathered = await gatherAtoms({
        question: carried?.search ?? trimmed, surah, depth: context.depth, stop: reader?.stop, stopAyahs: reader?.stop_ayahs?.map((ayah) => ayah.key),
        openRecord, historyAtomIds: historyAtomIds(history), ...(carried?.kind === "again" ? { wide: true } : {}),
      }, getSurah);
      const atoms = gathered.atoms;
      let providerFailed = false;
      const result = await answer(asked, atoms, context, provider, {
        history: resolveHistory(history, atoms), examples: gathered.examples, logExtra: { dropped: gathered.dropped },
        preface: [...(carried ? [{ stage: "follow_up", provider: "server", outcome: carried.kind, ms: 0 }] : []), gathered.event],
        log: (line) => { flowLog = line; },
        observe: (event) => {
          if (selected.ownKey && event.provider === selected.provider) providerFailed = event.outcome !== "ok";
        },
      });
      if (selected.ownKey && providerFailed && result.status === "insufficient") return reply("unavailable");
      // A failure of the provider chain on the project's own keys is said as it is, never as "nothing in our sources".
      if (result.status === "unavailable") return reply("unavailable");
      const extra = await extraFor(result.atoms, surah, getSurah);
      logQuestion({ question: trimmed, surah, depth: context.depth, stop: reader?.stop ?? null, status: result.status, atomIds: result.atoms.map((atom) => atom.id),
        retrieval: { mode: gathered.event.provider, counts: gathered.event.outcome, dropped: gathered.dropped } });
      return Response.json({ ...result, ...(gathered.sources ? { sources: true } : {}), ...(extra ? { extra } : {}) }, { headers: { "Cache-Control": "no-store" } });
    // What is thrown here is a fault of the server (retrieval, content, the chain), whoever's key it is: never "nothing in our sources".
    } catch { return reply("unavailable"); }
  } finally {
    const entry = flowLog ? JSON.parse(flowLog) : { event: "ask", stages: [{ stage: "request", provider: "server", outcome, ms: Date.now() - started }], ms: Date.now() - started };
    console.info(JSON.stringify({ ...entry, ...(selected.ownKey ? { own_key: true, ...(selected.provider ? { provider: selected.provider } : {}) } : {}) }));
  }
}
