"use client";

import { useEffect, useId, useState } from "react";
import { Moon02Icon, Sun03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { applyTheme, parseTheme, readTheme, resolveTheme, THEME_CHANGE_EVENT, THEME_STORAGE_KEY, type ThemeChoice } from "@/lib/reader-theme";
import type { Ui } from "@/lib/types";

export function useWideTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => { setChoice(parseTheme(document.documentElement.dataset.theme)); setSystemDark(media.matches); };
    const storage = (event: StorageEvent) => { if (event.key === THEME_STORAGE_KEY || event.key === null) { document.documentElement.dataset.theme = readTheme(); read(); } };
    read(); window.addEventListener(THEME_CHANGE_EVENT, read); window.addEventListener("storage", storage); media.addEventListener("change", read);
    return () => { window.removeEventListener(THEME_CHANGE_EVENT, read); window.removeEventListener("storage", storage); media.removeEventListener("change", read); };
  }, []);
  return { choice, effective: resolveTheme(choice, systemDark) };
}

export function WideThemeMenu({ ui, onChoose }: { ui: Ui; onChoose: () => void }) {
  const { choice } = useWideTheme();
  return <div className="wide-theme-menu" role="group" aria-label={ui.wide.theme}>
    {(["light", "dark", "system"] as const).map((value) => <button type="button" key={value} aria-pressed={choice === value} onClick={() => { applyTheme(value); onChoose(); }}>
      <span>{ui.wide[`theme_${value}`]}</span>{choice === value ? <Icon icon={Tick02Icon} size={16} /> : null}
    </button>)}
  </div>;
}

export function ThemeChoiceRow({ ui }: { ui: Ui }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const id = useId();
  useEffect(() => {
    const read = () => setChoice(parseTheme(document.documentElement.dataset.theme));
    const storage = (event: StorageEvent) => { if (event.key === THEME_STORAGE_KEY || event.key === null) { document.documentElement.dataset.theme = readTheme(); read(); } };
    read(); window.addEventListener(THEME_CHANGE_EVENT, read); window.addEventListener("storage", storage);
    return () => { window.removeEventListener(THEME_CHANGE_EVENT, read); window.removeEventListener("storage", storage); };
  }, []);
  return <div className="theme-choice-row"><label htmlFor={id}><Icon icon={choice === "dark" ? Moon02Icon : Sun03Icon} />{ui.wide.theme}</label>
    <select id={id} value={choice} onChange={(event) => { const next = event.target.value as ThemeChoice; setChoice(next); applyTheme(next); }}>
      {(["light", "dark", "system"] as const).map((value) => <option key={value} value={value}>{ui.wide[`theme_${value}`]}</option>)}
    </select>
  </div>;
}
