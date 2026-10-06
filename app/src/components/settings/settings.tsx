"use client";

import { createContext, useCallback, useContext, useId, useRef, useState, type ReactNode } from "react";
import type { Ui } from "@/lib/types";
import { SignInEntry, UserBadge } from "@/components/account/account";
import { BottomSheet } from "@/components/reader/bottom-sheet";
import { KeyForm } from "@/components/reader/key-sheet";
import { ThemeChoiceRow } from "@/components/wide/theme-choice";
import { useWideSurface } from "@/components/wide/wide-surface";
import styles from "./settings.module.css";

type Selection = { model: boolean; focusModel: boolean };
type SettingsActions = { isOpen: boolean; open: (model: boolean, focusModel?: boolean) => void; close: () => void };
const SettingsContext = createContext<SettingsActions | null>(null);

export function SettingsProvider({ ui, children }: { ui: Ui; children: ReactNode }) {
  const surface = useWideSurface();
  const [selection, setSelection] = useState<Selection | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const close = useCallback(() => {
    setSelection(null);
    const act = pending.current;
    pending.current = null;
    act?.();
  }, []);
  const open = useCallback((model: boolean, focusModel = false) => {
    surface?.closePopover(false);
    if (surface?.wide) document.querySelector<HTMLButtonElement>(".wide-settings-trigger")?.focus({ preventScroll: true });
    setSelection({ model, focusModel });
  }, [surface?.closePopover, surface?.wide]);
  return <SettingsContext.Provider value={{ isOpen: Boolean(selection), open, close }}>
    {children}
    {selection ? <BottomSheet variant="settings" title={ui.settings.title} ui={ui} onClose={close}>
      {(dismiss) => <SettingsSections ui={ui} selection={selection} dismiss={dismiss} onAct={(act) => { pending.current = act; dismiss(); }} />}
    </BottomSheet> : null}
  </SettingsContext.Provider>;
}

function SettingsSections({ ui, selection, dismiss, onAct }: { ui: Ui; selection: Selection; dismiss: () => void; onAct: (act: () => void) => void }) {
  const id = useId();
  const modelRef = useCallback((node: HTMLElement | null) => {
    if (!node || !selection.focusModel) return;
    const frame = requestAnimationFrame(() => {
      node.focus({ preventScroll: true });
      node.scrollIntoView({ block: "start", behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selection.focusModel]);
  return <div className={styles.sections} dir="rtl">
    <section aria-labelledby={`${id}-appearance`}>
      <h3 id={`${id}-appearance`}>{ui.settings.appearance}</h3>
      <ThemeChoiceRow ui={ui} />
    </section>
    {selection.model ? <section ref={modelRef} tabIndex={-1} aria-labelledby={`${id}-model`}>
      <h3 id={`${id}-model`}>{ui.settings.model}</h3>
      <KeyForm ui={ui} onClose={dismiss} />
    </section> : null}
    {process.env.NEXT_PUBLIC_HUDA_AUTH === "1" ? <section aria-labelledby={`${id}-account`}>
      <h3 id={`${id}-account`}>{ui.settings.account}</h3>
      <UserBadge />
      <SignInEntry ui={ui} onAct={onAct} />
    </section> : null}
  </div>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("Settings require SettingsProvider");
  return value;
}

export function SettingsKeyHint({ ui }: { ui: Ui }) {
  const settings = useSettings();
  return <p className={styles.hint}>{ui.settings.key_needed} <button type="button" aria-haspopup="dialog" onClick={() => settings.open(true, true)}>{ui.settings.open_from_ask}</button></p>;
}
