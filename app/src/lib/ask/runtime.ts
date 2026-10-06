import { setTimeout as sleep } from "node:timers/promises";
import type { AskResponse, ChoiceProvider, SelectionRequest } from "./types";

export const MAX_QUESTION_CHARS = 300;
export const questionWithinLimit = (text: string) => [...text].length <= MAX_QUESTION_CHARS;

const requests = new Map<string, { count: number; expires: number }>();
/** Ask and weave share the same per-IP quota. The proxy must overwrite forwarding headers. */
export function requestAllowed(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  for (const [key, entry] of requests) if (entry.expires <= now) requests.delete(key);
  const entry = requests.get(ip);
  if (entry) { entry.count += 1; return entry.count <= 10; }
  if (requests.size >= 10_000) return false;
  requests.set(ip, { count: 1, expires: now + 60_000 });
  return true;
}
export const responseFor = (status: AskResponse["status"], httpStatus = 200) => Response.json({ status, atoms: [] }, {
  status: httpStatus, headers: { "Cache-Control": "no-store" },
});

/** Retries consume the caller's stage deadline, including backoff. */
export async function fetchRetry(url: string, options: RequestInit, attempts = 3): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    const response = await fetch(url, options);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) return response;
    await response.body?.cancel();
    await sleep([700, 1800][attempt], undefined, { signal: options.signal || undefined });
  }
}
export interface StageEvent { stage: string; provider: string; outcome: string; ms: number }
export type Observer = (event: StageEvent) => void;

/** Even a misbehaving provider that ignores AbortSignal cannot hold up fallback. */
export async function runStage(request: Omit<SelectionRequest, "signal">, providers: ChoiceProvider[], timeoutMs: number, observe: Observer, parentSignal?: AbortSignal): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  for (const [index, provider] of providers.entries()) {
    if (parentSignal?.aborted) break;
    const start = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outcome = "provider_error";
    let onParentAbort: (() => void) | undefined;
    try {
      parentSignal?.throwIfAborted();
      const remaining = deadline - start;
      if (remaining <= 0) throw new Error("timeout");
      // The first providers take 80% of what is left (measured live: a written answer takes 4 to 6 s, a repair about as long); the last one takes all that remains.
      const slice = Math.max(1, Math.floor(remaining * (index === providers.length - 1 ? 1 : 0.8)));
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { outcome = "timeout"; controller.abort(); reject(new Error("timeout")); }, slice);
      });
      const cancelled = new Promise<never>((_, reject) => {
        onParentAbort = () => { outcome = "aborted"; controller.abort(); reject(new Error("aborted")); };
        parentSignal?.addEventListener("abort", onParentAbort, { once: true });
      });
      const result = await Promise.race([provider.choose({ ...request, signal: controller.signal }), timeout, cancelled]);
      outcome = "ok";
      return result;
    } catch (error) {
      // The next provider tries the same schema and data. A fixed code (never upstream text) says why this one failed.
      if (outcome === "provider_error" && error instanceof Error && /^(http_\d{3}|provider_output)$/.test(error.message)) outcome = error.message;
    }
    finally {
      clearTimeout(timer);
      if (onParentAbort) parentSignal?.removeEventListener("abort", onParentAbort);
      observe({ stage: request.stage || "select", provider: provider.name || "custom", outcome, ms: Date.now() - start });
    }
  }
  throw new Error("stage_failed");
}
