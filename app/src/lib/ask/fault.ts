/** Why a provider refused a request, as a fixed code. It is the only thing of a provider's error that leaves the module that called it:
 * the provider's own wording (which may quote an account or a key) is never kept, logged or sent to the reader. */
export type AskFault = "rate_limit" | "quota" | "key_rejected" | "model_unavailable" | "other";

/** The UI string that tells a judge what happened to their own key; the texts live in content/ui.ar.json. */
export const FAULT_UI_KEY = {
  rate_limit: "key_rate_limit", quota: "key_quota", key_rejected: "key_rejected", model_unavailable: "key_model", other: "key_failed",
} as const satisfies Record<AskFault, string>;

/** A provider's HTTP refusal. The message stays `http_<status>` (the logged code); `fault` says why. */
export class ProviderError extends Error {
  readonly status: number;
  readonly fault: AskFault;
  constructor(status: number, fault: AskFault) { super(`http_${status}`); this.status = status; this.fault = fault; }
}

/** A fault that asking again, in this request, cannot cure: the key, the model or the allowance is the problem (a rate limit already got its wait inside `fetchRetry`). */
export const faultStopsRequest = (fault: AskFault | undefined): fault is Exclude<AskFault, "other"> => fault !== undefined && fault !== "other";

/** Reads a provider's error body for one thing only: which of the fixed faults it is. Never returns, keeps or logs the text. */
export function classifyFault(status: number, body: string): AskFault {
  const text = body.slice(0, 4000);
  if (status === 401) return "key_rejected";
  if (status === 429) {
    // A daily or monthly cap, or no credit, does not clear within a minute; a per-minute cap does.
    return /insufficient_quota|credit_balance|no credits|exceeded your current quota|per day|\(RPD\)|per month|\(TPD\)/i.test(text) ? "quota" : "rate_limit";
  }
  if ([400, 403, 404].includes(status)) {
    if (/model_not_found|model[^.]{0,60}(does not exist|not found|not available|do(?:es)? not have access)|access to (?:the )?model|unsupported model/i.test(text)) return "model_unavailable";
    if (/invalid[_ ]api[_ ]key|incorrect api key|api key[^.]{0,40}(invalid|not valid|revoked)|invalid_authentication/i.test(text) || status === 403) return "key_rejected";
  }
  return "other";
}

/** Anthropic's refusals, by the status it answers with: 401 and 403 the key, 404 the model, 429 the rate, and a 400 that says the credit balance is too low. Anything else is `other`. Never keeps the text. */
export function classifyAnthropicFault(status: number, body: string): AskFault {
  if (status === 401 || status === 403) return "key_rejected";
  if (status === 404) return "model_unavailable";
  if (status === 429) return "rate_limit";
  if (status === 400 && /credit balance/i.test(body.slice(0, 4000))) return "quota";
  return "other";
}

/** How long the provider asks to wait before the next try: `retry-after-ms`, `retry-after` (seconds), or "try again in 6s" in the body. Undefined when it says nothing usable. */
export function retryAfterMs(headers: Headers, body: string): number | undefined {
  const ms = Number(headers.get("retry-after-ms"));
  if (headers.get("retry-after-ms") && Number.isFinite(ms) && ms >= 0) return ms;
  const seconds = Number(headers.get("retry-after"));
  if (headers.get("retry-after") && Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const said = body.slice(0, 4000).match(/try again in ((?:\d+(?:\.\d+)?(?:ms|h|m|s))+)/i);
  if (!said) return undefined;
  const unit = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 } as const;
  let total = 0;
  for (const [, value, name] of said[1].matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/gi)) total += Number(value) * unit[name.toLowerCase() as keyof typeof unit];
  return total;
}
