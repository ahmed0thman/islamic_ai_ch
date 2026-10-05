import { providersFromEnv } from "@/lib/ask/providers";
import { getIndex, getSurah } from "@/lib/content";
import { deriveAtoms, resolveReaderContext } from "@/lib/ask/atoms";
import { answer } from "@/lib/ask/answer";
import { resolveHistory } from "@/lib/ask/history";
import type { AskResponse } from "@/lib/ask/types";

export const runtime = "nodejs";
const requests = new Map<string, { count: number; expires: number }>();
function allowed(ip: string): boolean {
  const now = Date.now();
  for (const [key, entry] of requests) if (entry.expires <= now) requests.delete(key);
  const entry = requests.get(ip);
  if (entry) { entry.count += 1; return entry.count <= 10; }
  if (requests.size >= 10_000) return false;
  requests.set(ip, { count: 1, expires: now + 60_000 });
  return true;
}
const responseFor = (status: AskResponse["status"], httpStatus = 200) => Response.json({ status, atoms: [] }, {
  status: httpStatus, headers: { "Cache-Control": "no-store" },
});

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
    // The deployment proxy must overwrite forwarding headers rather than preserve client values.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
    if (!allowed(ip)) return reply("insufficient", 429);
    let body: unknown;
    try { body = await request.json(); } catch { return reply("insufficient", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply("insufficient", 400);
    const { surah, question, depth, stop, history } = body as Record<string, unknown>;
    if (typeof surah !== "number" || !Number.isInteger(surah) || typeof question !== "string") return reply("insufficient", 400);
    const trimmed = question.trim();
    if ([...trimmed].length < 3 || [...trimmed].length > 300) return reply("insufficient", 400);
    try {
      if (!(await getIndex()).surahs.some((item) => item.no === surah)) return reply("insufficient", 400);
      const provider = providersFromEnv(process.env);
      if (!provider.length) return reply("unavailable");
      const source = await getSurah(surah);
      const reader = resolveReaderContext(source, depth, stop);
      const context = { depth: reader?.depth ?? 0, ...reader, surah, ayah_numbers: source.ayahs.map((ayah) => Number(ayah.key.split(":")[1])) };
      const atoms = deriveAtoms(source);
      // Optional and only context: a malformed history is ignored, never an error.
      const result = await answer(trimmed, atoms, context, provider, { history: resolveHistory(history, atoms), log: (line) => { flowLog = line; } });
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch { return reply("insufficient"); }
  } finally {
    console.info(flowLog || JSON.stringify({ event: "ask", stages: [{ stage: "request", provider: "server", outcome, ms: Date.now() - started }], ms: Date.now() - started }));
  }
}
