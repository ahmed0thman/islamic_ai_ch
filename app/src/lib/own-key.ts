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

export interface OwnKeys { keys: Partial<Record<OwnKeyProvider, string>>; active?: OwnKeyProvider }

/** No in-memory mirror: each request reads this tab's session storage. */
export function getOwnKeys(): OwnKeys {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return { keys: {} };
    const value: unknown = JSON.parse(stored);
    if (valid(value)) return { keys: { [value.provider]: value.key }, active: value.provider };
    if (!value || typeof value !== "object" || Array.isArray(value)) return { keys: {} };
    const record = value as Record<string, unknown>;
    const keys: OwnKeys["keys"] = {};
    if (record.keys && typeof record.keys === "object" && !Array.isArray(record.keys)) {
      const source = record.keys as Record<string, unknown>;
      for (const provider of OWN_KEY_PROVIDERS) {
        if (keyWithinShape(source[provider])) keys[provider] = source[provider];
      }
    }
    const active = OWN_KEY_PROVIDERS.find((provider) => provider === record.active && keys[provider]);
    return active ? { keys, active } : { keys };
  } catch { return { keys: {} }; }
}

export function getOwnKey(): OwnKey | null {
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
  return writeOwnKeys({ keys: { ...stored.keys, [value.provider]: value.key }, active: stored.active ?? value.provider });
}

/** Compatibility helper: save this provider and select it for subsequent requests. */
export function setOwnKey(value: OwnKey): boolean {
  if (!valid(value)) return false;
  const stored = getOwnKeys();
  return writeOwnKeys({ keys: { ...stored.keys, [value.provider]: value.key }, active: value.provider });
}

export function setActiveOwnKey(provider: OwnKeyProvider): boolean {
  const stored = getOwnKeys();
  if (!OWN_KEY_PROVIDERS.includes(provider) || !stored.keys[provider]) return false;
  return writeOwnKeys({ keys: stored.keys, active: provider });
}

export function clearProviderOwnKey(provider: OwnKeyProvider): boolean {
  if (!OWN_KEY_PROVIDERS.includes(provider)) return false;
  const stored = getOwnKeys();
  delete stored.keys[provider];
  const active = stored.active === provider ? OWN_KEY_PROVIDERS.find((name) => stored.keys[name]) : stored.active;
  return writeOwnKeys(active ? { keys: stored.keys, active } : { keys: stored.keys });
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
