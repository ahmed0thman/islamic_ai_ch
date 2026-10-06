import { checkOwnKey } from "@/lib/ask/key-check";
import { requestAllowed } from "@/lib/ask/runtime";
import { isOwnKeyProvider, keyWithinShape } from "@/lib/own-key";

export const runtime = "nodejs";

type Reason = "rejected" | "timeout" | "unsupported";
const reply = (ok: boolean, reason?: Reason, status = 200) => Response.json(ok ? { ok: true } : { ok: false, reason }, {
  status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request: Request) {
  if (process.env.HUDA_ASK !== "1") return reply(false, "unsupported", 404);
  if (!requestAllowed(request)) return reply(false, "rejected", 429);
  let body: unknown;
  try { body = await request.json(); } catch { return reply(false, "rejected", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply(false, "rejected", 400);
  const { provider, key } = body as Record<string, unknown>;
  if (!isOwnKeyProvider(provider)) return reply(false, "unsupported");
  if (typeof key !== "string" || !keyWithinShape(key)) return reply(false, "rejected");
  const outcome = await checkOwnKey(provider, key, process.env, request.signal);
  return outcome === "ok" ? reply(true) : reply(false, outcome);
}
