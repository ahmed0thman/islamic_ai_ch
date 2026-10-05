import { providerFromEnv } from "@/lib/ask/providers";
import { getIndex, getSurah } from "@/lib/content";
import { deriveAtoms, resolveReaderContext } from "@/lib/ask/atoms";
import { select } from "@/lib/ask/select";
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
const reply = (status: AskResponse["status"], httpStatus = 200) => Response.json({ status, atoms: [] }, {
  status: httpStatus, headers: { "Cache-Control": "no-store" },
});

export async function POST(request: Request) {
  if (process.env.HUDA_ASK !== "1") return reply("unavailable", 404);
  // The deployment proxy must overwrite forwarding headers rather than preserve client values.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  if (!allowed(ip)) return reply("insufficient", 429);
  let body: unknown;
  try { body = await request.json(); } catch { return reply("insufficient", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply("insufficient", 400);
  const { surah, question, depth, stop } = body as Record<string, unknown>;
  if (typeof surah !== "number" || !Number.isInteger(surah) || typeof question !== "string") return reply("insufficient", 400);
  const trimmed = question.trim();
  if ([...trimmed].length < 3 || [...trimmed].length > 300) return reply("insufficient", 400);
  try {
    if (!(await getIndex()).surahs.some((item) => item.no === surah)) return reply("insufficient", 400);
    const provider = providerFromEnv(process.env);
    if (!provider) return reply("unavailable");
    const source = await getSurah(surah);
    const result = await select(trimmed, deriveAtoms(source), provider, 20_000, resolveReaderContext(source, depth, stop));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return reply("insufficient"); }
}
