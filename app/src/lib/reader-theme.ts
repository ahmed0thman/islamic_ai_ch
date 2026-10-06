export type ThemeChoice = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "huda:theme:v1";
export const THEME_CHANGE_EVENT = "huda-theme-change";
export function parseTheme(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): "light" | "dark" {
  return choice === "system" ? systemDark ? "dark" : "light" : choice;
}
export function readTheme(): ThemeChoice {
  try { return parseTheme(localStorage.getItem(THEME_STORAGE_KEY)); } catch { return "system"; }
}
export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = choice;
  try { localStorage.setItem(THEME_STORAGE_KEY, choice); } catch { /* The choice still applies without storage. */ }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
/** Runs in the document head, before the browser can paint the reader. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:'system'}catch(e){document.documentElement.dataset.theme='system'}`;
