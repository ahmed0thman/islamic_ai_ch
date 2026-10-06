import { setTimeout as sleep } from "node:timers/promises";
// @ts-expect-error -- Node requires source extensions.
import { classifyFault, ProviderError, retryAfterMs } from "./fault.ts";
import type { AskFault, AskResponse, ChoiceProvider, SelectionRequest } from "./types";

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
/** `reason` is only for a judge's own key: which fixed fault of that key's provider stopped the answer (never the provider's own words). */
export const responseFor = (status: AskResponse["status"], httpStatus = 200, reason?: AskFault) => Response.json({ status, atoms: [], ...(reason ? { reason } : {}) }, {
  status: httpStatus, headers: { "Cache-Control": "no-store" },
});

/** The longest wait a provider's own "try again in" is honoured for, and the time a try needs once the wait is over. */
const MAX_PROVIDER_WAIT_MS = 10_000, MIN_TRY_MS = 3_000;
/** Retries consume the caller's stage deadline (`deadline`, a timestamp, when the caller knows it), including backoff.
 * A 429 is read for what it says: no credit or a daily cap is never retried; a per-minute cap is waited out for as long as the provider asks, if that fits the deadline, and otherwise given back at once. */
export async function fetchRetry(url: string, options: RequestInit, attempts = 3, deadline?: number): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    const response = await fetch(url, options);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) return response;
    let wait = [700, 1800][attempt];
    if (response.status === 429) {
      const body = await response.clone().text().catch(() => "");
      if (classifyFault(429, body) === "quota") return response;
      const asked = retryAfterMs(response.headers, body);
      if (asked !== undefined) {
        wait = asked + 250;
        if (wait > MAX_PROVIDER_WAIT_MS || (deadline !== undefined && Date.now() + wait + MIN_TRY_MS > deadline)) return response;
      }
    }
    await response.body?.cancel();
    await sleep(wait, undefined, { signal: options.signal || undefined });
  }
}
/** `fault`: why the provider refused, when it did (a fixed code). */
export interface StageEvent { stage: string; provider: string; outcome: string; ms: number; fault?: AskFault }
/** Every provider of the chain failed; `fault` is the last one's reason, when it gave one. */
export class StageFailed extends Error {
  readonly fault?: AskFault;
  constructor(fault?: AskFault) { super("stage_failed"); this.fault = fault; }
}
export type Observer = (event: StageEvent) => void;

/** Even a misbehaving provider that ignores AbortSignal cannot hold up fallback. */
export async function runStage(request: Omit<SelectionRequest, "signal">, providers: ChoiceProvider[], timeoutMs: number, observe: Observer, parentSignal?: AbortSignal): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  let lastFault: AskFault | undefined;
  for (const [index, provider] of providers.entries()) {
    if (parentSignal?.aborted) break;
    const start = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outcome = "provider_error";
    let fault: AskFault | undefined;
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
      const result = await Promise.race([provider.choose({ ...request, signal: controller.signal, deadline: start + slice }), timeout, cancelled]);
      outcome = "ok";
      return result;
    } catch (error) {
      // The next provider tries the same schema and data. A fixed code (never upstream text) says why this one failed.
      fault = error instanceof ProviderError ? error.fault : undefined;
      lastFault = fault;
      if (outcome === "provider_error" && error instanceof Error && /^(http_\d{3}|provider_output)$/.test(error.message)) outcome = error.message;
    }
    finally {
      clearTimeout(timer);
      if (onParentAbort) parentSignal?.removeEventListener("abort", onParentAbort);
      observe({ stage: request.stage || "select", provider: provider.name || "custom", outcome, ms: Date.now() - start, ...(fault ? { fault } : {}) });
    }
  }
  throw new StageFailed(lastFault);
}
