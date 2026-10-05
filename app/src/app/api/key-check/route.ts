import { providersFromKey } from "@/lib/ask/providers";
import { requestAllowed, runStage } from "@/lib/ask/runtime";
import { CHOICE_SCHEMA } from "@/lib/ask/select";

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
  if (provider !== "opencode-go" && provider !== "openai" && provider !== "anthropic") return reply(false, "unsupported");
  if (typeof key !== "string") return reply(false, "rejected");
  const providers = providersFromKey(provider, key, process.env);
  if (!providers.length) return reply(false, "rejected");
  let reason: Reason = "rejected";
  try {
    const value = await runStage({
      system: 'Return only {"status":"insufficient","atom_ids":[]}.', message: "Check access.", schema: CHOICE_SCHEMA, stage: "select",
    }, providers, 8_000, (event) => { if (event.outcome === "timeout") reason = "timeout"; }, request.signal);
    if (!value || typeof value !== "object" || Array.isArray(value)) return reply(false, "rejected");
    const choice = value as Record<string, unknown>;
    return Object.keys(choice).length === 2 && choice.status === "insufficient" && Array.isArray(choice.atom_ids) && choice.atom_ids.length === 0
      ? reply(true) : reply(false, "rejected");
  } catch { return reply(false, reason); }
}
