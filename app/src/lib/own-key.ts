/** The one place that says which keys a judge may enter and what each is for. */
export const OWN_KEY_PURPOSES = { openai: "ask", gemini: "ask", groq: "transcribe" } as const;
export type OwnKeyProvider = keyof typeof OWN_KEY_PURPOSES;
export type OwnKeyPurpose = typeof OWN_KEY_PURPOSES[OwnKeyProvider];
export type AskKeyProvider = { [P in OwnKeyProvider]: typeof OWN_KEY_PURPOSES[P] extends "ask" ? P : never }[OwnKeyProvider];
export const OWN_KEY_PROVIDERS = Object.keys(OWN_KEY_PURPOSES) as OwnKeyProvider[];
export const ASK_KEY_PROVIDERS = OWN_KEY_PROVIDERS.filter((name): name is AskKeyProvider => OWN_KEY_PURPOSES[name] === "ask");
export const isOwnKeyProvider = (value: unknown): value is OwnKeyProvider => OWN_KEY_PROVIDERS.some((name) => name === value);
export const isAskKeyProvider = (value: unknown): value is AskKeyProvider => ASK_KEY_PROVIDERS.some((name) => name === value);
export interface OwnKey { provider: OwnKeyProvider; key: string }
export interface AskOwnKey { provider: AskKeyProvider; key: string }
export const OWN_KEY_CHANGE_EVENT = "huda-own-key-change";
const STORAGE_KEY = "huda-own-key";

export function keyWithinShape(key: unknown): key is string {
  return typeof key === "string" && key.length >= 20 && key.length <= 300 && !/[^\x21-\x7e]/.test(key);
}

function valid(value: unknown): value is OwnKey {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { provider, key } = value as Record<string, unknown>;
  return isOwnKeyProvider(provider) && keyWithinShape(key);
}

/** `active` is the Ask provider only: a saved transcription key has no such notion. */
export interface OwnKeys { keys: Partial<Record<OwnKeyProvider, string>>; active?: AskKeyProvider }

/** No in-memory mirror: each request reads this tab's session storage. */
export function getOwnKeys(): OwnKeys {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return { keys: {} };
    const value: unknown = JSON.parse(stored);
    if (valid(value)) return { keys: { [value.provider]: value.key }, ...(isAskKeyProvider(value.provider) ? { active: value.provider } : {}) };
    if (!value || typeof value !== "object" || Array.isArray(value)) return { keys: {} };
    const record = value as Record<string, unknown>;
    const keys: OwnKeys["keys"] = {};
    if (record.keys && typeof record.keys === "object" && !Array.isArray(record.keys)) {
      const source = record.keys as Record<string, unknown>;
      for (const provider of OWN_KEY_PROVIDERS) {
        if (keyWithinShape(source[provider])) keys[provider] = source[provider];
      }
    }
    const active = ASK_KEY_PROVIDERS.find((provider) => provider === record.active && keys[provider]);
    return active ? { keys, active } : { keys };
  } catch { return { keys: {} }; }
}

/** The active Ask key. */
export function getOwnKey(): AskOwnKey | null {
  const { keys, active } = getOwnKeys();
  return active && keys[active] ? { provider: active, key: keys[active] } : null;
}

function writeOwnKeys(value: OwnKeys): boolean {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new Event(OWN_KEY_CHANGE_EVENT));
    return true;
  } catch { return false; }
}

export function setProviderOwnKey(value: OwnKey): boolean {
  if (!valid(value)) return false;
  const stored = getOwnKeys();
  const active = stored.active ?? (isAskKeyProvider(value.provider) ? value.provider : undefined);
  return writeOwnKeys({ keys: { ...stored.keys, [value.provider]: value.key }, ...(active ? { active } : {}) });
}

/** Compatibility helper: save this provider and, for an Ask key, select it for subsequent requests. */
export function setOwnKey(value: OwnKey): boolean {
  if (!valid(value)) return false;
  const stored = getOwnKeys();
  const active = isAskKeyProvider(value.provider) ? value.provider : stored.active;
  return writeOwnKeys({ keys: { ...stored.keys, [value.provider]: value.key }, ...(active ? { active } : {}) });
}

export function setActiveOwnKey(provider: AskKeyProvider): boolean {
  const stored = getOwnKeys();
  if (!isAskKeyProvider(provider) || !stored.keys[provider]) return false;
  return writeOwnKeys({ keys: stored.keys, active: provider });
}

export function clearProviderOwnKey(provider: OwnKeyProvider): boolean {
  if (!isOwnKeyProvider(provider)) return false;
  const stored = getOwnKeys();
  delete stored.keys[provider];
  const active = stored.active === provider ? ASK_KEY_PROVIDERS.find((name) => stored.keys[name]) : stored.active;
  return writeOwnKeys(active ? { keys: stored.keys, active } : { keys: stored.keys });
}

export function clearOwnKey(): boolean {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(OWN_KEY_CHANGE_EVENT));
    return true;
  } catch { return false; }
}

const headersFor = (provider: OwnKeyProvider, key: string) => ({ "x-huda-provider": provider, "x-huda-key": key });

/** Headers for Ask and weave: the active Ask key only, never the transcription key. */
export function ownKeyHeaders(): Record<string, string> {
  const own = getOwnKey();
  return own ? headersFor(own.provider, own.key) : {};
}

/** Headers for the transcription call: the Groq key, when one is saved. */
export function ownTranscribeHeaders(): Record<string, string> {
  const key = getOwnKeys().keys.groq;
  return key ? headersFor("groq", key) : {};
}

/** Server side, one parser for every route that takes the headers. Any header opts out of the project's keys, including a malformed or incomplete pair; `own` is set only for a well-shaped pair whose provider serves this purpose. */
export function ownKeyFromHeaders(headers: Headers, purpose: OwnKeyPurpose): { present: boolean; own?: OwnKey } {
  const provider = headers.get("x-huda-provider");
  const key = headers.get("x-huda-key");
  const present = provider !== null || key !== null;
  const own = isOwnKeyProvider(provider) && OWN_KEY_PURPOSES[provider] === purpose && keyWithinShape(key) ? { provider, key } : undefined;
  return { present, ...(own ? { own } : {}) };
}
