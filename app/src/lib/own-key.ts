export const OWN_KEY_PROVIDERS = ["opencode-go", "openai", "anthropic"] as const;
export type OwnKeyProvider = typeof OWN_KEY_PROVIDERS[number];
export interface OwnKey { provider: OwnKeyProvider; key: string }
export const OWN_KEY_CHANGE_EVENT = "huda-own-key-change";
const STORAGE_KEY = "huda-own-key";

export function keyWithinShape(key: unknown): key is string {
  return typeof key === "string" && key.length >= 20 && key.length <= 300 && !/[^\x21-\x7e]/.test(key);
}

function valid(value: unknown): value is OwnKey {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { provider, key } = value as Record<string, unknown>;
  return OWN_KEY_PROVIDERS.some((name) => name === provider) && keyWithinShape(key);
}

/** No in-memory mirror: each request reads this tab's session storage. */
export function getOwnKey(): OwnKey | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    return valid(value) ? { provider: value.provider, key: value.key } : null;
  } catch { return null; }
}

export function setOwnKey(value: OwnKey): boolean {
  try {
    if (!valid(value)) return false;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: value.provider, key: value.key }));
    window.dispatchEvent(new Event(OWN_KEY_CHANGE_EVENT));
    return true;
  } catch { return false; }
}

export function clearOwnKey(): boolean {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(OWN_KEY_CHANGE_EVENT));
    return true;
  } catch { return false; }
}

export function ownKeyHeaders(): Record<string, string> {
  const own = getOwnKey();
  return own ? { "x-huda-provider": own.provider, "x-huda-key": own.key } : {};
}
