import ui from "@/content/ui.ar.json" with { type: "json" };
import { getIndex, getSurah } from "@/lib/content";
import { providersFromEnv } from "@/lib/ask/providers";
import { requestAllowed, responseFor } from "@/lib/ask/runtime";
import { parseWeaveRequest, weaveStop } from "@/lib/ask/weave";
import type { AskResponse } from "@/lib/ask/types";

export const runtime = "nodejs";
const instruction = ui.weave.instruction;

export async function POST(request: Request) {
  const started = Date.now();
  let flowLog: string | undefined;
  let outcome = "request_error";
  const reply = (status: AskResponse["status"], httpStatus = 200) => {
    outcome = `${status}_${httpStatus}`;
    return responseFor(status, httpStatus);
  };
  try {
    if (process.env.HUDA_WEAVE !== "1") return reply("unavailable");
    if (!requestAllowed(request)) return reply("insufficient", 429);
    let body: unknown;
    try { body = await request.json(); } catch { return reply("insufficient", 400); }
    const input = parseWeaveRequest(body);
    if (!input) return reply("insufficient", 400);
    try {
      if (!(await getIndex()).surahs.some((item) => item.no === input.surah)) return reply("insufficient", 400);
      const providers = providersFromEnv(process.env);
      if (!providers.length) return reply("unavailable");
      const result = await weaveStop(await getSurah(input.surah), input, instruction, providers, { log: (line) => { flowLog = line; } });
      outcome = result.status;
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch { return reply("unavailable"); }
  } finally {
    // Fixed codes and timings only. Saved reader questions are never logged here.
    console.info(flowLog || JSON.stringify({ event: "weave", stages: [{ stage: "request", provider: "server", outcome, ms: Date.now() - started }], ms: Date.now() - started }));
  }
}
